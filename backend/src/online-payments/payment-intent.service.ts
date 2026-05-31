import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  OnlinePaymentProviderStatus,
  OnlinePaymentProviderType,
  PaymentIntentEventType,
  PaymentIntentSource,
  PaymentIntentStatus,
  PaymentMethodType,
  PaymentProvider,
  Prisma,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MvpUser } from '../security/mvp-auth.guard';
import { PaymentProviderService } from './payment-provider.service';

const INTERNAL_INVOICE_NOTE_TITLE = 'Internal invoices metadata';
const ACTIVE_INTENT_STATUSES: PaymentIntentStatus[] = [
  PaymentIntentStatus.CREATED,
  PaymentIntentStatus.VIEWED,
  PaymentIntentStatus.PENDING_PROVIDER,
  PaymentIntentStatus.REQUIRES_ACTION,
  PaymentIntentStatus.PROCESSING,
];

type InternalInvoice = {
  id: string;
  invoiceId: string;
  apartmentId: string;
  invoiceNumber: string;
  billingMonth: string;
  status: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate?: string | null;
  apartment?: any;
  primaryContact?: any;
};

@Injectable()
export class PaymentIntentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderService,
    private readonly audit: AuditService,
  ) {}

  async getSettings(user: MvpUser) {
    return this.settingsForAssociation(user.organizationId);
  }

  async updateSettings(user: MvpUser, body: unknown) {
    const payload = this.payload(body);
    const current = await this.prisma.associationPaymentSettings.findUnique({ where: { associationId: user.organizationId } });
    let providerId = typeof payload.providerId === 'string' && payload.providerId.trim() ? payload.providerId.trim() : current?.providerId || null;
    if (providerId) {
      const provider = await this.prisma.onlinePaymentProvider.findUnique({ where: { id: providerId } });
      if (!provider) throw new BadRequestException('Providerul selectat nu există.');
      if (payload.onlinePaymentsEnabled === true && !this.providerCanBeSelected(provider)) {
        throw new BadRequestException('Providerul selectat nu permite activarea plăților online.');
      }
    }
    const data = {
      providerId,
      onlinePaymentsEnabled: Boolean(payload.onlinePaymentsEnabled ?? current?.onlinePaymentsEnabled ?? false),
      allowResidentOnlinePayments: Boolean(payload.allowResidentOnlinePayments ?? current?.allowResidentOnlinePayments ?? false),
      allowPartialOnlinePayments: Boolean(payload.allowPartialOnlinePayments ?? current?.allowPartialOnlinePayments ?? false),
      minPaymentAmount: this.optionalNumber(payload.minPaymentAmount, current?.minPaymentAmount ?? null),
      maxPaymentAmount: this.optionalNumber(payload.maxPaymentAmount, current?.maxPaymentAmount ?? null),
      defaultCurrency: BillingCurrency.MDL,
      paymentInstructions: typeof payload.paymentInstructions === 'string' ? payload.paymentInstructions.trim() || null : current?.paymentInstructions ?? null,
      testModeEnabled: Boolean(payload.testModeEnabled ?? current?.testModeEnabled ?? false),
      updatedById: user.id,
    };
    if (data.maxPaymentAmount !== null && data.minPaymentAmount !== null && data.maxPaymentAmount < data.minPaymentAmount) {
      throw new BadRequestException('Suma maximă nu poate fi mai mică decât suma minimă.');
    }
    const updated = await this.prisma.associationPaymentSettings.upsert({
      where: { associationId: user.organizationId },
      create: { ...data, associationId: user.organizationId, createdById: user.id },
      update: data,
      include: { provider: true },
    });
    await this.audit.createLog({
      associationId: user.organizationId,
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_SETTINGS_UPDATED',
      entityType: 'ASSOCIATION_PAYMENT_SETTINGS',
      entityId: updated.id,
      title: 'Setări plăți online actualizate',
      message: 'Setările de plăți online ale asociației au fost actualizate.',
      severity: 'WARNING',
      metadata: { providerId, onlinePaymentsEnabled: updated.onlinePaymentsEnabled },
      beforeSnapshot: current || {},
      afterSnapshot: updated,
    }).catch(() => undefined);
    return this.serializeSettings(updated);
  }

  async listIntents(context: { user: MvpUser; scope: 'ADMIN' | 'SUPERADMIN' | 'RESIDENT'; query?: Record<string, unknown> }) {
    const query = context.query || {};
    const where: Prisma.PaymentIntentWhereInput = {};
    if (context.scope === 'ADMIN') where.organizationId = context.user.organizationId;
    if (context.scope === 'RESIDENT') {
      const scope = await this.residentScope(context.user);
      where.organizationId = context.user.organizationId;
      where.apartmentId = { in: scope.apartmentIds.length ? scope.apartmentIds : ['__none__'] };
    }
    if (typeof query.status === 'string' && query.status.trim()) where.status = query.status.trim().toUpperCase() as PaymentIntentStatus;
    if (typeof query.providerType === 'string' && query.providerType.trim()) where.providerType = query.providerType.trim().toUpperCase() as OnlinePaymentProviderType;
    if (typeof query.paymentMethodType === 'string' && query.paymentMethodType.trim()) where.paymentMethodType = query.paymentMethodType.trim().toUpperCase() as PaymentMethodType;
    if (typeof query.invoiceId === 'string' && query.invoiceId.trim()) {
      where.OR = [{ invoiceId: query.invoiceId.trim() }, { metadataJson: { path: ['internalInvoiceId'], equals: query.invoiceId.trim() } }];
    }
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const [items, total] = await Promise.all([
      this.prisma.paymentIntent.findMany({
        where,
        include: this.intentInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentIntent.count({ where }),
    ]);
    return { items: items.map((item) => this.serializeIntent(item)), meta: { page, limit, total } };
  }

  async getIntent(id: string, context: { user: MvpUser; scope: 'ADMIN' | 'SUPERADMIN' | 'RESIDENT' }) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: await this.intentAccessWhere(id, context),
      include: { ...this.intentInclude(), events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } } } } },
    });
    if (!intent) throw new NotFoundException('Intenția de plată nu a fost găsită.');
    return { intent: this.serializeIntent(intent), events: intent.events };
  }

  async listInvoiceIntents(user: MvpUser, invoiceId: string) {
    const invoice = await this.findInternalInvoice(user.organizationId, invoiceId);
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const rows = await this.prisma.paymentIntent.findMany({
      where: { organizationId: user.organizationId, metadataJson: { path: ['internalInvoiceId'], equals: invoice.invoiceId } },
      include: this.intentInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return { invoice: this.invoiceSummary(invoice), items: rows.map((row) => this.serializeIntent(row)) };
  }

  async createAdminIntent(user: MvpUser, invoiceId: string, body: unknown) {
    const invoice = await this.findInternalInvoice(user.organizationId, invoiceId);
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    return this.createIntentForInvoice({
      user,
      invoice,
      source: PaymentIntentSource.ADMIN_CREATED,
      requestedByResident: false,
      body,
    });
  }

  async createResidentIntent(user: MvpUser, invoiceId: string, body: unknown) {
    const scope = await this.residentScope(user);
    const invoice = await this.findInternalInvoice(user.organizationId, invoiceId);
    if (!invoice || !scope.apartmentIds.includes(invoice.apartmentId)) throw new NotFoundException('Factura nu a fost găsită.');
    return this.createIntentForInvoice({
      user,
      invoice,
      source: PaymentIntentSource.RESIDENT_PORTAL,
      requestedByResident: true,
      residentId: scope.residentId,
      body,
    });
  }

  async cancelIntent(id: string, reason: string, context: { user: MvpUser; scope: 'ADMIN' | 'SUPERADMIN' | 'RESIDENT' }) {
    if (!reason?.trim()) throw new BadRequestException('Motivul anulării este obligatoriu.');
    const intent = await this.prisma.paymentIntent.findFirst({ where: await this.intentAccessWhere(id, context), include: this.intentInclude() });
    if (!intent) throw new NotFoundException('Intenția de plată nu a fost găsită.');
    if (!ACTIVE_INTENT_STATUSES.includes(intent.status)) throw new BadRequestException('Această intenție de plată nu mai poate fi anulată.');
    const updated = await this.prisma.paymentIntent.update({
      where: { id },
      data: {
        status: PaymentIntentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: context.user.id,
        cancellationReason: reason.trim(),
      },
      include: this.intentInclude(),
    });
    await this.addIntentEvent(updated.id, updated.organizationId, context.user.id, PaymentIntentEventType.INTENT_CANCELLED, 'Intent anulat', reason.trim(), { reason });
    await this.audit.createLog({
      associationId: updated.organizationId,
      actorUserId: context.user.id,
      actorRole: context.user.role,
      action: 'PAYMENT_INTENT_CANCELLED',
      entityType: 'PAYMENT_INTENT',
      entityId: updated.id,
      title: 'Intenție de plată anulată',
      message: reason.trim(),
      metadata: { paymentIntentId: updated.id, invoiceId: this.internalInvoiceId(updated), amount: updated.amount, currency: updated.currency, status: updated.status, reason },
    }).catch(() => undefined);
    return { intent: this.serializeIntent(updated), message: 'Intenția de plată a fost anulată.' };
  }

  async expireOldIntents(user: MvpUser) {
    const now = new Date();
    const rows = await this.prisma.paymentIntent.findMany({
      where: { organizationId: user.organizationId, status: { in: ACTIVE_INTENT_STATUSES }, expiresAt: { lt: now } },
      select: { id: true, organizationId: true },
      take: 100,
    });
    for (const row of rows) {
      await this.prisma.paymentIntent.update({ where: { id: row.id }, data: { status: PaymentIntentStatus.EXPIRED } });
      await this.addIntentEvent(row.id, row.organizationId, user.id, PaymentIntentEventType.INTENT_EXPIRED, 'Intent expirat', 'Intenția de plată a expirat automat la verificare.', {});
    }
    return { expiredCount: rows.length };
  }

  private async createIntentForInvoice(input: { user: MvpUser; invoice: InternalInvoice; source: PaymentIntentSource; requestedByResident: boolean; residentId?: string; body: unknown }) {
    const payload = this.payload(input.body);
    this.assertInvoicePayable(input.invoice);
    const settings = await this.settingsForAssociation(input.user.organizationId);
    if (input.requestedByResident && (!settings.onlinePaymentsEnabled || !settings.allowResidentOnlinePayments)) {
      throw new BadRequestException('Plățile online vor fi disponibile ulterior.');
    }
    const defaultAmount = Number(input.invoice.balanceAmount || 0);
    const amount = payload.amount === undefined || payload.amount === null || payload.amount === '' ? defaultAmount : Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Suma trebuie să fie mai mare decât 0.');
    if (amount > defaultAmount) throw new BadRequestException('Suma nu poate depăși soldul facturii.');
    if (amount < defaultAmount && !settings.allowPartialOnlinePayments) throw new BadRequestException('Plățile online parțiale nu sunt activate.');
    if (settings.minPaymentAmount !== null && settings.minPaymentAmount !== undefined && amount < Number(settings.minPaymentAmount)) throw new BadRequestException('Suma este sub minimul permis.');
    if (settings.maxPaymentAmount !== null && settings.maxPaymentAmount !== undefined && amount > Number(settings.maxPaymentAmount)) throw new BadRequestException('Suma depășește maximul permis.');
    const method = this.paymentMethod(payload.paymentMethodType || payload.paymentMethod || (settings.testModeEnabled ? PaymentMethodType.TEST_METHOD : PaymentMethodType.BPAY));
    const provider = await this.resolveProvider(settings, method);
    if (method === PaymentMethodType.TEST_METHOD && !settings.testModeEnabled && input.user.role !== Role.SUPERADMIN) {
      throw new BadRequestException('Providerul de test nu este activat pentru această asociație.');
    }
    const duplicate = await this.findDuplicate(input.user.organizationId, input.invoice.invoiceId, amount, input.residentId || null, input.source);
    if (duplicate) return { intent: this.serializeIntent(duplicate), duplicate: true, message: 'Există deja o intenție de plată activă pentru această factură.' };

    const providerResult = await this.providers.initializePaymentIntent(null, provider);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const idempotencyKey = this.buildIdempotencyKey(input.user.organizationId, input.invoice.invoiceId, input.residentId || input.source, amount);
    const created = await this.prisma.paymentIntent.create({
      data: {
        organizationId: input.user.organizationId,
        apartmentId: input.invoice.apartmentId,
        residentId: input.residentId || input.invoice.primaryContact?.id || null,
        createdByUserId: input.user.id,
        providerId: provider?.id || null,
        provider: this.legacyProvider(provider?.type || OnlinePaymentProviderType.MANUAL_TEST),
        providerType: provider?.type || OnlinePaymentProviderType.MANUAL_TEST,
        source: input.source,
        paymentMethodType: method,
        status: providerResult.status,
        currency: BillingCurrency.MDL,
        amount,
        description: `Intenție de plată pentru factura ${input.invoice.invoiceNumber}`,
        idempotencyKey,
        expiresAt,
        metadataJson: {
          internalInvoiceId: input.invoice.invoiceId,
          invoiceNumber: input.invoice.invoiceNumber,
          billingMonth: input.invoice.billingMonth,
          providerReason: providerResult.reason,
          realMoneyProcessed: false,
        },
      },
      include: this.intentInclude(),
    });
    await this.addIntentEvent(created.id, created.organizationId, input.user.id, PaymentIntentEventType.INTENT_CREATED, 'Intent creat', providerResult.message, {
      invoiceId: input.invoice.invoiceId,
      amount,
      providerType: created.providerType,
      noRealPayment: true,
    });
    await this.audit.createLog({
      associationId: created.organizationId,
      actorUserId: input.user.id,
      actorRole: input.user.role,
      action: 'PAYMENT_INTENT_CREATED',
      entityType: 'PAYMENT_INTENT',
      entityId: created.id,
      title: 'Intenție de plată creată',
      message: `A fost creată o intenție de plată pentru factura ${input.invoice.invoiceNumber}.`,
      metadata: { paymentIntentId: created.id, invoiceId: input.invoice.invoiceId, amount, currency: created.currency, status: created.status, realMoneyProcessed: false },
    }).catch(() => undefined);
    return { intent: this.serializeIntent(created), duplicate: false, message: providerResult.message };
  }

  private async settingsForAssociation(associationId: string) {
    await this.providers.ensurePresetProviders();
    let settings = await this.prisma.associationPaymentSettings.findUnique({ where: { associationId }, include: { provider: true } });
    if (!settings) {
      const defaultProvider = await this.providers.getDefaultProvider();
      settings = await this.prisma.associationPaymentSettings.create({
        data: {
          associationId,
          providerId: defaultProvider?.id || null,
          onlinePaymentsEnabled: false,
          allowResidentOnlinePayments: false,
          allowPartialOnlinePayments: false,
          defaultCurrency: BillingCurrency.MDL,
          testModeEnabled: String(process.env.PAYMENTS_TEST_MODE || 'true').toLowerCase() === 'true',
        },
        include: { provider: true },
      });
    }
    return this.serializeSettings(settings);
  }

  private serializeSettings(settings: any) {
    const provider = settings.provider ? this.providers.safeProvider(settings.provider) : null;
    return {
      id: settings.id,
      associationId: settings.associationId,
      onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
      providerId: settings.providerId,
      provider,
      allowResidentOnlinePayments: settings.allowResidentOnlinePayments,
      allowPartialOnlinePayments: settings.allowPartialOnlinePayments,
      minPaymentAmount: settings.minPaymentAmount,
      maxPaymentAmount: settings.maxPaymentAmount,
      defaultCurrency: settings.defaultCurrency,
      paymentInstructions: settings.paymentInstructions,
      testModeEnabled: settings.testModeEnabled,
      providerHealth: provider ? this.providers.providerHealth(settings.provider) : null,
      message: settings.onlinePaymentsEnabled ? 'Plățile online sunt pregătite în mod skeleton.' : 'Plățile online sunt în pregătire.',
    };
  }

  private async readInternalInvoiceMetadata(organizationId: string): Promise<InternalInvoice[]> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: INTERNAL_INVOICE_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return [];
    try {
      const parsed = JSON.parse(note.content);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  private async findInternalInvoice(organizationId: string, id: string) {
    return (await this.readInternalInvoiceMetadata(organizationId)).find((item) => item.id === id || item.invoiceId === id) || null;
  }

  private assertInvoicePayable(invoice: InternalInvoice) {
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      throw new BadRequestException('Factura nu permite creare de intenție de plată.');
    }
    if (!['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) {
      throw new BadRequestException('Factura nu este emisă pentru plată.');
    }
    if (Number(invoice.balanceAmount || 0) <= 0) throw new BadRequestException('Factura nu are sold de achitat.');
  }

  private async findDuplicate(organizationId: string, invoiceId: string, amount: number, residentId: string | null, source: PaymentIntentSource) {
    return this.prisma.paymentIntent.findFirst({
      where: {
        organizationId,
        status: { in: ACTIVE_INTENT_STATUSES },
        amount,
        source,
        ...(residentId ? { residentId } : {}),
        metadataJson: { path: ['internalInvoiceId'], equals: invoiceId },
      },
      include: this.intentInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildIdempotencyKey(associationId: string, invoiceId: string, actor: string, amount: number) {
    return [associationId, invoiceId, actor, amount.toFixed(2), new Date().toISOString().slice(0, 10)].join(':');
  }

  private async addIntentEvent(paymentIntentId: string, associationId: string, actorUserId: string | null, eventType: PaymentIntentEventType, title: string, message: string, metadata: Record<string, unknown>) {
    return this.prisma.paymentIntentEvent.create({
      data: { paymentIntentId, associationId, actorUserId, eventType, title, message, metadata: metadata as Prisma.InputJsonObject },
    });
  }

  private async residentScope(user: MvpUser) {
    if (user.role !== Role.RESIDENT) throw new ForbiddenException('Resident access required');
    const profiles = await this.prisma.residentProfile.findMany({
      where: { userId: user.id, organizationId: user.organizationId },
      include: { apartmentResidents: true },
    });
    const apartmentIds = new Set<string>();
    profiles.forEach((profile) => {
      if (profile.apartmentId) apartmentIds.add(profile.apartmentId);
      profile.apartmentResidents.forEach((item) => apartmentIds.add(item.apartmentId));
    });
    return { residentId: profiles[0]?.id || null, apartmentIds: [...apartmentIds] };
  }

  private async intentAccessWhere(id: string, context: { user: MvpUser; scope: 'ADMIN' | 'SUPERADMIN' | 'RESIDENT' }) {
    if (context.scope === 'SUPERADMIN') return { id };
    if (context.scope === 'ADMIN') return { id, organizationId: context.user.organizationId };
    const scope = await this.residentScope(context.user);
    return { id, organizationId: context.user.organizationId, apartmentId: { in: scope.apartmentIds.length ? scope.apartmentIds : ['__none__'] } };
  }

  private intentInclude() {
    return {
      providerConfig: true,
      apartment: { select: { id: true, number: true, staircase: { select: { name: true } }, building: { select: { name: true } } } },
      resident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      organization: { select: { id: true, name: true, legalName: true, fiscalCode: true } },
    } satisfies Prisma.PaymentIntentInclude;
  }

  private serializeIntent(intent: any) {
    const metadata = intent.metadataJson && typeof intent.metadataJson === 'object' ? intent.metadataJson : {};
    const expired = intent.expiresAt && ACTIVE_INTENT_STATUSES.includes(intent.status) && new Date(intent.expiresAt) < new Date();
    return {
      id: intent.id,
      associationId: intent.organizationId,
      invoiceId: intent.invoiceId || metadata.internalInvoiceId || null,
      invoiceNumber: metadata.invoiceNumber || null,
      billingMonth: metadata.billingMonth || null,
      apartmentId: intent.apartmentId,
      apartment: intent.apartment ? { id: intent.apartment.id, apartmentNumber: intent.apartment.number, staircase: intent.apartment.staircase?.name || null, building: intent.apartment.building?.name || null } : null,
      resident: intent.resident ? { id: intent.resident.id, fullName: [intent.resident.firstName, intent.resident.lastName].filter(Boolean).join(' ').trim() || intent.resident.email || 'Resident', email: intent.resident.email, phone: intent.resident.phone } : null,
      association: intent.organization ? { id: intent.organization.id, shortName: intent.organization.name, legalName: intent.organization.legalName || intent.organization.name, associationCode: intent.organization.fiscalCode || null } : null,
      providerId: intent.providerId,
      providerType: intent.providerType || this.providerTypeFromLegacy(intent.provider),
      provider: intent.providerConfig ? this.providers.safeProvider(intent.providerConfig) : null,
      source: intent.source || null,
      paymentMethodType: intent.paymentMethodType || null,
      status: expired ? PaymentIntentStatus.EXPIRED : intent.status,
      currency: intent.currency,
      amount: Number(intent.amount || 0),
      description: intent.description || null,
      providerCheckoutUrl: null,
      providerReference: intent.providerReference || intent.providerPaymentId || null,
      expiresAt: intent.expiresAt,
      cancelledAt: intent.cancelledAt,
      cancellationReason: intent.cancellationReason,
      failureReason: intent.failureReason,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
      message: expired ? 'Intenția de plată a expirat.' : this.intentMessage(intent.status),
      realMoneyProcessed: false,
    };
  }

  private invoiceSummary(invoice: InternalInvoice) {
    return {
      id: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      status: invoice.status,
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      balanceAmount: Number(invoice.balanceAmount || 0),
      currency: invoice.currency || 'MDL',
    };
  }

  private async resolveProvider(settings: any, method: PaymentMethodType) {
    if (method === PaymentMethodType.TEST_METHOD) {
      return this.prisma.onlinePaymentProvider.findFirst({ where: { type: OnlinePaymentProviderType.MANUAL_TEST } });
    }
    if (settings.providerId) return this.prisma.onlinePaymentProvider.findUnique({ where: { id: settings.providerId } });
    return this.providers.getDefaultProvider();
  }

  private providerCanBeSelected(provider: any) {
    return [OnlinePaymentProviderStatus.TESTING, OnlinePaymentProviderStatus.ACTIVE].includes(provider.status);
  }

  private paymentMethod(value: unknown) {
    const normalized = String(value || '').toUpperCase();
    if (!Object.values(PaymentMethodType).includes(normalized as PaymentMethodType)) throw new BadRequestException('Metoda de plată nu este validă.');
    return normalized as PaymentMethodType;
  }

  private legacyProvider(type: OnlinePaymentProviderType) {
    if (type === OnlinePaymentProviderType.MAIB) return PaymentProvider.MAIB;
    if (type === OnlinePaymentProviderType.PAYNET) return PaymentProvider.PAYNET;
    return PaymentProvider.MANUAL_BANK_TRANSFER;
  }

  private providerTypeFromLegacy(provider: PaymentProvider) {
    if (provider === PaymentProvider.MAIB) return OnlinePaymentProviderType.MAIB;
    if (provider === PaymentProvider.PAYNET) return OnlinePaymentProviderType.PAYNET;
    return OnlinePaymentProviderType.MANUAL_TEST;
  }

  private internalInvoiceId(intent: any) {
    const metadata = intent.metadataJson && typeof intent.metadataJson === 'object' ? intent.metadataJson : {};
    return metadata.internalInvoiceId || intent.invoiceId || null;
  }

  private intentMessage(status: PaymentIntentStatus) {
    if (status === PaymentIntentStatus.PENDING_PROVIDER) return 'Plata online nu este încă activă. Această intenție nu procesează bani.';
    if (status === PaymentIntentStatus.CREATED) return 'Intenție creată. Nu se procesează bani în ES-139.';
    if (status === PaymentIntentStatus.VIEWED) return 'Intenție vizualizată. Nu se procesează bani.';
    if (status === PaymentIntentStatus.CANCELLED) return 'Intenția a fost anulată.';
    if (status === PaymentIntentStatus.EXPIRED) return 'Intenția a expirat.';
    return 'Plățile online sunt în pregătire.';
  }

  private optionalNumber(value: unknown, fallback: number | null) {
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException('Suma configurată nu este validă.');
    return number;
  }

  private payload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }
}
