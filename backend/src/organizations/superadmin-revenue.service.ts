import { Injectable } from '@nestjs/common';
import {
  ContractPricingModel,
  OrganizationContractStatus,
  OrganizationLaunchStatus,
  OrganizationStatus,
  OrganizationSubscriptionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RevenueQuery = Record<string, string | number | boolean | undefined | null>;

type RevenueWarning = {
  code: string;
  label: string;
};

type RevenueRow = {
  organizationId: string;
  organizationName: string;
  legalName: string | null;
  city: string | null;
  apcCode: string | null;
  organizationStatus: OrganizationStatus;
  onboardingStatus: string | null;
  launchStatus: OrganizationLaunchStatus;
  contractStatus: OrganizationContractStatus | null;
  subscriptionStatus: OrganizationSubscriptionStatus | null;
  pricingModel: ContractPricingModel | null;
  billingCycle: string | null;
  planName: string | null;
  apartmentsCount: number;
  pricePerApartment: number | null;
  fixedMonthlyPrice: number | null;
  minimumMonthlyFee: number | null;
  estimatedMonthlyAmount: number | null;
  nextBillingDate: Date | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  sourceAccessRequest: {
    id: string;
    contactName: string;
    phone: string;
    email: string | null;
    createdAt: Date;
    convertedAt: Date | null;
  } | null;
  warningItems: RevenueWarning[];
  warnings: string[];
};

@Injectable()
export class SuperadminRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const rows = await this.loadRows();
    const activeRevenueRows = rows.filter((row) => this.isActiveRevenue(row));
    const estimatedMonthlyRevenue = this.sum(activeRevenueRows.map((row) => row.estimatedMonthlyAmount || 0));
    const totalApartmentsUnderContract = activeRevenueRows.reduce((total, row) => total + row.apartmentsCount, 0);
    const activeOrganizationsCount = rows.filter((row) => row.organizationStatus === OrganizationStatus.ACTIVE).length;
    const liveOrganizationsCount = rows.filter((row) => row.launchStatus === OrganizationLaunchStatus.LIVE).length;
    const trialOrganizationsCount = rows.filter((row) => row.subscriptionStatus === OrganizationSubscriptionStatus.TRIAL).length;
    const pastDueSubscriptionsCount = rows.filter((row) => row.subscriptionStatus === OrganizationSubscriptionStatus.PAST_DUE).length;
    const inactiveSubscriptionsCount = rows.filter((row) => !this.isSubscriptionRevenueActive(row.subscriptionStatus)).length;
    const unsignedContractsCount = rows.filter((row) => row.contractStatus && !this.isContractRevenueActive(row.contractStatus)).length;
    const missingContractsCount = rows.filter((row) => !row.contractStatus).length;
    const missingPricingCount = rows.filter((row) => row.contractStatus && !this.hasPricing(row)).length;
    const readyForBillingCount = rows.filter((row) => (
      row.launchStatus === OrganizationLaunchStatus.LIVE &&
      this.isContractRevenueActive(row.contractStatus) &&
      this.isSubscriptionRevenueActive(row.subscriptionStatus) &&
      this.hasPricing(row)
    )).length;

    return {
      currency: 'MDL',
      estimatedMonthlyRevenue,
      estimatedAnnualRevenue: this.roundMoney(estimatedMonthlyRevenue * 12),
      activeOrganizationsCount,
      liveOrganizationsCount,
      trialOrganizationsCount,
      pastDueSubscriptionsCount,
      inactiveSubscriptionsCount,
      unsignedContractsCount,
      missingContractsCount,
      missingPricingCount,
      readyForBillingCount,
      averageRevenuePerOrganization: activeRevenueRows.length ? this.roundMoney(estimatedMonthlyRevenue / activeRevenueRows.length) : 0,
      averageRevenuePerApartment: totalApartmentsUnderContract ? this.roundMoney(estimatedMonthlyRevenue / totalApartmentsUnderContract) : 0,
      totalApartmentsUnderContract,
      warnings: this.aggregateWarnings(rows),
      topOrganizations: [...rows]
        .filter((row) => (row.estimatedMonthlyAmount || 0) > 0)
        .sort((a, b) => (b.estimatedMonthlyAmount || 0) - (a.estimatedMonthlyAmount || 0))
        .slice(0, 5)
        .map((row) => this.publicRow(row)),
    };
  }

  async organizations(query: Record<string, string | undefined>) {
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const minMonthlyAmount = this.optionalNumber(query.minMonthlyAmount);
    const maxMonthlyAmount = this.optionalNumber(query.maxMonthlyAmount);
    const contractStatus = this.enumFilter(query.contractStatus, OrganizationContractStatus);
    const subscriptionStatus = this.enumFilter(query.subscriptionStatus, OrganizationSubscriptionStatus);

    let rows = await this.loadRows(query);
    if (contractStatus) rows = rows.filter((row) => row.contractStatus === contractStatus);
    if (subscriptionStatus) rows = rows.filter((row) => row.subscriptionStatus === subscriptionStatus);
    if (minMonthlyAmount !== null) rows = rows.filter((row) => (row.estimatedMonthlyAmount || 0) >= minMonthlyAmount);
    if (maxMonthlyAmount !== null) rows = rows.filter((row) => (row.estimatedMonthlyAmount || 0) <= maxMonthlyAmount);

    rows = rows.sort((a, b) => (b.estimatedMonthlyAmount || 0) - (a.estimatedMonthlyAmount || 0) || a.organizationName.localeCompare(b.organizationName));
    const total = rows.length;
    const start = (page - 1) * limit;

    return {
      items: rows.slice(start, start + limit).map((row) => this.publicRow(row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async pipeline() {
    const rows = await this.loadRows();
    const items = rows
      .map((row) => this.pipelineItem(row))
      .filter(Boolean)
      .sort((a, b) => (b!.estimatedMonthlyAmount || 0) - (a!.estimatedMonthlyAmount || 0))
      .map((item) => item!);

    return {
      items,
      total: items.length,
    };
  }

  async warnings() {
    const rows = await this.loadRows();
    const groups = new Map<string, { code: string; label: string; count: number; organizations: Array<ReturnType<SuperadminRevenueService['publicRow']>> }>();
    rows.forEach((row) => {
      row.warningItems.forEach((warning) => {
        const existing = groups.get(warning.code) || { code: warning.code, label: warning.label, count: 0, organizations: [] };
        existing.count += 1;
        existing.organizations.push(this.publicRow(row));
        groups.set(warning.code, existing);
      });
    });

    const items = Array.from(groups.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return {
      summary: items.map(({ code, label, count }) => ({ code, label, count })),
      items,
    };
  }

  private async loadRows(query: RevenueQuery = {}): Promise<RevenueRow[]> {
    const where: Prisma.OrganizationWhereInput = {
      isDemo: false,
    };
    const status = this.enumFilter(query.status, OrganizationStatus);
    const launchStatus = this.enumFilter(query.launchStatus, OrganizationLaunchStatus);
    const search = this.stringValue(query.search);

    if (status) where.status = status;
    if (launchStatus) where.launchStatus = launchStatus;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { fiscalCode: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const organizations = await this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        city: true,
        currency: true,
        status: true,
        onboardingStatus: true,
        launchStatus: true,
        createdAt: true,
        updatedAt: true,
        commercialContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            signedAt: true,
            currency: true,
            billingCycle: true,
            pricingModel: true,
            pricePerApartment: true,
            fixedMonthlyPrice: true,
            minimumMonthlyFee: true,
            paymentDueDay: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        subscriptionContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            planName: true,
            price: true,
            currency: true,
            subscriptionStartDate: true,
            trialEndDate: true,
            nextBillingDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        accessRequestsConverted: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            createdAt: true,
            convertedAt: true,
          },
        },
      },
    });

    const counts = await this.apartmentCounts(organizations.map((organization) => organization.id));
    return organizations.map((organization) => this.toRow(organization as any, counts.get(organization.id) || 0));
  }

  private async apartmentCounts(organizationIds: string[]) {
    const counts = new Map<string, number>();
    if (!organizationIds.length) return counts;
    const grouped = await this.prisma.apartment.groupBy({
      by: ['organizationId'],
      where: { organizationId: { in: organizationIds }, archivedAt: null },
      _count: { _all: true },
    });
    grouped.forEach((row) => counts.set(row.organizationId, row._count._all));
    return counts;
  }

  private toRow(organization: any, apartmentsCount: number): RevenueRow {
    const contract = organization.commercialContracts?.[0] || null;
    const subscription = organization.subscriptionContracts?.[0] || null;
    const sourceAccessRequest = organization.accessRequestsConverted?.[0] || null;
    const estimatedMonthlyAmount = this.calculateMonthlyAmount(contract, subscription, apartmentsCount);
    const rowBase = {
      organizationId: organization.id,
      organizationName: organization.name,
      legalName: organization.legalName,
      city: organization.city,
      apcCode: organization.fiscalCode,
      organizationStatus: organization.status,
      onboardingStatus: organization.onboardingStatus,
      launchStatus: organization.launchStatus,
      contractStatus: contract?.status || null,
      subscriptionStatus: subscription?.status || null,
      pricingModel: contract?.pricingModel || null,
      billingCycle: contract?.billingCycle || null,
      planName: subscription?.planName || null,
      apartmentsCount,
      pricePerApartment: this.decimalToNullableNumber(contract?.pricePerApartment),
      fixedMonthlyPrice: this.decimalToNullableNumber(contract?.fixedMonthlyPrice),
      minimumMonthlyFee: this.decimalToNullableNumber(contract?.minimumMonthlyFee),
      estimatedMonthlyAmount,
      nextBillingDate: subscription?.nextBillingDate || null,
      currency: contract?.currency || subscription?.currency || organization.currency || 'MDL',
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      sourceAccessRequest: sourceAccessRequest ? {
        id: sourceAccessRequest.id,
        contactName: sourceAccessRequest.fullName,
        phone: sourceAccessRequest.phone,
        email: sourceAccessRequest.email,
        createdAt: sourceAccessRequest.createdAt,
        convertedAt: sourceAccessRequest.convertedAt,
      } : null,
    } as Omit<RevenueRow, 'warningItems' | 'warnings'>;
    const warningItems = this.organizationWarnings(rowBase, contract, subscription);
    return {
      ...rowBase,
      warningItems,
      warnings: warningItems.map((warning) => warning.label),
    };
  }

  private publicRow(row: RevenueRow) {
    return {
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      legalName: row.legalName,
      city: row.city,
      apcCode: row.apcCode,
      organizationStatus: row.organizationStatus,
      onboardingStatus: row.onboardingStatus,
      launchStatus: row.launchStatus,
      contractStatus: row.contractStatus,
      subscriptionStatus: row.subscriptionStatus,
      pricingModel: row.pricingModel,
      billingCycle: row.billingCycle,
      planName: row.planName,
      apartmentsCount: row.apartmentsCount,
      pricePerApartment: row.pricePerApartment,
      fixedMonthlyPrice: row.fixedMonthlyPrice,
      minimumMonthlyFee: row.minimumMonthlyFee,
      estimatedMonthlyAmount: row.estimatedMonthlyAmount,
      nextBillingDate: row.nextBillingDate,
      currency: row.currency,
      warnings: row.warnings,
      sourceAccessRequest: row.sourceAccessRequest,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private pipelineItem(row: RevenueRow) {
    const reasons: string[] = [];
    let status = '';
    let nextAction = '';
    const pipelineContractStatuses: OrganizationContractStatus[] = [
      OrganizationContractStatus.NOT_STARTED,
      OrganizationContractStatus.DRAFT,
      OrganizationContractStatus.SENT,
    ];

    if (!row.contractStatus) {
      reasons.push('Lead convertit fără contract');
      status = 'Fără contract';
      nextAction = 'Creează contractul comercial';
    } else if (pipelineContractStatuses.includes(row.contractStatus)) {
      reasons.push(`Contract ${row.contractStatus.toLowerCase()}`);
      status = `Contract ${row.contractStatus}`;
      nextAction = 'Finalizează și semnează contractul';
    } else if (this.isContractRevenueActive(row.contractStatus) && !this.isSubscriptionRevenueActive(row.subscriptionStatus)) {
      reasons.push('Contract semnat fără abonament activ');
      status = 'Abonament neactiv';
      nextAction = 'Activează abonamentul';
    } else if (row.onboardingStatus === 'READY_FOR_LAUNCH' && row.launchStatus !== OrganizationLaunchStatus.LIVE) {
      reasons.push('Onboarding gata, organizație nelansată');
      status = 'Gata de lansare';
      nextAction = 'Lansează organizația';
    } else if (row.subscriptionStatus === OrganizationSubscriptionStatus.TRIAL) {
      reasons.push('Abonament în trial');
      status = 'Trial';
      nextAction = 'Confirmă trecerea în abonament activ';
    }

    if (!reasons.length) return null;
    return {
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      city: row.city,
      apcCode: row.apcCode,
      status,
      reasons,
      nextAction,
      contractStatus: row.contractStatus,
      subscriptionStatus: row.subscriptionStatus,
      launchStatus: row.launchStatus,
      onboardingStatus: row.onboardingStatus,
      estimatedMonthlyAmount: row.estimatedMonthlyAmount,
      currency: row.currency,
      warnings: row.warnings,
      sourceAccessRequest: row.sourceAccessRequest,
    };
  }

  private calculateMonthlyAmount(contract: any, subscription: any, apartmentsCount: number) {
    if (!contract) return subscription?.price ?? null;
    if (contract.pricingModel === ContractPricingModel.PER_APARTMENT) {
      const base = apartmentsCount * this.decimalToNumber(contract.pricePerApartment);
      const minimum = contract.minimumMonthlyFee ? this.decimalToNumber(contract.minimumMonthlyFee) : null;
      return this.roundMoney(minimum !== null && base < minimum ? minimum : base);
    }
    if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY) {
      return this.roundMoney(this.decimalToNumber(contract.fixedMonthlyPrice));
    }
    return subscription?.price ?? null;
  }

  private organizationWarnings(row: Omit<RevenueRow, 'warningItems' | 'warnings'>, contract: any, subscription: any): RevenueWarning[] {
    const warnings: RevenueWarning[] = [];
    const add = (code: string, label: string) => warnings.push({ code, label });
    const now = new Date();

    if (!contract) {
      add('MISSING_CONTRACT', 'Contract lipsă');
    } else {
      if (!this.isContractRevenueActive(contract.status)) add('UNSIGNED_CONTRACT', 'Contract nesemnat');
      if (!this.hasPricing(row)) add('MISSING_PRICING', 'Tarif lipsă');
      if (contract.endDate && new Date(contract.endDate) < now) add('EXPIRED_CONTRACT', 'Contract expirat');
      if (contract.pricingModel === ContractPricingModel.PER_APARTMENT && row.apartmentsCount <= 0) {
        add('PER_APARTMENT_ZERO_APARTMENTS', 'Per apartament, dar 0 apartamente');
      }
    }

    if (!subscription) {
      add('MISSING_SUBSCRIPTION', 'Subscription lipsă');
    } else if (subscription.status === OrganizationSubscriptionStatus.PAST_DUE) {
      add('PAST_DUE_SUBSCRIPTION', 'Subscription PAST_DUE');
    } else if (!this.isSubscriptionRevenueActive(subscription.status)) {
      add('INACTIVE_SUBSCRIPTION', 'Abonament inactiv');
    }

    if (row.launchStatus === OrganizationLaunchStatus.LIVE && !this.isContractRevenueActive(row.contractStatus)) {
      add('LIVE_WITHOUT_ACTIVE_CONTRACT', 'Organizație live fără contract activ');
    }

    return warnings;
  }

  private aggregateWarnings(rows: RevenueRow[]) {
    const groups = new Map<string, { code: string; label: string; count: number }>();
    rows.forEach((row) => {
      row.warningItems.forEach((warning) => {
        const current = groups.get(warning.code) || { code: warning.code, label: warning.label, count: 0 };
        current.count += 1;
        groups.set(warning.code, current);
      });
    });
    return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  private hasPricing(row: Pick<RevenueRow, 'pricingModel' | 'pricePerApartment' | 'fixedMonthlyPrice' | 'estimatedMonthlyAmount'>) {
    if (row.pricingModel === ContractPricingModel.PER_APARTMENT) return (row.pricePerApartment || 0) > 0;
    if (row.pricingModel === ContractPricingModel.FIXED_MONTHLY) return (row.fixedMonthlyPrice || 0) > 0;
    if (row.pricingModel === ContractPricingModel.CUSTOM) return (row.estimatedMonthlyAmount || 0) > 0;
    return false;
  }

  private isActiveRevenue(row: RevenueRow) {
    return (
      row.launchStatus === OrganizationLaunchStatus.LIVE &&
      this.isContractRevenueActive(row.contractStatus) &&
      this.isSubscriptionRevenueActive(row.subscriptionStatus) &&
      this.hasPricing(row) &&
      (row.estimatedMonthlyAmount || 0) > 0
    );
  }

  private isContractRevenueActive(status: OrganizationContractStatus | null) {
    return status === OrganizationContractStatus.SIGNED || status === OrganizationContractStatus.ACTIVE;
  }

  private isSubscriptionRevenueActive(status: OrganizationSubscriptionStatus | null) {
    return status === OrganizationSubscriptionStatus.ACTIVE || status === OrganizationSubscriptionStatus.TRIAL;
  }

  private enumFilter<T extends Record<string, string>>(value: unknown, source: T): T[keyof T] | null {
    const normalized = this.stringValue(value)?.toUpperCase();
    if (!normalized) return null;
    return (Object.values(source) as string[]).includes(normalized) ? normalized as T[keyof T] : null;
  }

  private positiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stringValue(value: unknown) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    return text || '';
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : 0;
  }

  private decimalToNullableNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : null;
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private sum(values: number[]) {
    return this.roundMoney(values.reduce((total, value) => total + value, 0));
  }
}
