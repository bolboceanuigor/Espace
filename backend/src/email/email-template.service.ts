import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

type TemplateVars = Record<string, string | number | null | undefined>;
type TemplateTargetRole = 'ADMIN' | 'RESIDENT' | 'TEAM' | 'ALL';

const DEFAULT_TEMPLATES: Array<{
  key: string;
  name: string;
  targetRole: TemplateTargetRole;
  subject: string;
  body: string;
}> = [
  {
    key: 'admin_invitation',
    name: 'Admin invitation',
    targetRole: 'ADMIN',
    subject: 'Invitatie administrator - {{organizationName}}',
    body: 'Salut {{userName}},\nAi fost invitat ca administrator in {{organizationName}}.\nAcceseaza link-ul: {{inviteLink}}\nSupport: {{supportEmail}}',
  },
  {
    key: 'resident_invitation',
    name: 'Resident invitation',
    targetRole: 'RESIDENT',
    subject: 'Invitatie rezident - {{organizationName}}',
    body: 'Salut {{userName}},\nAi fost invitat in {{organizationName}} pentru apartamentul {{apartmentNumber}}.\nAccepta invitatia: {{inviteLink}}',
  },
  {
    key: 'team_invitation',
    name: 'Team invitation',
    targetRole: 'TEAM',
    subject: 'Invitatie in echipa - {{organizationName}}',
    body: 'Salut {{userName}},\nAi fost invitat in echipa {{organizationName}}.\nDeschide: {{inviteLink}}',
  },
  {
    key: 'trial_started',
    name: 'Trial started',
    targetRole: 'ADMIN',
    subject: 'Trial activat pentru {{organizationName}}',
    body: 'Salut {{userName}},\nPerioada de trial a inceput pentru {{organizationName}} si expira la {{trialEndDate}}.',
  },
  {
    key: 'trial_ending_soon',
    name: 'Trial ending soon',
    targetRole: 'ADMIN',
    subject: 'Trial se apropie de final - {{organizationName}}',
    body: 'Salut {{userName}},\nTrial-ul pentru {{organizationName}} expira pe {{trialEndDate}}.',
  },
  {
    key: 'invoice_issued',
    name: 'Invoice issued',
    targetRole: 'RESIDENT',
    subject: 'Factura noua emisa',
    body: 'Salut {{userName}},\nA fost emisa o factura noua pentru apartamentul {{apartmentNumber}} in {{organizationName}}.',
  },
  {
    key: 'payment_reminder',
    name: 'Payment reminder',
    targetRole: 'RESIDENT',
    subject: 'Reminder plata',
    body: 'Salut {{userName}},\n{{organizationName}} iti reaminteste plata pentru apartamentul {{apartmentNumber}}.',
  },
];

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private renderText(text: string, variables: TemplateVars) {
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
      const value = variables[key];
      return value === null || value === undefined ? '' : String(value);
    });
  }

  private defaultFor(key: string, targetRole: TemplateTargetRole) {
    return (
      DEFAULT_TEMPLATES.find((row) => row.key === key && row.targetRole === targetRole) ||
      DEFAULT_TEMPLATES.find((row) => row.key === key) ||
      null
    );
  }

  async resolveTemplate(key: string, targetRole: TemplateTargetRole) {
    const custom = await (this.prisma as any).emailTemplate.findFirst({
      where: { key, targetRole },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    if (custom) return custom;
    const fallback = this.defaultFor(key, targetRole);
    if (!fallback) return null;
    return {
      id: `default:${fallback.key}:${fallback.targetRole}`,
      key: fallback.key,
      name: fallback.name,
      subject: fallback.subject,
      body: fallback.body,
      targetRole: fallback.targetRole,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async renderTemplate(key: string, targetRole: TemplateTargetRole, variables: TemplateVars) {
    const template = await this.resolveTemplate(key, targetRole);
    if (!template) return null;
    return {
      template,
      subject: this.renderText(template.subject, variables),
      body: this.renderText(template.body, variables),
    };
  }

  async sendTemplateEmail(params: {
    to: string;
    key: string;
    targetRole: TemplateTargetRole;
    variables: TemplateVars;
    inAppFallback?: () => Promise<void>;
  }) {
    try {
      if (!this.emailService.isDeliveryConfigured()) {
        if (params.inAppFallback) await params.inAppFallback();
        return { sent: false, reason: 'email_not_configured' };
      }
      const rendered = await this.renderTemplate(params.key, params.targetRole, params.variables);
      if (!rendered) {
        if (params.inAppFallback) await params.inAppFallback();
        return { sent: false, reason: 'template_not_found' };
      }
      await this.emailService.sendGenericEmail({
        to: params.to,
        subject: rendered.subject,
        text: rendered.body,
        html: `<pre style="font-family:inherit;white-space:pre-wrap;">${rendered.body}</pre>`,
      });
      return { sent: true };
    } catch (error) {
      this.logger.warn(`Template email failed (${params.key}): ${String(error)}`);
      if (params.inAppFallback) await params.inAppFallback();
      return { sent: false, reason: 'send_failed' };
    }
  }

  async listAll() {
    return (this.prisma as any).emailTemplate.findMany({
      orderBy: [{ key: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async create(data: {
    key: string;
    name: string;
    subject: string;
    body: string;
    targetRole: TemplateTargetRole;
    isDefault?: boolean;
  }) {
    return (this.prisma as any).emailTemplate.create({
      data: {
        key: data.key.trim(),
        name: data.name.trim(),
        subject: data.subject.trim(),
        body: data.body.trim(),
        targetRole: data.targetRole,
        isDefault: !!data.isDefault,
      },
    });
  }

  async update(id: string, data: Partial<{ key: string; name: string; subject: string; body: string; targetRole: TemplateTargetRole; isDefault: boolean }>) {
    return (this.prisma as any).emailTemplate.update({
      where: { id },
      data: {
        ...(data.key !== undefined ? { key: data.key.trim() } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.subject !== undefined ? { subject: data.subject.trim() } : {}),
        ...(data.body !== undefined ? { body: data.body.trim() } : {}),
        ...(data.targetRole !== undefined ? { targetRole: data.targetRole } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    });
  }

  async remove(id: string) {
    await (this.prisma as any).emailTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
