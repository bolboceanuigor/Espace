import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationStatus, PlanCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PlanShape = {
  id: string;
  code: PlanCode;
  name: string;
  priceMonthly: number | null;
  currency: string | null;
  createdAt: Date;
};

const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'] as const;
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

@Injectable()
export class SaasManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      organizationsTotal,
      organizationsActive,
      organizationsTrial,
      organizationsInactive,
      adminsCount,
      residentsCount,
      apartmentsCount,
      metersCount,
      invoicesCount,
      recentOrganizations,
      recentAdmins,
      subscriptions,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ACTIVE } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.TRIAL } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.INACTIVE } }),
      this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
      this.prisma.residentProfile.count(),
      this.prisma.apartment.count(),
      this.prisma.meter.count(),
      this.prisma.invoice.count(),
      this.prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          legalName: true,
          fiscalCode: true,
          address: true,
          city: true,
          country: true,
          currency: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { apartments: true, users: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          organizationId: true,
          isActive: true,
          createdAt: true,
          organization: { select: { id: true, name: true, legalName: true, fiscalCode: true } },
        },
      }),
      this.prisma.subscription.findMany({
        where: { status: { in: ['TRIAL', 'ACTIVE'] }, isActive: true },
        select: { price: true, customPrice: true },
      }),
    ]);

    const estimatedMonthlyRevenue = subscriptions.reduce(
      (sum, subscription) => sum + Number(subscription.customPrice ?? subscription.price ?? 0),
      0,
    );

    return {
      organizationsTotal,
      organizationsActive,
      organizationsTrial,
      organizationsInactive,
      adminsCount,
      residentsCount,
      apartmentsCount,
      totalOrganizations: organizationsTotal,
      activeOrganizations: organizationsActive,
      trialOrganizations: organizationsTrial,
      inactiveOrganizations: organizationsInactive,
      totalAdmins: adminsCount,
      totalResidents: residentsCount,
      totalApartments: apartmentsCount,
      totalMeters: metersCount,
      totalInvoices: invoicesCount,
      estimatedMonthlyRevenue,
      recentOrganizations: recentOrganizations.map((organization) => this.toOverviewOrganization(organization)),
      recentAdmins: recentAdmins.map((admin) => this.toOverviewAdmin(admin)),
      currency: 'MDL',
    };
  }

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: [{ priceMonthly: 'asc' }, { createdAt: 'asc' }],
    });
    return plans.map((plan) => this.toPublicPlan(plan));
  }

  async createPlan(body: unknown) {
    const input = this.parsePlanBody(body, true);
    const existing = await this.prisma.plan.findUnique({
      where: { code: input.code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Există deja un plan cu acest cod.');
    }

    const plan = await this.prisma.plan.create({
      data: {
        code: input.code,
        name: input.name,
        priceMonthly: input.priceMonthly,
        currency: input.currency,
      },
    });

    return this.toPublicPlan(plan);
  }

  async updatePlan(id: string, body: unknown) {
    await this.ensurePlanExists(id);
    const input = this.parsePlanBody(body, false);

    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.priceMonthly !== undefined ? { priceMonthly: input.priceMonthly } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
      },
    });

    return this.toPublicPlan(plan);
  }

  async getOrganizationUsage(id: string) {
    await this.ensureOrganizationExists(id);
    const [apartmentsCount, usersCount, adminsCount, residentsCount, metersCount, invoicesCount, subscription] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId: id } }),
      this.prisma.user.count({ where: { organizationId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { organizationId: id, role: 'ADMIN', deletedAt: null } }),
      this.prisma.residentProfile.count({ where: { organizationId: id } }),
      this.prisma.meter.count({ where: { organizationId: id } }),
      this.prisma.invoice.count({ where: { organizationId: id } }),
      this.prisma.subscription.findUnique({
        where: { organizationId: id },
        include: { planDefinition: true },
      }),
    ]);

    const planCode = this.normalizePlanCode(subscription?.planDefinition?.code ?? subscription?.plan);
    const apartmentLimit = subscription?.apartmentLimit ?? this.defaultApartmentLimit(planCode);

    return {
      organizationId: id,
      apartmentsCount,
      usersCount,
      adminsCount,
      residentsCount,
      metersCount,
      invoicesCount,
      apartmentLimit,
      planApartmentLimit: apartmentLimit,
      usagePercentage: apartmentLimit > 0 ? Math.round((apartmentsCount / apartmentLimit) * 100) : 0,
      usagePercent: apartmentLimit > 0 ? Math.round((apartmentsCount / apartmentLimit) * 100) : 0,
    };
  }

  async getOrganizationSubscription(id: string) {
    await this.ensureOrganizationExists(id);
    const [subscription, apartmentsCount] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { organizationId: id },
        include: { planDefinition: true },
      }),
      this.prisma.apartment.count({ where: { organizationId: id } }),
    ]);

    if (!subscription) {
      return {
        organizationId: id,
        subscription: null,
        apartmentsCount,
      };
    }

    return {
      organizationId: id,
      subscription: this.toPublicSubscription(subscription, apartmentsCount),
      apartmentsCount,
    };
  }

  async upsertOrganizationSubscription(id: string, body: unknown) {
    await this.ensureOrganizationExists(id);
    const input = await this.parseSubscriptionBody(body);
    const existing = await this.prisma.subscription.findUnique({
      where: { organizationId: id },
      select: { id: true },
    });

    const plan = input.planId
      ? await this.prisma.plan.findUnique({ where: { id: input.planId } })
      : input.planCode
        ? await this.prisma.plan.findUnique({ where: { code: input.planCode } })
        : null;

    if (input.planId && !plan) {
      throw new NotFoundException('Planul nu există.');
    }

    const planCode = this.normalizePlanCode(plan?.code ?? input.planCode);
    const price = input.price ?? plan?.priceMonthly ?? 0;
    const apartmentLimit = input.apartmentLimit ?? this.defaultApartmentLimit(planCode);
    const now = new Date();
    const trialEndsAt = input.trialEndsAt ?? this.addDays(now, 14);
    const currentPeriodStart = input.currentPeriodStart ?? now;
    const currentPeriodEnd = input.currentPeriodEnd ?? this.addMonths(currentPeriodStart, 1);

    const data = {
      planId: plan?.id ?? input.planId ?? null,
      plan: String(planCode).toLowerCase(),
      status: input.status,
      currentPeriodStart,
      currentPeriodEnd,
      price,
      customPrice: input.customPrice ?? null,
      apartmentLimit,
      trialEndsAt,
      subscriptionEndsAt: input.status === 'CANCELLED' ? now : null,
      isActive: input.status !== 'CANCELLED',
    };

    const subscription = existing
      ? await this.prisma.subscription.update({
          where: { organizationId: id },
          data,
          include: { planDefinition: true },
        })
      : await this.prisma.subscription.create({
          data: {
            organizationId: id,
            ...data,
          },
          include: { planDefinition: true },
        });

    const apartmentsCount = await this.prisma.apartment.count({ where: { organizationId: id } });
    return this.toPublicSubscription(subscription, apartmentsCount);
  }

  private toPublicPlan(plan: PlanShape) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceMonthly: plan.priceMonthly ?? 0,
      currency: plan.currency || 'MDL',
      apartmentLimit: this.defaultApartmentLimit(plan.code),
      features: this.defaultFeatures(plan.code),
      status: 'ACTIVE',
      createdAt: plan.createdAt,
    };
  }

  private toOverviewOrganization(organization: {
    id: string;
    name: string;
    legalName: string | null;
    fiscalCode: string | null;
    address: string | null;
    city: string | null;
    country: string;
    currency: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { apartments?: number; users?: number };
  }) {
    const associationCode = this.extractAssociationCode(organization.fiscalCode, organization.name, organization.legalName);
    return {
      id: organization.id,
      name: organization.name,
      shortName: organization.name,
      legalName: organization.legalName || (associationCode ? `Asociația de Proprietari din Condominiu ${associationCode}` : organization.name),
      associationCode,
      associationNumber: associationCode.match(/-(\d{4})$/)?.[1] || '',
      address: organization.address,
      city: organization.city,
      country: organization.country === 'MD' || organization.country.toLowerCase() === 'moldova' ? 'Republica Moldova' : organization.country,
      currency: organization.currency,
      status: organization.status,
      apartmentsCount: organization._count?.apartments ?? 0,
      usersCount: organization._count?.users ?? 0,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  private toOverviewAdmin(admin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: string;
    organizationId: string;
    isActive: boolean;
    createdAt: Date;
    organization?: { id: string; name: string; legalName: string | null; fiscalCode: string | null } | null;
  }) {
    const associationCode = this.extractAssociationCode(admin.organization?.fiscalCode, admin.organization?.name, admin.organization?.legalName);
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      role: admin.role,
      organizationId: admin.organizationId,
      isActive: admin.isActive,
      status: admin.isActive ? 'ACTIVE' : 'INACTIVE',
      organization: admin.organization
        ? {
            id: admin.organization.id,
            name: admin.organization.name,
            shortName: admin.organization.name,
            legalName: admin.organization.legalName,
            associationCode,
          }
        : null,
      createdAt: admin.createdAt,
    };
  }

  private toPublicSubscription(
    subscription: {
      id: string;
      organizationId: string;
      planId: string | null;
      plan: string;
      status: string;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      price: number;
      customPrice: number | null;
      apartmentLimit: number;
      trialEndsAt: Date;
      subscriptionEndsAt: Date | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      planDefinition?: PlanShape | null;
    },
    apartmentsCount: number,
  ) {
    const planCode = this.normalizePlanCode(subscription.planDefinition?.code ?? subscription.plan);
    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      planId: subscription.planId,
      planCode,
      planName: subscription.planDefinition?.name || this.defaultPlanName(planCode),
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      price: subscription.price,
      customPrice: subscription.customPrice,
      monthlyCost: subscription.customPrice ?? subscription.price,
      currency: subscription.planDefinition?.currency || 'MDL',
      apartmentLimit: subscription.apartmentLimit,
      apartmentsCount,
      usagePercentage: subscription.apartmentLimit > 0 ? Math.round((apartmentsCount / subscription.apartmentLimit) * 100) : 0,
      isActive: subscription.isActive,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private parsePlanBody(body: unknown, requireName: boolean) {
    const payload = this.payload(body);
    const code = this.optionalPlanCode(payload.code, PlanCode.STARTER);
    const name = requireName
      ? this.requiredString(payload.name, 'Numele planului este obligatoriu.')
      : this.optionalString(payload.name);
    const priceMonthly = this.optionalNumber(payload.priceMonthly, requireName ? 0 : undefined, 'Prețul lunar nu este valid.');
    const currency = this.optionalCurrency(payload.currency);
    return { code, name, priceMonthly, currency };
  }

  private async parseSubscriptionBody(body: unknown) {
    const payload = this.payload(body);
    return {
      planId: this.optionalString(payload.planId),
      planCode: payload.planCode || payload.plan ? this.optionalPlanCode(payload.planCode ?? payload.plan, PlanCode.STARTER) : undefined,
      status: this.optionalSubscriptionStatus(payload.status, 'TRIAL'),
      trialEndsAt: this.optionalDate(payload.trialEndsAt),
      currentPeriodStart: this.optionalDate(payload.currentPeriodStart),
      currentPeriodEnd: this.optionalDate(payload.currentPeriodEnd),
      price: this.optionalNumber(payload.price, undefined, 'Costul lunar nu este valid.'),
      customPrice: this.optionalNumber(payload.customPrice, undefined, 'Costul lunar nu este valid.'),
      apartmentLimit: this.optionalInteger(payload.apartmentLimit, undefined, 'Limita de apartamente nu este validă.'),
    };
  }

  private defaultPlanName(code: PlanCode) {
    if (code === PlanCode.FREE) return 'Free';
    if (code === PlanCode.TRIAL) return 'Trial';
    if (code === PlanCode.PRO) return 'Pro';
    return 'Starter';
  }

  private defaultApartmentLimit(code: PlanCode) {
    if (code === PlanCode.FREE) return 25;
    if (code === PlanCode.TRIAL) return 75;
    if (code === PlanCode.PRO) return 500;
    return 150;
  }

  private defaultFeatures(code: PlanCode) {
    if (code === PlanCode.FREE) return ['Apartamente', 'Locatari', 'Avizier'];
    if (code === PlanCode.TRIAL) return ['Apartamente', 'Locatari', 'Contoare', 'Cereri'];
    if (code === PlanCode.PRO) return ['Apartamente', 'Locatari', 'Contoare', 'Plăți', 'Cereri', 'Mesaje', 'Rapoarte'];
    return ['Apartamente', 'Locatari', 'Contoare', 'Plăți', 'Cereri', 'Avizier'];
  }

  private normalizePlanCode(value: unknown): PlanCode {
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      if (Object.values(PlanCode).includes(normalized as PlanCode)) return normalized as PlanCode;
    }
    return PlanCode.STARTER;
  }

  private extractAssociationCode(...values: Array<string | null | undefined>) {
    for (const value of values) {
      const match = String(value || '').match(/A\d{4}-\d{4}/i);
      if (match) return match[0].toUpperCase();
    }
    return '';
  }

  private optionalPlanCode(value: unknown, fallback: PlanCode) {
    if (value === undefined || value === null || value === '') return fallback;
    return this.normalizePlanCode(value);
  }

  private optionalSubscriptionStatus(value: unknown, fallback: SubscriptionStatus): SubscriptionStatus {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException('Statusul abonamentului nu este valid.');
    const normalized = value.trim().toUpperCase();
    if (!SUBSCRIPTION_STATUSES.includes(normalized as SubscriptionStatus)) {
      throw new BadRequestException('Statusul abonamentului nu este valid.');
    }
    return normalized as SubscriptionStatus;
  }

  private optionalCurrency(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return 'MDL';
    const normalized = value.trim().toUpperCase();
    return ['MDL', 'EUR', 'USD'].includes(normalized) ? normalized : 'MDL';
  }

  private async ensureOrganizationExists(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!organization) throw new NotFoundException('Organization not found');
  }

  private async ensurePlanExists(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id }, select: { id: true } });
    if (!plan) throw new NotFoundException('Planul nu există.');
  }

  private payload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private optionalNumber(value: unknown, fallback: number | undefined, message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) throw new BadRequestException(message);
    return numeric;
  }

  private optionalInteger(value: unknown, fallback: number | undefined, message: string) {
    const numeric = this.optionalNumber(value, fallback, message);
    if (numeric === undefined) return undefined;
    return Math.round(numeric);
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data nu este validă.');
    return date;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }
}
