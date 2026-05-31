import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  BillingType,
  ContractBillingCycle,
  ContractPricingModel,
  OrganizationContractStatus,
  OrganizationSubscriptionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class OrganizationContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCommercialSummary(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        city: true,
        status: true,
      },
    });
    if (!organization) throw new NotFoundException('Organizația nu a fost găsită.');

    const [contract, subscription, apartmentsCount] = await Promise.all([
      this.prisma.organizationContract.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.organizationSubscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      }),
      this.prisma.apartment.count({ where: { organizationId, archivedAt: null } }),
    ]);

    const calculatedMonthlyAmount = this.calculateMonthlyAmount(contract, subscription, apartmentsCount);
    const warnings = this.warnings(contract, subscription, apartmentsCount);

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        legalName: organization.legalName,
        apcCode: organization.fiscalCode,
        city: organization.city,
        status: organization.status,
      },
      contract: contract ? this.toContract(contract) : null,
      subscription: subscription ? this.toSubscription(subscription) : null,
      apartmentsCount,
      calculatedMonthlyAmount,
      estimatedMonthlyAmount: calculatedMonthlyAmount,
      warnings,
    };
  }

  async upsertContract(user: MvpUser, organizationId: string, body: unknown) {
    await this.ensureOrganization(organizationId);
    const existing = await this.prisma.organizationContract.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        signedAt: true,
        cancelledAt: true,
        billingCycle: true,
        pricingModel: true,
        pricePerApartment: true,
        fixedMonthlyPrice: true,
        minimumMonthlyFee: true,
        paymentDueDay: true,
        documentUrl: true,
        internalNote: true,
      },
    });
    const data = this.parseContractBody(body);
    const contract = existing
      ? await this.prisma.organizationContract.update({
          where: { id: existing.id },
          data: { ...data, updatedById: user.id },
        })
      : await this.prisma.organizationContract.create({
          data: { ...data, organizationId, createdById: user.id, updatedById: user.id },
        });

    const action = !existing
      ? 'CONTRACT_CREATED'
      : (contract.status === OrganizationContractStatus.SIGNED || contract.status === OrganizationContractStatus.ACTIVE) &&
          existing.status !== contract.status
        ? 'CONTRACT_SIGNED'
        : contract.status === OrganizationContractStatus.CANCELLED && existing.status !== contract.status
          ? 'CONTRACT_CANCELLED'
        : 'CONTRACT_UPDATED';
    await this.writeAudit(user, organizationId, action, contract.id, existing, contract);

    return this.getCommercialSummary(organizationId);
  }

  async upsertSubscription(user: MvpUser, organizationId: string, body: unknown) {
    await this.ensureOrganization(organizationId);
    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { id: true, status: true, planName: true, price: true, currency: true, subscriptionStartDate: true, trialEndDate: true, nextBillingDate: true, notes: true },
    });
    const data = this.parseSubscriptionBody(body);
    const subscription = existing
      ? await this.prisma.organizationSubscription.update({
          where: { organizationId },
          data,
        })
      : await this.prisma.organizationSubscription.create({
          data: {
            organizationId,
            billingType: BillingType.FIXED,
            price: 0,
            currency: BillingCurrency.MDL,
            status: OrganizationSubscriptionStatus.TRIAL,
            ...data,
          },
        });

    const action = !existing
      ? 'SUBSCRIPTION_CREATED'
      : subscription.status === OrganizationSubscriptionStatus.CANCELLED && existing.status !== subscription.status
        ? 'SUBSCRIPTION_CANCELLED'
        : 'SUBSCRIPTION_UPDATED';
    await this.writeAudit(user, organizationId, action, subscription.id, existing, subscription);

    return this.getCommercialSummary(organizationId);
  }

  private parseContractBody(body: unknown) {
    const payload = this.objectPayload(body);
    const status = this.enumValue(payload.status, OrganizationContractStatus, OrganizationContractStatus.DRAFT, 'Statusul contractului nu este valid.');
    const billingCycle = this.enumValue(payload.billingCycle, ContractBillingCycle, ContractBillingCycle.MONTHLY, 'Ciclul de facturare nu este valid.');
    const pricingModel = this.enumValue(payload.pricingModel, ContractPricingModel, ContractPricingModel.PER_APARTMENT, 'Modelul de tarifare nu este valid.');
    const paymentDueDay = this.optionalInt(payload.paymentDueDay, 'Ziua de scadență nu este validă.');
    if (paymentDueDay !== null && (paymentDueDay < 1 || paymentDueDay > 31)) {
      throw new BadRequestException('Ziua de scadență trebuie să fie între 1 și 31.');
    }

    const pricePerApartment = this.optionalDecimal(payload.pricePerApartment, 'Tariful per apartament nu este valid.');
    const fixedMonthlyPrice = this.optionalDecimal(payload.fixedMonthlyPrice, 'Tariful lunar fix nu este valid.');
    const minimumMonthlyFee = this.optionalDecimal(payload.minimumMonthlyFee, 'Suma minimă lunară nu este validă.');

    if (pricingModel === ContractPricingModel.PER_APARTMENT && pricePerApartment === null) {
      throw new BadRequestException('Tariful per apartament este obligatoriu pentru tarifarea per apartament.');
    }
    if (pricingModel === ContractPricingModel.FIXED_MONTHLY && fixedMonthlyPrice === null) {
      throw new BadRequestException('Tariful lunar fix este obligatoriu pentru tarifarea fixă.');
    }

    return {
      status,
      contractNumber: this.nullableString(payload.contractNumber),
      startDate: this.optionalDate(payload.startDate, 'Data de început nu este validă.'),
      endDate: this.optionalDate(payload.endDate, 'Data de expirare nu este validă.'),
      signedAt: this.optionalDate(payload.signedAt, 'Data semnării nu este validă.'),
      cancelledAt: this.optionalDate(payload.cancelledAt, 'Data anulării nu este validă.'),
      currency: this.enumValue(payload.currency, BillingCurrency, BillingCurrency.MDL, 'Moneda nu este validă.'),
      billingCycle,
      pricingModel,
      pricePerApartment,
      fixedMonthlyPrice,
      apartmentsIncluded: this.optionalInt(payload.apartmentsIncluded, 'Numărul de apartamente incluse nu este valid.'),
      minimumMonthlyFee,
      paymentDueDay,
      documentUrl: this.nullableString(payload.documentUrl),
      internalNote: this.nullableString(payload.internalNote),
    };
  }

  private parseSubscriptionBody(body: unknown) {
    const payload = this.objectPayload(body);
    const status = this.enumValue(payload.status, OrganizationSubscriptionStatus, OrganizationSubscriptionStatus.TRIAL, 'Statusul abonamentului nu este valid.');
    const currentMonthlyAmount = this.optionalNumber(payload.currentMonthlyAmount, 'Suma lunară nu este validă.');
    return {
      status,
      planName: this.nullableString(payload.planName),
      subscriptionStartDate: this.optionalDate(payload.startedAt ?? payload.subscriptionStartDate, 'Data de început nu este validă.'),
      trialEndDate: this.optionalDate(payload.trialEndsAt ?? payload.trialEndDate, 'Data de final trial nu este validă.'),
      nextBillingDate: this.optionalDate(payload.nextBillingDate, 'Următoarea dată de facturare nu este validă.'),
      price: currentMonthlyAmount ?? 0,
      currency: this.enumValue(payload.currency, BillingCurrency, BillingCurrency.MDL, 'Moneda nu este validă.'),
      notes: this.nullableString(payload.internalNote ?? payload.notes),
    };
  }

  private calculateMonthlyAmount(
    contract: { pricingModel: ContractPricingModel; pricePerApartment: Prisma.Decimal | null; fixedMonthlyPrice: Prisma.Decimal | null; minimumMonthlyFee: Prisma.Decimal | null } | null,
    subscription: { price: number } | null,
    apartmentsCount: number,
  ) {
    if (!contract) return subscription?.price ?? null;
    if (contract.pricingModel === ContractPricingModel.PER_APARTMENT) {
      const base = apartmentsCount * this.decimalToNumber(contract.pricePerApartment);
      const minimum = contract.minimumMonthlyFee ? this.decimalToNumber(contract.minimumMonthlyFee) : null;
      return minimum !== null && base < minimum ? minimum : base;
    }
    if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY) {
      return this.decimalToNumber(contract.fixedMonthlyPrice);
    }
    return subscription?.price ?? null;
  }

  private warnings(
    contract: { status: OrganizationContractStatus; startDate: Date | null; pricingModel: ContractPricingModel; pricePerApartment: Prisma.Decimal | null; fixedMonthlyPrice: Prisma.Decimal | null } | null,
    subscription: { status: OrganizationSubscriptionStatus } | null,
    apartmentsCount: number,
  ) {
    const warnings: string[] = [];
    if (!contract) {
      warnings.push('Contractul nu este creat');
    } else {
      if (contract.status !== OrganizationContractStatus.SIGNED && contract.status !== OrganizationContractStatus.ACTIVE) warnings.push('Contractul nu este semnat');
      if (!contract.startDate) warnings.push('Nu există dată de început');
      if (contract.pricingModel === ContractPricingModel.PER_APARTMENT && !contract.pricePerApartment) warnings.push('Nu este setat tariful');
      if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY && !contract.fixedMonthlyPrice) warnings.push('Nu este setat tariful');
      if (contract.pricingModel === ContractPricingModel.PER_APARTMENT && apartmentsCount <= 0) {
        warnings.push('Organizația nu are apartamente, calculul per apartament nu poate fi estimat corect');
      }
    }
    if (!subscription || subscription.status !== OrganizationSubscriptionStatus.ACTIVE) warnings.push('Nu există abonament activ');
    return warnings;
  }

  private toContract(contract: any) {
    return {
      ...contract,
      pricePerApartment: this.decimalToNullableNumber(contract.pricePerApartment),
      fixedMonthlyPrice: this.decimalToNullableNumber(contract.fixedMonthlyPrice),
      minimumMonthlyFee: this.decimalToNullableNumber(contract.minimumMonthlyFee),
      createdBy: contract.createdBy ? this.toUser(contract.createdBy) : null,
      updatedBy: contract.updatedBy ? this.toUser(contract.updatedBy) : null,
    };
  }

  private toSubscription(subscription: any) {
    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      status: subscription.status,
      planName: subscription.planName || subscription.plan?.name || null,
      plan: subscription.plan,
      startedAt: subscription.subscriptionStartDate,
      subscriptionStartDate: subscription.subscriptionStartDate,
      trialEndsAt: subscription.trialEndDate,
      trialEndDate: subscription.trialEndDate,
      nextBillingDate: subscription.nextBillingDate,
      cancelledAt: subscription.status === OrganizationSubscriptionStatus.CANCELLED ? subscription.updatedAt : null,
      currentMonthlyAmount: subscription.price,
      price: subscription.price,
      currency: subscription.currency,
      internalNote: subscription.notes,
      notes: subscription.notes,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private toUser(user: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null }) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
    };
  }

  private async ensureOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!organization) throw new NotFoundException('Organizația nu a fost găsită.');
  }

  private async writeAudit(user: MvpUser, organizationId: string, action: string, entityId: string, before: unknown, after: any) {
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      organizationId,
      contractId: action.startsWith('CONTRACT') ? entityId : null,
      subscriptionId: action.startsWith('SUBSCRIPTION') ? entityId : null,
      action,
      entityType: action.startsWith('CONTRACT') ? 'CONTRACT' : 'SUBSCRIPTION',
      entityId,
      title: this.auditDescription(action),
      description: this.auditDescription(action),
      severity: action === 'CONTRACT_SIGNED' || action === 'CONTRACT_CREATED' || action === 'SUBSCRIPTION_CREATED' ? 'SUCCESS' : action === 'SUBSCRIPTION_CANCELLED' ? 'WARNING' : 'INFO',
      before: this.commercialAuditPayload(before),
      after: this.commercialAuditPayload(after),
      actionUrl: `/ro/superadmin/organizations/${organizationId}?tab=contract`,
    }).catch(() => null);
  }

  private commercialAuditPayload(value: any) {
    if (!value) return null;
    return {
      id: value.id,
      status: value.status,
      contractNumber: value.contractNumber,
      planName: value.planName,
      billingCycle: value.billingCycle,
      pricingModel: value.pricingModel,
      pricePerApartment: this.decimalToNullableNumber(value.pricePerApartment),
      fixedMonthlyPrice: this.decimalToNullableNumber(value.fixedMonthlyPrice),
      minimumMonthlyFee: this.decimalToNullableNumber(value.minimumMonthlyFee),
      price: value.price,
      currency: value.currency,
      startDate: value.startDate,
      endDate: value.endDate,
      signedAt: value.signedAt,
      cancelledAt: value.cancelledAt,
      subscriptionStartDate: value.subscriptionStartDate,
      trialEndDate: value.trialEndDate,
      nextBillingDate: value.nextBillingDate,
      paymentDueDay: value.paymentDueDay,
      documentUrl: value.documentUrl,
    };
  }

  private auditDescription(action: string) {
    const labels: Record<string, string> = {
      CONTRACT_CREATED: 'Contract comercial creat.',
      CONTRACT_UPDATED: 'Contract comercial actualizat.',
      CONTRACT_SIGNED: 'Contract comercial marcat ca semnat.',
      CONTRACT_CANCELLED: 'Contract comercial anulat.',
      SUBSCRIPTION_CREATED: 'Abonament comercial creat.',
      SUBSCRIPTION_UPDATED: 'Abonament comercial actualizat.',
      SUBSCRIPTION_CANCELLED: 'Abonament comercial anulat.',
    };
    return labels[action] || action;
  }

  private objectPayload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private enumValue<T extends Record<string, string>>(value: unknown, source: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toUpperCase();
    const allowed = Object.values(source) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }

  private nullableString(value: unknown) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
  }

  private optionalDate(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
    return date;
  }

  private optionalNumber(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(message);
    return number;
  }

  private optionalDecimal(value: unknown, message: string) {
    const number = this.optionalNumber(value, message);
    return number === null ? null : new Prisma.Decimal(number);
  }

  private optionalInt(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) throw new BadRequestException(message);
    return number;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : 0;
  }

  private decimalToNullableNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : null;
  }
}
