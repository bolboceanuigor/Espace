import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationProviderType,
  NotificationTemplateStatus,
  Prisma,
  Role,
  TransactionalNotificationType,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string | null };
type SendParams = {
  type: TransactionalNotificationType;
  channels: NotificationChannel[];
  associationId?: string | null;
  recipientUserId?: string | null;
  recipientResidentId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  locale?: string | null;
  variables?: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdById?: string | null;
  metadata?: Record<string, unknown>;
};

const CRITICAL_TYPES = new Set<TransactionalNotificationType>([
  TransactionalNotificationType.PASSWORD_RESET,
  TransactionalNotificationType.RESIDENT_PORTAL_INVITATION,
  TransactionalNotificationType.STAFF_INVITATION,
  TransactionalNotificationType.SYSTEM_SECURITY_ALERT,
]);
const CANCELLABLE_DELIVERY_STATUSES: NotificationDeliveryStatus[] = [
  NotificationDeliveryStatus.PENDING,
  NotificationDeliveryStatus.QUEUED,
];

const SYSTEM_TEMPLATES: Array<{
  type: TransactionalNotificationType;
  channel: NotificationChannel;
  name: string;
  subject?: string;
  body: string;
}> = [
  { type: TransactionalNotificationType.RESIDENT_PORTAL_INVITATION, channel: NotificationChannel.EMAIL, name: 'Invitație portal locatar', subject: 'Activează contul tău Espace', body: 'Salut {{residentName}}, ai fost invitat să activezi contul în Espace pentru {{associationName}}. Accesează linkul: {{inviteLink}}' },
  { type: TransactionalNotificationType.STAFF_INVITATION, channel: NotificationChannel.EMAIL, name: 'Invitație staff', subject: 'Invitație în echipa Espace', body: 'Salut {{staffName}}, ai fost invitat în echipa {{associationName}}. Acceptă invitația: {{inviteLink}}' },
  { type: TransactionalNotificationType.PASSWORD_RESET, channel: NotificationChannel.EMAIL, name: 'Resetare parolă', subject: 'Resetare parolă Espace', body: 'Am primit o solicitare de resetare a parolei. Link: {{resetLink}}. Dacă nu ai solicitat acest lucru, ignoră mesajul.' },
  { type: TransactionalNotificationType.RESIDENT_INVOICE_ISSUED, channel: NotificationChannel.EMAIL, name: 'Factură resident emisă', subject: 'Factură nouă emisă', body: 'Factura {{invoiceNumber}} pentru {{associationName}} a fost emisă. Sold: {{amount}} {{currency}}. Scadență: {{dueDate}}.' },
  { type: TransactionalNotificationType.RESIDENT_PAYMENT_RECORDED, channel: NotificationChannel.EMAIL, name: 'Plată înregistrată', subject: 'Plată înregistrată', body: 'Plata de {{amount}} {{currency}} pentru factura {{invoiceNumber}} a fost înregistrată.' },
  { type: TransactionalNotificationType.REQUEST_ADMIN_REPLY, channel: NotificationChannel.EMAIL, name: 'Răspuns solicitare', subject: 'Răspuns nou la solicitarea {{requestNumber}}', body: 'Ai primit un răspuns nou pentru solicitarea {{requestNumber}} din {{associationName}}.' },
  { type: TransactionalNotificationType.METER_READING_APPROVED, channel: NotificationChannel.EMAIL, name: 'Indice aprobat', subject: 'Indice aprobat', body: 'Indicele pentru {{meterType}} din {{periodMonth}} a fost aprobat.' },
  { type: TransactionalNotificationType.SAAS_INVOICE_ISSUED, channel: NotificationChannel.EMAIL, name: 'Factură SaaS emisă', subject: 'Factură abonament Espace emisă', body: 'Factura de abonament {{invoiceNumber}} pentru {{associationName}} a fost emisă. Total: {{amount}} {{currency}}. Scadență: {{dueDate}}.' },
  { type: TransactionalNotificationType.SYSTEM_SECURITY_ALERT, channel: NotificationChannel.EMAIL, name: 'Test provider email', subject: 'Test notificări Espace', body: 'Acesta este un test pentru providerul de email Espace. Support: {{supportEmail}}' },
  { type: TransactionalNotificationType.RESIDENT_PORTAL_INVITATION, channel: NotificationChannel.SMS, name: 'SMS invitație locatar', body: 'Espace: activează contul pentru {{associationName}}: {{inviteLink}}' },
  { type: TransactionalNotificationType.PASSWORD_RESET, channel: NotificationChannel.SMS, name: 'SMS reset parolă', body: 'Espace: resetare parolă {{resetLink}}' },
  { type: TransactionalNotificationType.RESIDENT_INVOICE_ISSUED, channel: NotificationChannel.SMS, name: 'SMS factură emisă', body: 'Espace: factura {{invoiceNumber}} are sold {{amount}} {{currency}}, scadentă {{dueDate}}.' },
  { type: TransactionalNotificationType.RESIDENT_PAYMENT_RECORDED, channel: NotificationChannel.SMS, name: 'SMS plată', body: 'Espace: plata de {{amount}} {{currency}} a fost înregistrată.' },
  { type: TransactionalNotificationType.ANNOUNCEMENT_URGENT, channel: NotificationChannel.SMS, name: 'SMS anunț urgent', body: 'Espace urgent: {{announcementTitle}}' },
  { type: TransactionalNotificationType.SYSTEM_SECURITY_ALERT, channel: NotificationChannel.SMS, name: 'SMS test provider', body: 'Espace: test SMS provider.' },
];

@Injectable()
export class TransactionalNotificationsService {
  private readonly logger = new Logger(TransactionalNotificationsService.name);
  private seeded = false;

  constructor(private readonly prisma: PrismaService) {}

  async sendTransactionalNotification(params: SendParams) {
    await this.ensureSystemTemplates();
    const deliveries = [];
    for (const channel of params.channels) {
      deliveries.push(await this.sendOne({ ...params, channel }));
    }
    return { deliveries };
  }

  async overview() {
    await this.ensureSystemTemplates();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [emailSentToday, smsSentToday, failed, skipped, templatesActive, recentDeliveries, lastError] = await Promise.all([
      this.prisma.notificationDelivery.count({ where: { channel: NotificationChannel.EMAIL, status: NotificationDeliveryStatus.SENT, createdAt: { gte: dayStart } } }),
      this.prisma.notificationDelivery.count({ where: { channel: NotificationChannel.SMS, status: NotificationDeliveryStatus.SENT, createdAt: { gte: dayStart } } }),
      this.prisma.notificationDelivery.count({ where: { status: NotificationDeliveryStatus.FAILED } }),
      this.prisma.notificationDelivery.count({ where: { status: NotificationDeliveryStatus.SKIPPED } }),
      this.prisma.notificationTemplate.count({ where: { status: NotificationTemplateStatus.ACTIVE } }),
      this.prisma.notificationDelivery.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: this.deliveryInclude() }),
      this.prisma.notificationDelivery.findFirst({ where: { status: NotificationDeliveryStatus.FAILED }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      kpi: { emailSentToday, smsSentToday, failed, skipped, templatesActive, emailProvider: this.emailHealth(), smsProvider: this.smsHealth(), lastError: lastError?.errorMessage || null },
      providerHealth: { email: this.emailHealth(), sms: this.smsHealth() },
      recentDeliveries: recentDeliveries.map((item) => this.serializeDelivery(item, true)),
    };
  }

  providers() {
    return {
      externalEnabled: this.externalEnabled(),
      devMode: this.devMode(),
      email: this.emailHealth(),
      sms: this.smsHealth(),
      message: 'Secretele se configurează în environment variables.',
    };
  }

  async testEmail(actor: Actor, body: unknown) {
    const to = this.requiredString(this.payload(body).to, 'Adresa email este obligatorie.');
    return this.sendTransactionalNotification({
      type: TransactionalNotificationType.SYSTEM_SECURITY_ALERT,
      channels: [NotificationChannel.EMAIL],
      recipientEmail: to,
      variables: { associationName: 'Espace', supportEmail: process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL || 'support@example.com' },
      relatedEntityType: 'PROVIDER_TEST',
      relatedEntityId: `email:${to}`,
      createdById: this.actorId(actor),
      metadata: { test: true },
    });
  }

  async testSms(actor: Actor, body: unknown) {
    const to = this.requiredString(this.payload(body).to, 'Numărul de telefon este obligatoriu.');
    return this.sendTransactionalNotification({
      type: TransactionalNotificationType.SYSTEM_SECURITY_ALERT,
      channels: [NotificationChannel.SMS],
      recipientPhone: to,
      variables: { associationName: 'Espace' },
      relatedEntityType: 'PROVIDER_TEST',
      relatedEntityId: `sms:${to}`,
      createdById: this.actorId(actor),
      metadata: { test: true },
    });
  }

  async listTemplates(query: Record<string, unknown>) {
    await this.ensureSystemTemplates();
    const where: Prisma.NotificationTemplateWhereInput = {
      ...(this.optionalEnum(query.channel, NotificationChannel) ? { channel: this.optionalEnum(query.channel, NotificationChannel)! } : {}),
      ...(this.optionalEnum(query.status, NotificationTemplateStatus) ? { status: this.optionalEnum(query.status, NotificationTemplateStatus)! } : {}),
      ...(this.optionalEnum(query.type, TransactionalNotificationType) ? { type: this.optionalEnum(query.type, TransactionalNotificationType)! } : {}),
    };
    const templates = await this.prisma.notificationTemplate.findMany({ where, orderBy: [{ type: 'asc' }, { channel: 'asc' }, { locale: 'asc' }] });
    return { items: templates, meta: { total: templates.length } };
  }

  async createTemplate(actor: Actor, body: unknown) {
    const payload = this.payload(body);
    const type = this.requiredEnum(payload.type, TransactionalNotificationType, 'Tipul este obligatoriu.');
    const channel = this.requiredEnum(payload.channel, NotificationChannel, 'Canalul este obligatoriu.');
    const locale = this.optionalString(payload.locale) || 'ro';
    await this.assertSingleActive(type, channel, locale, this.optionalEnum(payload.status, NotificationTemplateStatus) || NotificationTemplateStatus.DRAFT);
    const template = await this.prisma.notificationTemplate.create({
      data: {
        type,
        channel,
        locale,
        name: this.requiredString(payload.name, 'Numele este obligatoriu.'),
        subject: this.optionalString(payload.subject),
        body: this.requiredString(payload.body, 'Conținutul este obligatoriu.'),
        smsBody: this.optionalString(payload.smsBody),
        variables: this.payload(payload.variables) as Prisma.InputJsonValue,
        status: this.optionalEnum(payload.status, NotificationTemplateStatus) || NotificationTemplateStatus.DRAFT,
        isSystem: false,
        createdById: this.actorId(actor) || null,
      },
    });
    await this.audit(this.actorId(actor), 'NOTIFICATION_TEMPLATE_CREATED', null, { templateId: template.id, channel, type });
    return template;
  }

  async getTemplate(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template-ul nu a fost găsit.');
    return template;
  }

  async updateTemplate(actor: Actor, id: string, body: unknown) {
    const existing = await this.getTemplate(id);
    const payload = this.payload(body);
    const status = this.optionalEnum(payload.status, NotificationTemplateStatus);
    if (status) await this.assertSingleActive(existing.type, existing.channel, existing.locale, status, id);
    const bodyText = payload.body === undefined ? existing.body : this.requiredString(payload.body, 'Conținutul este obligatoriu.');
    const subject = payload.subject === undefined ? existing.subject : this.optionalString(payload.subject);
    if (existing.channel === NotificationChannel.EMAIL && !subject) throw new BadRequestException('Subiectul este obligatoriu pentru EMAIL.');
    const template = await this.prisma.notificationTemplate.update({
      where: { id },
      data: { subject, body: bodyText, smsBody: payload.smsBody === undefined ? existing.smsBody : this.optionalString(payload.smsBody), status: status || existing.status, updatedById: this.actorId(actor) || null },
    });
    await this.audit(this.actorId(actor), 'NOTIFICATION_TEMPLATE_UPDATED', null, { templateId: id, channel: template.channel, type: template.type });
    return template;
  }

  async updateTemplateStatus(actor: Actor, id: string, body: unknown) {
    const existing = await this.getTemplate(id);
    const status = this.requiredEnum(this.payload(body).status, NotificationTemplateStatus, 'Statusul este obligatoriu.');
    await this.assertSingleActive(existing.type, existing.channel, existing.locale, status, id);
    const template = await this.prisma.notificationTemplate.update({ where: { id }, data: { status, updatedById: this.actorId(actor) || null } });
    await this.audit(this.actorId(actor), 'NOTIFICATION_TEMPLATE_STATUS_CHANGED', null, { templateId: id, channel: template.channel, type: template.type, status });
    return template;
  }

  async previewTemplate(id: string, body: unknown) {
    const template = await this.getTemplate(id);
    const variables = { ...this.exampleVariables(), ...this.payload(this.payload(body).variables) };
    return { subject: this.renderTemplate(template.subject || '', variables), body: this.renderTemplate(template.body, variables), bodyPreview: this.preview(this.renderTemplate(template.body, variables)) };
  }

  async listDeliveries(query: Record<string, unknown>, associationId?: string | null) {
    const { page, limit, skip } = resolvePagination({ page: Number(query.page) || undefined, limit: Number(query.limit) || undefined }, 20, 100);
    const where = this.deliveryWhere(query, associationId);
    const [total, items] = await Promise.all([
      this.prisma.notificationDelivery.count({ where }),
      this.prisma.notificationDelivery.findMany({ where, include: this.deliveryInclude(), orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return { items: items.map((item) => this.serializeDelivery(item, true)), meta: buildPaginationMeta(page, limit, total) };
  }

  async getDelivery(id: string, associationId?: string | null) {
    const delivery = await this.prisma.notificationDelivery.findFirst({ where: { id, ...(associationId ? { associationId } : {}) }, include: this.deliveryInclude() });
    if (!delivery) throw new NotFoundException('Livrarea nu a fost găsită.');
    return this.serializeDelivery(delivery, true);
  }

  async retryDelivery(actor: Actor, id: string) {
    const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id } });
    if (!delivery) throw new NotFoundException('Livrarea nu a fost găsită.');
    if (delivery.status !== NotificationDeliveryStatus.FAILED) throw new BadRequestException('Doar livrările eșuate pot fi retrimise.');
    await this.audit(this.actorId(actor), 'NOTIFICATION_DELIVERY_RETRIED', delivery.associationId, { deliveryId: id, channel: delivery.channel, type: delivery.type });
    return this.sendTransactionalNotification({
      type: delivery.type,
      channels: [delivery.channel],
      associationId: delivery.associationId,
      recipientUserId: delivery.recipientUserId,
      recipientResidentId: delivery.recipientResidentId,
      recipientEmail: delivery.recipientEmail,
      recipientPhone: delivery.recipientPhone,
      locale: 'ro',
      variables: this.payload(delivery.metadata).variables as Record<string, unknown>,
      relatedEntityType: delivery.relatedEntityType,
      relatedEntityId: delivery.relatedEntityId,
      createdById: this.actorId(actor),
      metadata: { retryOf: id },
    });
  }

  async cancelDelivery(actor: Actor, id: string) {
    const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id } });
    if (!delivery) throw new NotFoundException('Livrarea nu a fost găsită.');
    if (!CANCELLABLE_DELIVERY_STATUSES.includes(delivery.status)) throw new BadRequestException('Livrarea nu mai poate fi anulată.');
    const updated = await this.prisma.notificationDelivery.update({ where: { id }, data: { status: NotificationDeliveryStatus.CANCELLED, reasonCode: 'CANCELLED' } });
    return this.serializeDelivery(updated, true);
  }

  async adminSettings(actor: Actor) {
    const organizationId = this.adminAssociationId(actor);
    const settings = await this.prisma.organizationSetting.findUnique({ where: { organizationId }, select: { notificationSettings: true } });
    return this.defaultAdminSettings(settings?.notificationSettings);
  }

  async updateAdminSettings(actor: Actor, body: unknown) {
    const organizationId = this.adminAssociationId(actor);
    const current = await this.adminSettings(actor);
    const payload = this.payload(body);
    const next = {
      ...current,
      allowAnnouncementEmailNotifications: this.booleanOr(payload.allowAnnouncementEmailNotifications, current.allowAnnouncementEmailNotifications),
      allowAnnouncementSmsNotifications: this.booleanOr(payload.allowAnnouncementSmsNotifications, current.allowAnnouncementSmsNotifications),
      allowInvoiceEmailNotifications: this.booleanOr(payload.allowInvoiceEmailNotifications, current.allowInvoiceEmailNotifications),
      allowPaymentEmailNotifications: this.booleanOr(payload.allowPaymentEmailNotifications, current.allowPaymentEmailNotifications),
      allowRequestEmailNotifications: this.booleanOr(payload.allowRequestEmailNotifications, current.allowRequestEmailNotifications),
    };
    await this.prisma.organizationSetting.upsert({
      where: { organizationId },
      update: { notificationSettings: next as Prisma.InputJsonValue },
      create: { organizationId, notificationSettings: next as Prisma.InputJsonValue },
    });
    return next;
  }

  renderTemplate(templateBody: string, variables: Record<string, unknown>) {
    return templateBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ''));
  }

  private async sendOne(params: SendParams & { channel: NotificationChannel }) {
    if (params.channel === NotificationChannel.IN_APP) return this.createSkipped(params, NotificationProviderType.DISABLED, 'IN_APP_ALREADY_HANDLED');
    const providerType = params.channel === NotificationChannel.EMAIL ? this.emailProviderType() : this.smsProviderType();
    const recipient = params.channel === NotificationChannel.EMAIL ? params.recipientEmail : params.recipientPhone;
    if (!recipient) return this.createSkipped(params, providerType, params.channel === NotificationChannel.EMAIL ? 'RECIPIENT_MISSING_EMAIL' : 'RECIPIENT_MISSING_PHONE');
    if (!(await this.shouldSendToRecipient(params))) return this.createSkipped(params, providerType, 'PREFERENCE_DISABLED');
    if (await this.preventDuplicate(params)) return this.createSkipped(params, providerType, 'DUPLICATE_PREVENTED');
    const template = await this.getActiveTemplate(params.type, params.channel, params.locale || 'ro');
    if (!template) return this.createSkipped(params, providerType, 'TEMPLATE_MISSING');
    const variables = params.variables || {};
    const subject = params.channel === NotificationChannel.EMAIL ? this.renderTemplate(template.subject || '', variables) : null;
    const body = this.renderTemplate(params.channel === NotificationChannel.SMS ? template.smsBody || template.body : template.body, variables);
    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        associationId: params.associationId || null,
        recipientUserId: params.recipientUserId || null,
        recipientResidentId: params.recipientResidentId || null,
        recipientEmail: params.recipientEmail || null,
        recipientPhone: params.recipientPhone ? this.sanitizePhone(params.recipientPhone) : null,
        channel: params.channel,
        type: params.type,
        providerType,
        templateId: template.id,
        status: NotificationDeliveryStatus.PENDING,
        subject,
        bodyPreview: this.preview(body),
        metadata: { ...(params.metadata || {}), variables: this.sanitizeVariables(variables) } as Prisma.InputJsonValue,
        relatedEntityType: params.relatedEntityType || null,
        relatedEntityId: params.relatedEntityId || null,
        createdById: params.createdById || null,
        queuedAt: new Date(),
      },
    });
    if (!this.providerConfigured(params.channel, providerType)) {
      return this.markSkipped(delivery.id, 'PROVIDER_NOT_CONFIGURED');
    }
    const result = params.channel === NotificationChannel.EMAIL
      ? await this.sendEmail({ to: recipient, subject: subject || '', body })
      : await this.sendSms({ to: this.sanitizePhone(recipient), body });
    if (result.success) {
      const sent = await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: NotificationDeliveryStatus.SENT, providerMessageId: result.providerMessageId || null, sentAt: new Date() }, include: this.deliveryInclude() });
      await this.audit(params.createdById || null, 'NOTIFICATION_DELIVERY_SENT', params.associationId || null, { deliveryId: delivery.id, channel: params.channel, type: params.type, providerType });
      return this.serializeDelivery(sent, true);
    }
    const failed = await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: NotificationDeliveryStatus.FAILED, reasonCode: 'PROVIDER_ERROR', errorMessage: result.errorMessage || 'Provider error', failedAt: new Date() }, include: this.deliveryInclude() });
    await this.audit(params.createdById || null, 'NOTIFICATION_DELIVERY_FAILED', params.associationId || null, { deliveryId: delivery.id, channel: params.channel, type: params.type, providerType, reasonCode: 'PROVIDER_ERROR' });
    return this.serializeDelivery(failed, true);
  }

  private async sendEmail(input: { to: string; subject: string; body: string }) {
    const provider = this.emailProviderType();
    if (provider === NotificationProviderType.CONSOLE) {
      if (!this.devMode()) {
        return { success: false, errorMessage: 'Console email provider is disabled outside notification dev mode.' };
      }
      this.logger.log(`[NOTIFICATION_EMAIL] ${JSON.stringify({ to: input.to, subject: input.subject, bodyPreview: this.preview(input.body) })}`);
      return { success: true, providerMessageId: `console-${Date.now()}` };
    }
    if (provider === NotificationProviderType.SMTP) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS } : undefined,
      });
      const sent = await transporter.sendMail({ from: this.fromHeader(), to: input.to, replyTo: process.env.EMAIL_REPLY_TO || undefined, subject: input.subject, text: input.body, html: `<p>${this.escapeHtml(input.body).replace(/\n/g, '<br />')}</p>` });
      return { success: true, providerMessageId: sent.messageId };
    }
    if (provider === NotificationProviderType.RESEND && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const sent = await resend.emails.send({ from: this.fromHeader(), to: input.to, replyTo: process.env.EMAIL_REPLY_TO || undefined, subject: input.subject, text: input.body, html: `<p>${this.escapeHtml(input.body).replace(/\n/g, '<br />')}</p>` });
      return { success: true, providerMessageId: (sent as any).data?.id || undefined };
    }
    return { success: false, errorMessage: `${provider} provider is not implemented/configured in MVP.` };
  }

  private async sendSms(input: { to: string; body: string }) {
    const provider = this.smsProviderType();
    if (provider === NotificationProviderType.CONSOLE) {
      this.logger.log(`[NOTIFICATION_SMS] ${JSON.stringify({ to: input.to, bodyPreview: this.preview(input.body) })}`);
      return { success: true, providerMessageId: `console-sms-${Date.now()}` };
    }
    return { success: false, errorMessage: `${provider} provider is not implemented/configured in MVP.` };
  }

  private async getActiveTemplate(type: TransactionalNotificationType, channel: NotificationChannel, locale: string) {
    return this.prisma.notificationTemplate.findFirst({ where: { type, channel, locale, status: NotificationTemplateStatus.ACTIVE }, orderBy: { updatedAt: 'desc' } });
  }

  private async createSkipped(params: SendParams & { channel: NotificationChannel }, providerType: NotificationProviderType, reasonCode: string) {
    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        associationId: params.associationId || null,
        recipientUserId: params.recipientUserId || null,
        recipientResidentId: params.recipientResidentId || null,
        recipientEmail: params.recipientEmail || null,
        recipientPhone: params.recipientPhone ? this.sanitizePhone(params.recipientPhone) : null,
        channel: params.channel,
        type: params.type,
        providerType,
        status: NotificationDeliveryStatus.SKIPPED,
        reasonCode,
        metadata: { ...(params.metadata || {}), variables: this.sanitizeVariables(params.variables || {}) } as Prisma.InputJsonValue,
        relatedEntityType: params.relatedEntityType || null,
        relatedEntityId: params.relatedEntityId || null,
        createdById: params.createdById || null,
      },
      include: this.deliveryInclude(),
    });
    return this.serializeDelivery(delivery, true);
  }

  private async markSkipped(id: string, reasonCode: string) {
    const delivery = await this.prisma.notificationDelivery.update({ where: { id }, data: { status: NotificationDeliveryStatus.SKIPPED, reasonCode }, include: this.deliveryInclude() });
    return this.serializeDelivery(delivery, true);
  }

  private async shouldSendToRecipient(params: SendParams) {
    if (CRITICAL_TYPES.has(params.type)) return true;
    if (!params.recipientUserId || !params.associationId) return true;
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId_organizationId: { userId: params.recipientUserId, organizationId: params.associationId } } });
    if (!pref) return true;
    if (params.channels.includes(NotificationChannel.EMAIL)) return pref.emailEnabled;
    if (params.channels.includes(NotificationChannel.SMS)) return pref.smsEnabled;
    return true;
  }

  private async preventDuplicate(params: SendParams & { channel: NotificationChannel }) {
    if (!params.relatedEntityType || !params.relatedEntityId) return false;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.notificationDelivery.findFirst({
      where: {
        type: params.type,
        channel: params.channel,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
        status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.QUEUED, NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED] },
        createdAt: { gte: since },
        OR: [
          params.recipientUserId ? { recipientUserId: params.recipientUserId } : {},
          params.recipientResidentId ? { recipientResidentId: params.recipientResidentId } : {},
          params.recipientEmail ? { recipientEmail: params.recipientEmail } : {},
          params.recipientPhone ? { recipientPhone: this.sanitizePhone(params.recipientPhone) } : {},
        ],
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  private deliveryWhere(query: Record<string, unknown>, associationId?: string | null): Prisma.NotificationDeliveryWhereInput {
    const channel = this.optionalEnum(query.channel, NotificationChannel);
    const status = this.optionalEnum(query.status, NotificationDeliveryStatus);
    const type = this.optionalEnum(query.type, TransactionalNotificationType);
    const providerType = this.optionalEnum(query.providerType, NotificationProviderType);
    const recipient = this.optionalString(query.recipient);
    return {
      ...(associationId ? { associationId } : this.optionalString(query.associationId) ? { associationId: this.optionalString(query.associationId) } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(providerType ? { providerType } : {}),
      ...(this.boolean(query.failedOnly) ? { status: NotificationDeliveryStatus.FAILED } : {}),
      ...(this.boolean(query.skippedOnly) ? { status: NotificationDeliveryStatus.SKIPPED } : {}),
      ...(recipient ? { OR: [{ recipientEmail: { contains: recipient, mode: 'insensitive' } }, { recipientPhone: { contains: recipient } }] } : {}),
    };
  }

  private deliveryInclude() {
    return {
      association: { select: { id: true, name: true, legalName: true, fiscalCode: true } },
      recipientUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      recipientResident: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      template: { select: { id: true, name: true, type: true, channel: true, locale: true } },
    } satisfies Prisma.NotificationDeliveryInclude;
  }

  private serializeDelivery(delivery: any, includeMetadata: boolean) {
    return {
      id: delivery.id,
      associationId: delivery.associationId,
      association: delivery.association || null,
      recipientUser: delivery.recipientUser || null,
      recipientResident: delivery.recipientResident || null,
      recipientEmail: delivery.recipientEmail,
      recipientPhone: delivery.recipientPhone,
      channel: delivery.channel,
      type: delivery.type,
      providerType: delivery.providerType,
      template: delivery.template || null,
      status: delivery.status,
      reasonCode: delivery.reasonCode,
      subject: delivery.subject,
      bodyPreview: delivery.bodyPreview,
      providerMessageId: delivery.providerMessageId,
      errorMessage: delivery.errorMessage,
      metadata: includeMetadata ? delivery.metadata : undefined,
      relatedEntityType: delivery.relatedEntityType,
      relatedEntityId: delivery.relatedEntityId,
      queuedAt: delivery.queuedAt,
      sentAt: delivery.sentAt,
      deliveredAt: delivery.deliveredAt,
      failedAt: delivery.failedAt,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }

  private async ensureSystemTemplates() {
    if (this.seeded) return;
    for (const template of SYSTEM_TEMPLATES) {
      await this.prisma.notificationTemplate.upsert({
        where: { id: `system-${template.type}-${template.channel}-ro` },
        update: { name: template.name, subject: template.subject || null, body: template.body, smsBody: template.channel === NotificationChannel.SMS ? template.body : null, status: NotificationTemplateStatus.ACTIVE, isSystem: true },
        create: { id: `system-${template.type}-${template.channel}-ro`, ...template, locale: 'ro', smsBody: template.channel === NotificationChannel.SMS ? template.body : null, status: NotificationTemplateStatus.ACTIVE, isSystem: true },
      }).catch(async () => {
        const exists = await this.prisma.notificationTemplate.findFirst({ where: { type: template.type, channel: template.channel, locale: 'ro', status: NotificationTemplateStatus.ACTIVE } });
        if (!exists) await this.prisma.notificationTemplate.create({ data: { ...template, locale: 'ro', smsBody: template.channel === NotificationChannel.SMS ? template.body : null, status: NotificationTemplateStatus.ACTIVE, isSystem: true } });
      });
    }
    this.seeded = true;
  }

  private async assertSingleActive(type: TransactionalNotificationType, channel: NotificationChannel, locale: string, status: NotificationTemplateStatus, excludeId?: string) {
    if (status !== NotificationTemplateStatus.ACTIVE) return;
    const existing = await this.prisma.notificationTemplate.findFirst({ where: { type, channel, locale, status, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (existing) throw new BadRequestException('Există deja un template ACTIVE pentru acest type/channel/locale.');
  }

  private providerConfigured(channel: NotificationChannel, provider: NotificationProviderType) {
    if (!this.externalEnabled() && !this.devMode()) return false;
    if (provider === NotificationProviderType.DISABLED) return false;
    if (provider === NotificationProviderType.CONSOLE) return this.devMode();
    if (provider === NotificationProviderType.SMTP) return this.smtpConfigured();
    if (provider === NotificationProviderType.RESEND) return this.resendConfigured();
    if (provider === NotificationProviderType.TWILIO) return this.twilioConfigured();
    if (provider === NotificationProviderType.CUSTOM_HTTP) return channel === NotificationChannel.SMS && this.customSmsConfigured();
    return false;
  }

  private emailHealth() {
    const providerType = this.emailProviderType();
    return { providerType, configured: this.providerConfigured(NotificationChannel.EMAIL, providerType), status: providerType === NotificationProviderType.DISABLED ? 'DISABLED' : this.providerConfigured(NotificationChannel.EMAIL, providerType) ? 'OK' : 'ERROR', fromAddress: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || null, fromName: process.env.EMAIL_FROM_NAME || 'Espace' };
  }

  private smsHealth() {
    const providerType = this.smsProviderType();
    return { providerType, configured: this.providerConfigured(NotificationChannel.SMS, providerType), status: providerType === NotificationProviderType.DISABLED ? 'DISABLED' : this.providerConfigured(NotificationChannel.SMS, providerType) ? 'OK' : 'ERROR', from: process.env.SMS_FROM || process.env.TWILIO_FROM_NUMBER || null };
  }

  private emailProviderType() {
    const explicit = this.optionalEnum((process.env.EMAIL_PROVIDER || '').toUpperCase(), NotificationProviderType);
    if (explicit && explicit !== NotificationProviderType.CONSOLE) return explicit;
    if (this.resendConfigured()) return NotificationProviderType.RESEND;
    if (this.smtpConfigured()) return NotificationProviderType.SMTP;
    if (explicit === NotificationProviderType.CONSOLE) return this.devMode() ? NotificationProviderType.CONSOLE : NotificationProviderType.DISABLED;
    return this.isProduction() ? NotificationProviderType.DISABLED : NotificationProviderType.CONSOLE;
  }

  private smsProviderType() {
    const explicit = this.optionalEnum((process.env.SMS_PROVIDER || '').toUpperCase(), NotificationProviderType);
    if (explicit && explicit !== NotificationProviderType.CONSOLE) return explicit;
    if (this.twilioConfigured()) return NotificationProviderType.TWILIO;
    if (this.customSmsConfigured()) return NotificationProviderType.CUSTOM_HTTP;
    if (explicit === NotificationProviderType.CONSOLE) return this.devMode() ? NotificationProviderType.CONSOLE : NotificationProviderType.DISABLED;
    return this.isProduction() ? NotificationProviderType.DISABLED : NotificationProviderType.CONSOLE;
  }

  private externalEnabled() {
    const configured = String(process.env.NOTIFICATIONS_EXTERNAL_ENABLED || '').trim().toLowerCase();
    if (configured === 'true') return true;
    if (configured === 'false') {
      if (this.isProduction() && this.hasRealDeliveryConfigured()) {
        this.logger.warn('NOTIFICATIONS_EXTERNAL_ENABLED=false was overridden because real delivery providers are configured in production.');
        return true;
      }
      return false;
    }
    return this.hasRealDeliveryConfigured();
  }

  private devMode() {
    const configured = String(process.env.NOTIFICATIONS_DEV_MODE || '').trim().toLowerCase();
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    return !this.isProduction();
  }

  private fromHeader() {
    const name = process.env.EMAIL_FROM_NAME || 'Espace';
    const address = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_FROM || 'no-reply@example.com';
    return `${name} <${address}>`;
  }

  private isProduction() {
    return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  }

  private resendConfigured() {
    return Boolean(process.env.RESEND_API_KEY);
  }

  private smtpConfigured() {
    return Boolean(process.env.SMTP_HOST && (process.env.SMTP_PASSWORD || process.env.SMTP_PASS));
  }

  private twilioConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  }

  private customSmsConfigured() {
    return Boolean(process.env.CUSTOM_SMS_ENDPOINT && process.env.CUSTOM_SMS_API_KEY);
  }

  private hasRealDeliveryConfigured() {
    return this.resendConfigured() || this.smtpConfigured() || this.twilioConfigured() || this.customSmsConfigured();
  }

  private adminAssociationId(actor: Actor) {
    if (String(actor.role || '').toUpperCase() !== Role.ADMIN) throw new ForbiddenException('Admin access required');
    if (!actor.organizationId) throw new ForbiddenException('Organization context missing');
    return actor.organizationId;
  }

  private defaultAdminSettings(value: unknown) {
    return {
      allowAnnouncementEmailNotifications: true,
      allowAnnouncementSmsNotifications: false,
      allowInvoiceEmailNotifications: true,
      allowPaymentEmailNotifications: true,
      allowRequestEmailNotifications: true,
      ...this.payload(value),
    };
  }

  private exampleVariables() {
    return { residentName: 'Ion Popescu', staffName: 'Ana Rusu', associationName: 'A.P.C. A0123-0940', associationCode: 'A0123-0940', apartmentNumber: '24', invoiceNumber: 'INV-001', amount: '1200', currency: 'MDL', dueDate: '2026-06-01', inviteLink: 'https://app.espace.md/ro/invite/***', resetLink: 'https://app.espace.md/ro/reset-password/***', requestNumber: 'REQ-12', announcementTitle: 'Lucrări urgente', meterType: 'Apă rece', periodMonth: '2026-05', supportEmail: 'support@example.com' };
  }

  private preview(body: string) {
    return this.maskSensitive(body).slice(0, 500);
  }

  private maskSensitive(value: string) {
    return value
      .replace(/(invite\/)[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/g, '$1***')
      .replace(/(staff-invite\/)[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/g, '$1***')
      .replace(/(reset-password[/?][^\s]+)/g, 'reset-password/***');
  }

  private sanitizeVariables(variables: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(variables).map(([key, value]) => [/token/i, /Link$/].some((pattern) => pattern.test(key)) ? [key, this.maskSensitive(String(value || ''))] : [key, value]));
  }

  private sanitizePhone(value: string) {
    return value.replace(/[^\d+]/g, '');
  }

  private actorId(actor: Actor) {
    return actor?.id || actor?.sub || null;
  }

  private payload(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private requiredString(value: unknown, message: string) {
    const text = this.optionalString(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private requiredEnum<T extends Record<string, string>>(value: unknown, source: T, message: string): T[keyof T] {
    const result = this.optionalEnum(value, source);
    if (!result) throw new BadRequestException(message);
    return result;
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, source: T): T[keyof T] | null {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    return Object.values(source).includes(normalized) ? (normalized as T[keyof T]) : null;
  }

  private boolean(value: unknown) {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private booleanOr(value: unknown, fallback: boolean) {
    return value === undefined ? fallback : this.boolean(value);
  }

  private escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private async audit(actorUserId: string | null, action: string, associationId: string | null, metadata: Record<string, unknown>) {
    if (!associationId) return;
    await this.prisma.auditLog.create({
      data: { organizationId: associationId, userId: actorUserId || undefined, action, entityType: 'NOTIFICATION', entityId: String(metadata.deliveryId || metadata.templateId || associationId), description: 'Eveniment notificare externă.', newValuesJson: metadata as Prisma.InputJsonValue },
    }).catch(() => undefined);
  }
}
