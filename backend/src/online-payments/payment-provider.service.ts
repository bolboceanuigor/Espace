import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OnlinePaymentConfigStatus,
  OnlinePaymentProviderMode,
  OnlinePaymentProviderStatus,
  OnlinePaymentProviderType,
  PaymentIntentEventType,
  PaymentIntentStatus,
  PaymentWebhookEventStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MvpUser } from '../security/mvp-auth.guard';
import { areExternalPaymentsEnabled, isExternalPaymentProviderType } from '../common/runtime-flags';

const PROVIDER_PRESETS = [
  {
    type: OnlinePaymentProviderType.MANUAL_TEST,
    code: 'MANUAL_TEST',
    name: 'Espace Internal Payments',
    description: 'Provider intern Espace pentru validarea fluxului fără procesare bancară reală.',
    status: OnlinePaymentProviderStatus.TESTING,
    mode: OnlinePaymentProviderMode.TEST,
    isDefault: true,
    isPublic: true,
    supportsCards: false,
    supportsBpay: false,
    supportsQr: false,
    supportsRedirect: false,
    supportsWebhooks: true,
    configStatus: OnlinePaymentConfigStatus.CONFIGURED,
    publicConfig: { displayName: 'Plată Espace', supportedCurrencies: ['MDL'], minAmount: 1, maxAmount: 100000 },
  },
  {
    type: OnlinePaymentProviderType.BPAY,
    code: 'BPAY',
    name: 'BPay',
    description: 'Integrare BPay în pregătire. Activarea procesării reale se face separat.',
    status: OnlinePaymentProviderStatus.DRAFT,
    mode: OnlinePaymentProviderMode.TEST,
    isDefault: false,
    isPublic: true,
    supportsCards: false,
    supportsBpay: true,
    supportsQr: true,
    supportsRedirect: true,
    supportsWebhooks: true,
    configStatus: OnlinePaymentConfigStatus.NOT_CONFIGURED,
    publicConfig: { displayName: 'BPay', supportedCurrencies: ['MDL'] },
  },
];

const SUPPORTED_WEBHOOK_PROVIDER_TYPES: OnlinePaymentProviderType[] = [
  OnlinePaymentProviderType.MANUAL_TEST,
];

@Injectable()
export class PaymentProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ensurePresetProviders() {
    for (const preset of PROVIDER_PRESETS) {
      await this.prisma.onlinePaymentProvider.upsert({
        where: { code: preset.code },
        create: preset,
        update: {
          name: preset.name,
          description: preset.description,
          supportsCards: preset.supportsCards,
          supportsBpay: preset.supportsBpay,
          supportsQr: preset.supportsQr,
          supportsRedirect: preset.supportsRedirect,
          supportsWebhooks: preset.supportsWebhooks,
          publicConfig: preset.publicConfig,
          ...(preset.code === 'MANUAL_TEST' ? { configStatus: OnlinePaymentConfigStatus.CONFIGURED } : {}),
        },
      });
    }
  }

  async listProviders() {
    await this.ensurePresetProviders();
    const providers = await this.prisma.onlinePaymentProvider.findMany({ orderBy: [{ isDefault: 'desc' }, { code: 'asc' }] });
    return { items: providers.map((provider) => this.safeProvider(provider)) };
  }

  async createProvider(user: MvpUser, body: unknown) {
    const payload = this.payload(body);
    const type = this.enumValue(payload.type, OnlinePaymentProviderType, 'Tip provider invalid.');
    const code = this.requiredString(payload.code, 'Codul providerului este obligatoriu.').toUpperCase();
    const name = this.requiredString(payload.name, 'Numele providerului este obligatoriu.');
    const provider = await this.prisma.onlinePaymentProvider.create({
      data: {
        type,
        code,
        name,
        description: this.optionalString(payload.description),
        status: this.enumValue(payload.status, OnlinePaymentProviderStatus, 'Status provider invalid.', OnlinePaymentProviderStatus.DRAFT),
        mode: this.enumValue(payload.mode, OnlinePaymentProviderMode, 'Mod provider invalid.', OnlinePaymentProviderMode.TEST),
        isPublic: Boolean(payload.isPublic ?? true),
        supportsCards: Boolean(payload.supportsCards),
        supportsBpay: Boolean(payload.supportsBpay),
        supportsQr: Boolean(payload.supportsQr),
        supportsRedirect: Boolean(payload.supportsRedirect),
        supportsWebhooks: Boolean(payload.supportsWebhooks),
        configStatus: this.configStatusFor(type),
        publicConfig: this.publicConfig(payload.publicConfig),
        createdById: user.id,
      },
    });
    await this.audit.createLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_PROVIDER_CREATED',
      entityType: 'ONLINE_PAYMENT_PROVIDER',
      entityId: provider.id,
      title: 'Provider plăți creat',
      message: `Providerul ${provider.name} a fost creat.`,
      metadata: { providerId: provider.id, providerType: provider.type },
    }).catch(() => undefined);
    return this.safeProvider(provider);
  }

  async getProvider(id: string) {
    await this.ensurePresetProviders();
    const provider = await this.prisma.onlinePaymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Providerul nu a fost găsit.');
    return { provider: this.safeProvider(provider), health: this.providerHealth(provider) };
  }

  async updateProvider(user: MvpUser, id: string, body: unknown) {
    const payload = this.payload(body);
    const existing = await this.prisma.onlinePaymentProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Providerul nu a fost găsit.');
    const data: Prisma.OnlinePaymentProviderUpdateInput = {
      updatedBy: { connect: { id: user.id } },
    };
    if (payload.name !== undefined) data.name = this.requiredString(payload.name, 'Numele providerului este obligatoriu.');
    if (payload.description !== undefined) data.description = this.optionalString(payload.description);
    if (payload.mode !== undefined) data.mode = this.enumValue(payload.mode, OnlinePaymentProviderMode, 'Mod provider invalid.');
    if (payload.isPublic !== undefined) data.isPublic = Boolean(payload.isPublic);
    if (payload.supportsCards !== undefined) data.supportsCards = Boolean(payload.supportsCards);
    if (payload.supportsBpay !== undefined) data.supportsBpay = Boolean(payload.supportsBpay);
    if (payload.supportsQr !== undefined) data.supportsQr = Boolean(payload.supportsQr);
    if (payload.supportsRedirect !== undefined) data.supportsRedirect = Boolean(payload.supportsRedirect);
    if (payload.supportsWebhooks !== undefined) data.supportsWebhooks = Boolean(payload.supportsWebhooks);
    if (payload.publicConfig !== undefined) data.publicConfig = this.publicConfig(payload.publicConfig);
    data.configStatus = this.configStatusFor(existing.type);
    const updated = await this.prisma.onlinePaymentProvider.update({ where: { id }, data });
    await this.audit.createLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_PROVIDER_UPDATED',
      entityType: 'ONLINE_PAYMENT_PROVIDER',
      entityId: updated.id,
      title: 'Provider plăți actualizat',
      message: `Providerul ${updated.name} a fost actualizat.`,
      metadata: { providerId: updated.id, providerType: updated.type },
      beforeSnapshot: existing,
      afterSnapshot: updated,
    }).catch(() => undefined);
    return this.safeProvider(updated);
  }

  async updateStatus(user: MvpUser, id: string, body: unknown) {
    const payload = this.payload(body);
    const status = this.enumValue(payload.status, OnlinePaymentProviderStatus, 'Status provider invalid.');
    const provider = await this.prisma.onlinePaymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Providerul nu a fost găsit.');
    if (status === OnlinePaymentProviderStatus.ACTIVE && isExternalPaymentProviderType(provider.type) && !areExternalPaymentsEnabled()) {
      throw new BadRequestException('Plățile externe sunt dezactivate în acest mediu.');
    }
    if (status === OnlinePaymentProviderStatus.ACTIVE && provider.mode === OnlinePaymentProviderMode.LIVE && !this.liveConfigPresent(provider.type)) {
      throw new BadRequestException('Providerul LIVE nu poate fi activat fără environment variables configurate.');
    }
    const updated = await this.prisma.onlinePaymentProvider.update({ where: { id }, data: { status, updatedById: user.id, configStatus: this.configStatusFor(provider.type) } });
    await this.audit.createLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_PROVIDER_STATUS_CHANGED',
      entityType: 'ONLINE_PAYMENT_PROVIDER',
      entityId: updated.id,
      title: 'Status provider plăți schimbat',
      message: `Statusul providerului ${updated.name} a devenit ${updated.status}.`,
      severity: 'WARNING',
      metadata: { providerId: updated.id, providerType: updated.type, oldStatus: provider.status, newStatus: updated.status },
    }).catch(() => undefined);
    return this.safeProvider(updated);
  }

  async setDefault(user: MvpUser, id: string) {
    const provider = await this.prisma.onlinePaymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Providerul nu a fost găsit.');
    await this.prisma.$transaction([
      this.prisma.onlinePaymentProvider.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.onlinePaymentProvider.update({ where: { id }, data: { isDefault: true, updatedById: user.id } }),
    ]);
    return this.getProvider(id);
  }

  async getDefaultProvider() {
    await this.ensurePresetProviders();
    return this.prisma.onlinePaymentProvider.findFirst({ where: { isDefault: true }, orderBy: { createdAt: 'asc' } });
  }

  async getProviderHealth(id: string) {
    const provider = await this.prisma.onlinePaymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Providerul nu a fost găsit.');
    return this.providerHealth(provider);
  }

  async testProvider(user: MvpUser, id: string) {
    const provider = await this.prisma.onlinePaymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Providerul nu a fost găsit.');
    const health = this.providerHealth(provider);
    const ok = provider.type === OnlinePaymentProviderType.MANUAL_TEST || health.configStatus === OnlinePaymentConfigStatus.CONFIGURED;
    await this.audit.createLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_PROVIDER_TESTED',
      entityType: 'ONLINE_PAYMENT_PROVIDER',
      entityId: provider.id,
      title: ok ? 'Provider testat' : 'Provider test eșuat',
      message: ok ? 'Configurația providerului a fost verificată fără plată reală.' : 'Configurația providerului lipsește sau este incompletă.',
      severity: ok ? 'INFO' : 'WARNING',
      metadata: { providerId: provider.id, providerType: provider.type, configStatus: health.configStatus },
    }).catch(() => undefined);
    return { ok, provider: this.safeProvider(provider), health, message: ok ? 'Provider verificat fără plată reală.' : 'Provider neconfigurat.' };
  }

  async initializePaymentIntent(intent: any, provider: any | null) {
    if (!provider) {
      return { status: PaymentIntentStatus.PENDING_PROVIDER, reason: 'PROVIDER_NOT_CONFIGURED', message: 'Providerul de plăți nu este configurat.' };
    }
    if (isExternalPaymentProviderType(provider.type) && !areExternalPaymentsEnabled()) {
      return {
        status: PaymentIntentStatus.PENDING_PROVIDER,
        reason: 'EXTERNAL_PAYMENTS_DISABLED',
        message: 'Plățile online reale sunt dezactivate în acest mediu.',
      };
    }
    if (provider.type === OnlinePaymentProviderType.MANUAL_TEST) {
      return {
        status: PaymentIntentStatus.CREATED,
        reason: null,
        message: 'Intent intern creat. Nu se procesează bani.',
      };
    }
    if (provider.type === OnlinePaymentProviderType.BPAY) {
      return {
        status: this.configStatusFor(provider.type) === OnlinePaymentConfigStatus.CONFIGURED ? PaymentIntentStatus.PENDING_PROVIDER : PaymentIntentStatus.PENDING_PROVIDER,
        reason: this.configStatusFor(provider.type) === OnlinePaymentConfigStatus.CONFIGURED ? null : 'PROVIDER_NOT_CONFIGURED',
        message: 'BPay este pregătit pentru configurare. Nu se trimite request real în acest mediu.',
      };
    }
    return { status: PaymentIntentStatus.PENDING_PROVIDER, reason: 'PROVIDER_NOT_IMPLEMENTED', message: 'Providerul nu este implementat încă.' };
  }

  async parseWebhook(providerType: OnlinePaymentProviderType, payload: unknown, headers: Record<string, unknown>) {
    if (isExternalPaymentProviderType(providerType) && !areExternalPaymentsEnabled()) {
      throw new NotFoundException('Webhook-ul nu este disponibil în acest mediu.');
    }
    await this.ensurePresetProviders();
    const body = this.safeJson(payload);
    const providerEventId = this.optionalString((body as Record<string, unknown>).providerEventId ?? (body as Record<string, unknown>).id);
    if (!providerEventId) {
      throw new BadRequestException('providerEventId este obligatoriu.');
    }

    const duplicate = await this.prisma.paymentWebhookEvent.findFirst({
      where: { providerType, providerEventId },
      orderBy: { createdAt: 'desc' },
    });
    if (duplicate) {
      return {
        received: true,
        ignored: true,
        duplicate: true,
        eventId: duplicate.id,
        message: 'Evenimentul webhook a fost deja procesat.',
      };
    }

    const paymentIntentId = this.optionalString((body as Record<string, unknown>).paymentIntentId ?? (body as Record<string, unknown>).intentId);
    const provider = await this.prisma.onlinePaymentProvider.findFirst({ where: { type: providerType } });

    if (!SUPPORTED_WEBHOOK_PROVIDER_TYPES.includes(providerType)) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.IGNORED,
        payload: body,
        headers,
        signatureValid: null,
        errorMessage: 'Providerul nu are implementare webhook activă în Espace.',
      });
      throw new NotFoundException('Webhook-ul pentru acest provider nu este implementat în Espace.');
    }

    if (!provider || !provider.supportsWebhooks) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: null,
        errorMessage: 'Providerul nu este configurat pentru webhooks.',
      });
      throw new BadRequestException('Providerul nu este configurat pentru webhooks.');
    }

    const signature = this.extractWebhookSignature(providerType, headers);
    if (!signature) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: false,
        errorMessage: 'Semnătura webhook lipsește.',
      });
      throw new BadRequestException('Semnătura webhook lipsește.');
    }

    const secret = this.webhookSecret(providerType);
    if (!secret) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: false,
        errorMessage: 'Secretul webhook nu este configurat.',
      });
      throw new BadRequestException('Secretul webhook nu este configurat.');
    }

    if (signature !== secret) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: false,
        errorMessage: 'Semnătura webhook nu este validă.',
      });
      throw new BadRequestException('Semnătura webhook nu este validă.');
    }

    if (!paymentIntentId) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId: null,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: true,
        errorMessage: 'paymentIntentId este obligatoriu.',
      });
      throw new BadRequestException('paymentIntentId este obligatoriu.');
    }

    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
    if (!intent) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: true,
        errorMessage: 'Intenția de plată nu a fost găsită.',
      });
      throw new NotFoundException('Intenția de plată nu a fost găsită.');
    }

    if (intent.providerType && intent.providerType !== providerType) {
      await this.createWebhookEvent({
        providerType,
        providerEventId,
        paymentIntentId,
        status: PaymentWebhookEventStatus.FAILED,
        payload: body,
        headers,
        signatureValid: true,
        errorMessage: 'Providerul webhook nu corespunde intenției de plată.',
      });
      throw new BadRequestException('Providerul webhook nu corespunde intenției de plată.');
    }

    const outcome = this.manualTestWebhookOutcome(body);
    const event = await this.createWebhookEvent({
      providerType,
      providerEventId,
      paymentIntentId,
      status: PaymentWebhookEventStatus.PROCESSED,
      payload: body,
      headers,
      signatureValid: true,
      errorMessage: null,
    });

    const metadataJson =
      intent.metadataJson && typeof intent.metadataJson === 'object'
        ? ({ ...(intent.metadataJson as Record<string, unknown>) } as Prisma.InputJsonObject)
        : ({} as Prisma.InputJsonObject);

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: outcome.intentStatus,
        providerPaymentId: this.optionalString((body as Record<string, unknown>).providerPaymentId) || intent.providerPaymentId || null,
        providerReference: providerEventId,
        succeededAt: outcome.intentStatus === PaymentIntentStatus.SUCCEEDED ? new Date() : intent.succeededAt,
        failedAt: outcome.intentStatus === PaymentIntentStatus.FAILED ? new Date() : intent.failedAt,
        failureReason: outcome.intentStatus === PaymentIntentStatus.FAILED ? outcome.message : null,
        cancelledAt: outcome.intentStatus === PaymentIntentStatus.CANCELLED ? new Date() : intent.cancelledAt,
        cancellationReason: outcome.intentStatus === PaymentIntentStatus.CANCELLED ? outcome.message : intent.cancellationReason,
        metadataJson: {
          ...metadataJson,
          lastWebhookProviderEventId: providerEventId,
          lastWebhookStatus: outcome.intentStatus,
          realMoneyProcessed: false,
        },
      },
    });

    await this.prisma.paymentIntentEvent.create({
      data: {
        paymentIntentId: intent.id,
        associationId: intent.organizationId,
        actorUserId: null,
        eventType: outcome.eventType,
        title: outcome.title,
        message: outcome.message,
        metadata: {
          providerType,
          providerEventId,
          realMoneyProcessed: false,
        },
      },
    });

    return {
      received: true,
      processed: true,
      eventId: event.id,
      paymentIntentId: intent.id,
      status: outcome.intentStatus,
      message: outcome.message,
      settlementApplied: false,
    };
  }

  providerHealth(provider: any) {
    const configStatus = this.configStatusFor(provider.type);
    const externalEnabled = areExternalPaymentsEnabled();
    return {
      providerId: provider.id,
      providerType: provider.type,
      status: provider.status,
      mode: provider.mode,
      configStatus,
      externalEnabled,
      configured: configStatus === OnlinePaymentConfigStatus.CONFIGURED,
      message:
        provider.type === OnlinePaymentProviderType.MANUAL_TEST
          ? 'Providerul intern Espace este disponibil și nu procesează bani.'
          : configStatus === OnlinePaymentConfigStatus.CONFIGURED
            ? 'Configurația publică este pregătită. Procesarea online reală rămâne dezactivată în mediul curent.'
            : 'Secretele providerului lipsesc din environment variables.',
    };
  }

  configStatusFor(type: OnlinePaymentProviderType) {
    if (type === OnlinePaymentProviderType.MANUAL_TEST) return OnlinePaymentConfigStatus.CONFIGURED;
    if (type === OnlinePaymentProviderType.BPAY) {
      const present = Boolean(process.env.BPAY_MERCHANT_ID && process.env.BPAY_API_KEY && process.env.BPAY_SECRET);
      if (present) return OnlinePaymentConfigStatus.CONFIGURED;
      if (process.env.BPAY_MERCHANT_ID || process.env.BPAY_API_KEY || process.env.BPAY_SECRET) return OnlinePaymentConfigStatus.PARTIAL;
      return OnlinePaymentConfigStatus.NOT_CONFIGURED;
    }
    return OnlinePaymentConfigStatus.NOT_CONFIGURED;
  }

  private liveConfigPresent(type: OnlinePaymentProviderType) {
    if (type === OnlinePaymentProviderType.BPAY) return this.configStatusFor(type) === OnlinePaymentConfigStatus.CONFIGURED;
    return type === OnlinePaymentProviderType.MANUAL_TEST;
  }

  safeProvider(provider: any) {
    return {
      id: provider.id,
      type: provider.type,
      code: provider.code,
      name: provider.name,
      description: provider.description,
      status: provider.status,
      mode: provider.mode,
      isDefault: provider.isDefault,
      isPublic: provider.isPublic,
      supportsCards: provider.supportsCards,
      supportsBpay: provider.supportsBpay,
      supportsQr: provider.supportsQr,
      supportsRedirect: provider.supportsRedirect,
      supportsWebhooks: provider.supportsWebhooks,
      configStatus: this.configStatusFor(provider.type),
      publicConfig: provider.publicConfig || null,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private payload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private enumValue<T extends Record<string, string>>(value: unknown, enumeration: T, message: string, fallback?: T[keyof T]) {
    if ((value === undefined || value === null || value === '') && fallback) return fallback;
    const normalized = String(value || '').toUpperCase();
    if (!Object.values(enumeration).includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }

  private publicConfig(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const input = value as Record<string, unknown>;
    const forbidden = ['apiKey', 'secret', 'token', 'password', 'webhookSecret'];
    forbidden.forEach((key) => delete input[key]);
    return input as Prisma.InputJsonObject;
  }

  private safeJson(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Prisma.InputJsonObject;
    const input = { ...(value as Record<string, unknown>) };
    ['card', 'pan', 'cvv', 'apiKey', 'secret', 'token', 'password'].forEach((key) => {
      if (key in input) input[key] = '[masked]';
    });
    return input as Prisma.InputJsonObject;
  }

  private safeHeaders(headers: Record<string, unknown>) {
    const input = { ...(headers || {}) };
    Object.keys(input).forEach((key) => {
      if (/authorization|cookie|signature|secret|token/i.test(key)) input[key] = '[masked]';
    });
    return input as Prisma.InputJsonObject;
  }

  private async createWebhookEvent(input: {
    providerType: OnlinePaymentProviderType;
    providerEventId: string | null;
    paymentIntentId: string | null;
    status: PaymentWebhookEventStatus;
    payload: Prisma.InputJsonObject;
    headers: Record<string, unknown>;
    signatureValid: boolean | null;
    errorMessage: string | null;
  }) {
    return this.prisma.paymentWebhookEvent.create({
      data: {
        providerType: input.providerType,
        providerEventId: input.providerEventId,
        paymentIntentId: input.paymentIntentId,
        status: input.status,
        rawPayload: input.payload,
        headers: this.safeHeaders(input.headers),
        signatureValid: input.signatureValid,
        errorMessage: input.errorMessage,
        processedAt: new Date(),
      },
    });
  }

  private extractWebhookSignature(providerType: OnlinePaymentProviderType, headers: Record<string, unknown>) {
    if (providerType === OnlinePaymentProviderType.MANUAL_TEST) {
      return this.headerString(headers, 'x-espace-webhook-secret');
    }
    return null;
  }

  private webhookSecret(providerType: OnlinePaymentProviderType) {
    if (providerType === OnlinePaymentProviderType.MANUAL_TEST) {
      return this.optionalString(process.env.PAYMENTS_MANUAL_TEST_WEBHOOK_SECRET) || null;
    }
    return null;
  }

  private manualTestWebhookOutcome(payload: Prisma.InputJsonObject) {
    const rawStatus = this.optionalString((payload as Record<string, unknown>).status ?? (payload as Record<string, unknown>).event)?.toUpperCase() || 'SUCCEEDED';
    if (rawStatus === 'FAILED') {
      return {
        intentStatus: PaymentIntentStatus.FAILED,
        eventType: PaymentIntentEventType.INTENT_FAILED,
        title: 'Webhook test eșuat',
        message: 'Webhook-ul de test a marcat intenția ca eșuată.',
      };
    }
    if (rawStatus === 'CANCELLED') {
      return {
        intentStatus: PaymentIntentStatus.CANCELLED,
        eventType: PaymentIntentEventType.INTENT_CANCELLED,
        title: 'Webhook test anulat',
        message: 'Webhook-ul de test a marcat intenția ca anulată.',
      };
    }
    if (rawStatus === 'EXPIRED') {
      return {
        intentStatus: PaymentIntentStatus.EXPIRED,
        eventType: PaymentIntentEventType.INTENT_EXPIRED,
        title: 'Webhook test expirat',
        message: 'Webhook-ul de test a marcat intenția ca expirată.',
      };
    }
    return {
      intentStatus: PaymentIntentStatus.SUCCEEDED,
      eventType: PaymentIntentEventType.INTENT_SUCCEEDED_TEST,
      title: 'Webhook test procesat',
      message: 'Webhook-ul de test a fost acceptat. Nu s-a creat nicio plată reală.',
    };
  }

  private headerString(headers: Record<string, unknown>, key: string) {
    const value = headers?.[key] ?? headers?.[key.toLowerCase()] ?? headers?.[key.toUpperCase()];
    if (Array.isArray(value)) return this.optionalString(value[0]);
    return this.optionalString(value);
  }
}
