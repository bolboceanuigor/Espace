import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCurrency, PaymentMethod, PaymentProvider, PaymentStatus, SystemErrorLevel, SystemErrorSource } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemMonitoringService } from '../system-monitoring/system-monitoring.service';
import { AdminManualPaymentDto, AdminPaymentsQueryDto, ResidentCreateIntentDto, UpdatePaymentProviderConfigDto } from './dto/payments.dto';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class PaymentsService {
  private static readonly MAX_PAYMENT_AMOUNT = 1_000_000;
  private static readonly MAX_FUTURE_PAYMENT_DAYS = 3;
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly systemMonitoringService: SystemMonitoringService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private async residentScope(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    const userId = this.userId(user);
    const apartments = await this.prisma.residentProfile.findMany({
      where: { organizationId: user.organizationId, userId },
      select: { apartmentId: true },
    });
    return { organizationId: user.organizationId, userId, apartmentIds: apartments.map((a) => a.apartmentId) };
  }

  private monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private async recalcInvoice(invoiceId: string) {
    const invoice = await this.prisma.residentInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return null;
    const monthKey = `${invoice.year}-${String(invoice.month).padStart(2, '0')}`;
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: invoice.organizationId,
        apartmentId: invoice.apartmentId,
        OR: [{ invoiceId: invoice.id }, { month: monthKey }],
        status: { in: ['CONFIRMED'] },
      },
    });
    const paymentsAmount = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDue = Math.max(invoice.previousDebt + invoice.currentCharges - paymentsAmount, 0);
    const grossDue = Math.max(invoice.previousDebt + invoice.currentCharges, 0);
    const nextStatus = totalDue <= 0 ? 'PAID' : paymentsAmount > 0 && paymentsAmount < grossDue ? 'PARTIAL' : 'ISSUED';
    return this.prisma.residentInvoice.update({
      where: { id: invoice.id },
      data: {
        paymentsAmount,
        totalDue,
        status: nextStatus,
      },
    });
  }

  async adminList(user: AuthUser, query: AdminPaymentsQueryDto) {
    const { organizationId } = this.assertAdmin(user);
    const where = {
        organizationId,
        ...(query.apartmentId ? { apartmentId: query.apartmentId } : {}),
        ...(query.method ? { method: query.method as any } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        apartment: {
          ...(query.buildingId ? { buildingId: query.buildingId } : {}),
          ...(query.staircaseId ? { staircaseId: query.staircaseId } : {}),
        },
      };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
      where,
      include: {
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
        invoice: { select: { id: true, invoiceNumber: true, month: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(usePagination ? { skip, take: limit } : {}),
    }),
      this.prisma.payment.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async adminCreateManual(user: AuthUser, dto: AdminManualPaymentDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    if (dto.amount > PaymentsService.MAX_PAYMENT_AMOUNT) {
      throw new BadRequestException('Payment amount exceeds allowed limit');
    }
    const now = new Date();
    const maxFutureDate = new Date(now.getTime() + PaymentsService.MAX_FUTURE_PAYMENT_DAYS * 24 * 60 * 60 * 1000);
    if (maxFutureDate < now) {
      throw new BadRequestException('Invalid payment date window');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { defaultCurrency: true },
    });
    const apartment = await this.prisma.apartment.findFirst({ where: { id: dto.apartmentId, organizationId }, select: { id: true } });
    if (!apartment) throw new BadRequestException('Apartment not found in organization');
    if (dto.invoiceId) {
      const invoice = await this.prisma.residentInvoice.findFirst({ where: { id: dto.invoiceId, organizationId, apartmentId: dto.apartmentId }, select: { id: true } });
      if (!invoice) throw new BadRequestException('Invoice not found in organization/apartment');
    }
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const normalizedReference = (dto.note || '').trim();
    const duplicate = await this.prisma.payment.findFirst({
      where: {
        organizationId,
        apartmentId: dto.apartmentId,
        amount: dto.amount,
        createdAt: { gte: dayStart, lte: dayEnd },
        ...(normalizedReference ? { note: normalizedReference } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException('Potential duplicate payment detected');
    }

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        apartmentId: dto.apartmentId,
        invoiceId: dto.invoiceId || null,
        amount: dto.amount,
        currency: (organization?.defaultCurrency || BillingCurrency.MDL) as BillingCurrency,
        method: dto.method as PaymentMethod,
        status: PaymentStatus.PENDING,
        provider: dto.method === 'CASH' ? PaymentProvider.CASH : PaymentProvider.MANUAL_BANK_TRANSFER,
        note: normalizedReference || null,
        createdByUserId: userId,
        month: this.monthKey(),
      },
    });
    await this.auditService.logCreate(
      { userId, organizationId },
      'PAYMENT',
      payment.id,
      payment,
      `Created manual payment ${payment.id}`,
    );
    return payment;
  }

  async adminConfirm(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const payment = await this.prisma.payment.findFirst({ where: { id, organizationId } });
    if (!payment) throw new NotFoundException('Payment not found');
    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.CONFIRMED, confirmedAt: new Date() },
    });
    const existingReceipt = await this.prisma.receipt.findUnique({ where: { paymentId: updated.id }, select: { id: true } });
    if (!existingReceipt) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: updated.organizationId },
        select: { receiptPrefix: true },
      });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = (organization?.receiptPrefix || 'RCPT').trim().toUpperCase();
      await this.prisma.receipt.create({
        data: {
          organizationId: updated.organizationId,
          apartmentId: updated.apartmentId,
          paymentId: updated.id,
          receiptNumber: `${prefix}-${stamp}-${updated.id.slice(0, 8).toUpperCase()}`,
          amount: updated.amount,
          paymentDate: updated.confirmedAt || new Date(),
        },
      });
    }
    if (updated.invoiceId) await this.recalcInvoice(updated.invoiceId);
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'PAYMENT',
      updated.id,
      payment,
      updated,
      `Confirmed payment ${updated.id}`,
    );
    return updated;
  }

  async adminCancel(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const payment = await this.prisma.payment.findFirst({ where: { id, organizationId } });
    if (!payment) throw new NotFoundException('Payment not found');
    const updated = await this.prisma.payment.update({ where: { id }, data: { status: PaymentStatus.CANCELLED } });
    if (updated.invoiceId) await this.recalcInvoice(updated.invoiceId);
    await this.auditService.logUpdate(
      { userId: this.userId(user), organizationId },
      'PAYMENT',
      updated.id,
      payment,
      updated,
      `Cancelled payment ${updated.id}`,
    );
    return updated;
  }

  async residentList(user: AuthUser) {
    const { organizationId, apartmentIds } = await this.residentScope(user);
    return this.prisma.payment.findMany({
      where: { organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      include: {
        apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } },
        invoice: { select: { id: true, invoiceNumber: true, month: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async residentCreateIntent(user: AuthUser, dto: ResidentCreateIntentDto) {
    const { organizationId, apartmentIds } = await this.residentScope(user);
    if (dto.amount > PaymentsService.MAX_PAYMENT_AMOUNT) {
      throw new BadRequestException('Payment amount exceeds allowed limit');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { defaultCurrency: true },
    });
    if (!apartmentIds.includes(dto.apartmentId)) throw new ForbiddenException('Apartment is not linked to current resident');
    if (dto.invoiceId) {
      const inv = await this.prisma.residentInvoice.findFirst({ where: { id: dto.invoiceId, organizationId, apartmentId: dto.apartmentId }, select: { id: true } });
      if (!inv) throw new BadRequestException('Invoice not found for apartment');
    }
    const intent = await this.prisma.paymentIntent.create({
      data: {
        organizationId,
        apartmentId: dto.apartmentId,
        invoiceId: dto.invoiceId || null,
        amount: dto.amount,
        currency: (organization?.defaultCurrency || BillingCurrency.MDL) as BillingCurrency,
        provider: dto.provider as PaymentProvider,
        status: 'CREATED',
      },
    });

    let providerResult: any;
    let config: any;
    try {
      const resolved = await this.paymentProviderFactory.resolveForOrganization(
        dto.provider as PaymentProvider,
        organizationId,
      );
      config = resolved.config;
      providerResult = await resolved.adapter.createPaymentIntent({
        organizationId,
        paymentIntentId: intent.id,
        apartmentId: dto.apartmentId,
        invoiceId: dto.invoiceId || null,
        amount: dto.amount,
        currency: (organization?.defaultCurrency || BillingCurrency.MDL) as BillingCurrency,
        metadata: {},
      });
    } catch (error) {
      await this.systemMonitoringService.logError({
        source: SystemErrorSource.PAYMENT_PROVIDER,
        level: SystemErrorLevel.ERROR,
        message: `Payment provider create intent failed: ${dto.provider}`,
        stack: error instanceof Error ? error.stack : String(error),
        metadataJson: {
          provider: dto.provider,
          paymentIntentId: intent.id,
          organizationId,
          apartmentId: dto.apartmentId,
        },
        organizationId,
        userId: this.userId(user),
      });
      throw error;
    }

    const updated = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: providerResult.status,
        redirectUrl: providerResult.redirectUrl || null,
        providerPaymentId: providerResult.providerPaymentId || null,
        metadataJson: {
          ...(intent.metadataJson && typeof intent.metadataJson === 'object' ? (intent.metadataJson as any) : {}),
          configured: !!config?.isEnabled,
          message: providerResult.message || 'Provider integration is not configured yet',
        },
      },
    });

    return {
      ...updated,
      message: providerResult.message || 'Provider integration is not configured yet',
    };
  }

  async residentPaymentStatus(user: AuthUser, id: string) {
    const { organizationId, apartmentIds } = await this.residentScope(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
    });
    if (payment) return { kind: 'PAYMENT', payment };
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id, organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
    });
    if (!intent) throw new NotFoundException('Payment/intent not found');
    return { kind: 'INTENT', intent };
  }

  async adminListPaymentProviders(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    const providers = Object.values(PaymentProvider);
    const existing = await this.prisma.paymentProviderConfig.findMany({
      where: { organizationId },
      orderBy: { provider: 'asc' },
    });

    const map = new Map(existing.map((row) => [row.provider, row]));
    return providers.map((provider) => {
      const row = map.get(provider);
      const config = row?.configJson && typeof row.configJson === 'object' ? (row.configJson as Record<string, any>) : {};
      return {
        provider,
        isEnabled: row?.isEnabled || false,
        isTestMode: row?.isTestMode ?? true,
        config: {
          merchantId: config.merchantId || '',
          callbackUrl: config.callbackUrl || '',
          successUrl: config.successUrl || '',
          failUrl: config.failUrl || '',
          secretKeyMasked: config.secretKey ? '********' : '',
        },
      };
    });
  }

  async adminUpdatePaymentProvider(user: AuthUser, provider: string, dto: UpdatePaymentProviderConfigDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    const providerEnum = String(provider || '').toUpperCase() as PaymentProvider;
    if (!Object.values(PaymentProvider).includes(providerEnum)) throw new BadRequestException('Unsupported provider');

    const existing = await this.prisma.paymentProviderConfig.findUnique({
      where: { organizationId_provider: { organizationId, provider: providerEnum } },
    });
    const existingConfig = existing?.configJson && typeof existing.configJson === 'object'
      ? (existing.configJson as Record<string, any>)
      : {};
    const incomingConfig = dto.configJson || {};

    const mergedConfig = {
      ...existingConfig,
      ...incomingConfig,
    };
    const updated = await this.prisma.paymentProviderConfig.upsert({
      where: { organizationId_provider: { organizationId, provider: providerEnum } },
      create: {
        organizationId,
        provider: providerEnum,
        isEnabled: dto.isEnabled ?? false,
        isTestMode: dto.isTestMode ?? true,
        configJson: mergedConfig,
      },
      update: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.isTestMode !== undefined ? { isTestMode: dto.isTestMode } : {}),
        ...(dto.configJson !== undefined ? { configJson: mergedConfig } : {}),
      },
    });

    await this.auditService.logUpdate(
      { userId, organizationId },
      'PAYMENT_PROVIDER',
      updated.id,
      existing || {},
      updated,
      `Updated payment provider config for ${providerEnum}`,
    );

    const cfg = updated.configJson && typeof updated.configJson === 'object'
      ? (updated.configJson as Record<string, any>)
      : {};
    return {
      provider: updated.provider,
      isEnabled: updated.isEnabled,
      isTestMode: updated.isTestMode,
      config: {
        merchantId: cfg.merchantId || '',
        callbackUrl: cfg.callbackUrl || '',
        successUrl: cfg.successUrl || '',
        failUrl: cfg.failUrl || '',
        secretKeyMasked: cfg.secretKey ? '********' : '',
      },
    };
  }

  async residentListPaymentProviders(user: AuthUser) {
    const { organizationId } = await this.residentScope(user);
    const rows = await this.prisma.paymentProviderConfig.findMany({
      where: { organizationId, isEnabled: true },
      select: { provider: true, isTestMode: true },
      orderBy: { provider: 'asc' },
    });
    return rows;
  }

  async webhook(provider: string, payload: any, headers?: Record<string, any>) {
    const providerUpper = String(provider || '').toUpperCase();
    if (!Object.values(PaymentProvider).includes(providerUpper as PaymentProvider)) {
      throw new BadRequestException('Unsupported provider');
    }
    const intentId = payload?.intentId || payload?.paymentIntentId;
    if (!intentId) throw new BadRequestException('intentId is required');
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent) throw new NotFoundException('PaymentIntent not found');

    let providerResult: any;
    try {
      const { adapter } = await this.paymentProviderFactory.resolveForOrganization(
        providerUpper as PaymentProvider,
        intent.organizationId,
      );
      providerResult = await adapter.handleWebhook(payload || {}, headers || {});
    } catch (error) {
      await this.systemMonitoringService.logError({
        source: SystemErrorSource.WEBHOOK,
        level: SystemErrorLevel.ERROR,
        message: `Payment webhook processing failed for provider ${providerUpper}`,
        stack: error instanceof Error ? error.stack : String(error),
        metadataJson: {
          provider: providerUpper,
          intentId,
          payloadKeys: Object.keys(payload || {}),
        },
        organizationId: intent.organizationId,
      });
      throw error;
    }

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: providerResult.status,
        providerPaymentId: providerResult.providerPaymentId || intent.providerPaymentId || null,
        metadataJson: payload || {},
      },
    });

    if (providerResult.status === 'PAID') {
      const existingPayment = await this.prisma.payment.findFirst({
        where: { paymentIntentId: intent.id },
        select: { id: true },
      });
      if (existingPayment) {
        return { ok: true, status: 'PAID', paymentId: existingPayment.id, message: providerResult.message };
      }
      const payment = await this.prisma.payment.create({
        data: {
          organizationId: intent.organizationId,
          apartmentId: intent.apartmentId,
          invoiceId: intent.invoiceId,
          paymentIntentId: intent.id,
          amount: intent.amount,
          currency: intent.currency,
          method: 'ONLINE',
          status: 'CONFIRMED',
          provider: intent.provider,
          providerPaymentId: providerResult.providerPaymentId || String(payload?.providerPaymentId || payload?.id || ''),
          note: 'Online payment webhook',
          confirmedAt: new Date(),
          month: this.monthKey(),
        },
      });
      if (payment.invoiceId) await this.recalcInvoice(payment.invoiceId);
      return { ok: true, status: 'PAID', paymentId: payment.id, message: providerResult.message };
    }
    return { ok: true, status: providerResult.status, message: providerResult.message };
  }
}
