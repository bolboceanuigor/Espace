import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  Prisma,
  SaasBillingCycle,
  SaasPlan,
  SaasPlanStatus,
  SaasSubscription,
  SaasSubscriptionEventType,
  SaasSubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

const CURRENT_SUBSCRIPTION_STATUSES: SaasSubscriptionStatus[] = [
  SaasSubscriptionStatus.TRIALING,
  SaasSubscriptionStatus.ACTIVE,
  SaasSubscriptionStatus.PAST_DUE,
  SaasSubscriptionStatus.SUSPENDED,
];

const PRESET_PLANS = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'Pentru asociații mici și primele APC-uri în Espace.',
    status: SaasPlanStatus.ACTIVE,
    monthlyPrice: 499,
    yearlyPrice: 4990,
    trialDays: 14,
    isPublic: true,
    isDefault: true,
    limits: {
      maxApartments: 100,
      maxResidents: 250,
      maxStaffMembers: 3,
      maxMeters: 300,
      maxInvoicesPerMonth: 150,
      maxAnnouncementsPerMonth: 20,
      maxRequestsPerMonth: 100,
      maxStorageMB: 500,
    },
    features: {
      apartmentsCrm: true,
      residentsCrm: true,
      internalInvoices: true,
      manualPayments: true,
      meterReadings: true,
      meterBasedTariffs: false,
      billingRun: false,
      dataQuality: false,
      announcements: true,
      requests: true,
      basicReports: true,
      financialReports: false,
      consumptionReports: false,
      csvImport: true,
      csvExport: true,
      staffRoles: false,
      auditLog: false,
      supportAccess: false,
      duplicateDetection: false,
      advancedSecurity: false,
    },
  },
  {
    code: 'STANDARD',
    name: 'Standard',
    description: 'Pentru asociații medii care folosesc facturare lunară și rapoarte.',
    status: SaasPlanStatus.ACTIVE,
    monthlyPrice: 1299,
    yearlyPrice: 12990,
    trialDays: 14,
    isPublic: true,
    isDefault: false,
    limits: {
      maxApartments: 300,
      maxResidents: 800,
      maxStaffMembers: 8,
      maxMeters: 1000,
      maxInvoicesPerMonth: 400,
      maxAnnouncementsPerMonth: 100,
      maxRequestsPerMonth: 500,
      maxStorageMB: 2000,
    },
    features: {
      apartmentsCrm: true,
      residentsCrm: true,
      internalInvoices: true,
      manualPayments: true,
      meterReadings: true,
      meterBasedTariffs: true,
      billingRun: true,
      dataQuality: true,
      announcements: true,
      requests: true,
      basicReports: true,
      financialReports: true,
      consumptionReports: true,
      csvImport: true,
      csvExport: true,
      staffRoles: true,
      auditLog: true,
      supportAccess: false,
      duplicateDetection: false,
      advancedSecurity: false,
    },
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'Pentru asociații mari și administratori cu fluxuri avansate.',
    status: SaasPlanStatus.ACTIVE,
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    trialDays: 14,
    isPublic: true,
    isDefault: false,
    limits: {
      maxApartments: 1000,
      maxResidents: 3000,
      maxStaffMembers: 25,
      maxMeters: 4000,
      maxInvoicesPerMonth: 1500,
      maxAnnouncementsPerMonth: 500,
      maxRequestsPerMonth: 2000,
      maxStorageMB: 10000,
    },
    features: {
      apartmentsCrm: true,
      residentsCrm: true,
      internalInvoices: true,
      manualPayments: true,
      meterReadings: true,
      meterBasedTariffs: true,
      billingRun: true,
      dataQuality: true,
      announcements: true,
      requests: true,
      basicReports: true,
      financialReports: true,
      consumptionReports: true,
      csvImport: true,
      csvExport: true,
      staffRoles: true,
      auditLog: true,
      supportAccess: true,
      duplicateDetection: true,
      advancedImports: true,
      advancedReports: true,
      advancedSecurity: true,
      prioritySupport: true,
    },
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Plan custom pentru clienți cu condiții și limite dedicate.',
    status: SaasPlanStatus.ACTIVE,
    monthlyPrice: 0,
    yearlyPrice: null,
    trialDays: 30,
    isPublic: false,
    isDefault: false,
    limits: {
      maxApartments: null,
      maxResidents: null,
      maxStaffMembers: null,
      maxMeters: null,
      maxInvoicesPerMonth: null,
      maxAnnouncementsPerMonth: null,
      maxRequestsPerMonth: null,
      maxStorageMB: null,
    },
    features: {
      apartmentsCrm: true,
      residentsCrm: true,
      internalInvoices: true,
      manualPayments: true,
      meterReadings: true,
      meterBasedTariffs: true,
      billingRun: true,
      dataQuality: true,
      announcements: true,
      requests: true,
      basicReports: true,
      financialReports: true,
      consumptionReports: true,
      csvImport: true,
      csvExport: true,
      staffRoles: true,
      auditLog: true,
      supportAccess: true,
      duplicateDetection: true,
      advancedImports: true,
      advancedReports: true,
      advancedSecurity: true,
      prioritySupport: true,
      dedicatedSupport: true,
      customTerms: true,
    },
  },
] as const;

type Actor = { id?: string; sub?: string } | null | undefined;

type PlanPayload = Record<string, unknown>;
type SubscriptionPayload = Record<string, unknown>;

@Injectable()
export class SaasBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePresetPlans() {
    for (const preset of PRESET_PLANS) {
      const existing = await this.prisma.saasPlan.findUnique({ where: { code: preset.code }, select: { id: true } });
      if (existing) continue;
      await this.prisma.saasPlan.create({
        data: {
          code: preset.code,
          name: preset.name,
          description: preset.description,
          status: preset.status,
          currency: BillingCurrency.MDL,
          monthlyPrice: preset.monthlyPrice,
          yearlyPrice: preset.yearlyPrice ?? null,
          trialDays: preset.trialDays,
          ...preset.limits,
          limits: preset.limits as Prisma.InputJsonValue,
          features: preset.features as Prisma.InputJsonValue,
          isPublic: preset.isPublic,
          isDefault: preset.isDefault,
        },
      });
    }
  }

  async overview() {
    await this.ensurePresetPlans();
    const [associations, plans, subscriptions, recentEvents] = await Promise.all([
      this.prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, legalName: true, fiscalCode: true, status: true, createdAt: true },
      }),
      this.prisma.saasPlan.findMany({ where: { status: SaasPlanStatus.ACTIVE }, orderBy: { monthlyPrice: 'asc' } }),
      this.prisma.saasSubscription.findMany({
        where: { status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
        include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true } } },
      }),
      this.prisma.saasSubscriptionEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { association: { select: { id: true, name: true, legalName: true, fiscalCode: true } }, actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
    ]);
    const currentByAssociation = new Set(subscriptions.map((subscription) => subscription.associationId));
    const byStatus = this.countBy(subscriptions, (subscription) => subscription.status);
    const planDistribution = Array.from(
      subscriptions.reduce<Map<string, { planCode: string; planName: string; count: number }>>((acc, subscription) => {
        const key = subscription.plan.code;
        const current = acc.get(key) || { planCode: subscription.plan.code, planName: subscription.plan.name, count: 0 };
        current.count += 1;
        acc.set(key, current);
        return acc;
      }, new Map()).values(),
    );
    const now = new Date();
    const soon = this.addDays(now, 7);
    const estimatedMonthlyRevenue = subscriptions
      .filter((subscription) => subscription.status === SaasSubscriptionStatus.ACTIVE)
      .reduce((sum, subscription) => sum + this.monthlyEquivalent(subscription.price, subscription.billingCycle), 0);

    return {
      summary: {
        totalAssociations: associations.length,
        activeAssociations: associations.filter((association) => String(association.status) === 'ACTIVE').length,
        activeSubscriptions: byStatus.ACTIVE || 0,
        trialing: byStatus.TRIALING || 0,
        suspended: byStatus.SUSPENDED || 0,
        cancelled: await this.prisma.saasSubscription.count({ where: { status: SaasSubscriptionStatus.CANCELLED } }),
        withoutSubscription: associations.length - currentByAssociation.size,
        activePlans: plans.length,
        estimatedMonthlyRevenue,
        estimatedYearlyRevenue: estimatedMonthlyRevenue * 12,
        currency: 'MDL',
      },
      planDistribution,
      subscriptionsByStatus: byStatus,
      plans: plans.map((plan) => this.serializePlan(plan)),
      recentSubscriptions: subscriptions.slice(0, 8).map((subscription) => this.serializeSubscription(subscription)),
      associationsWithoutSubscription: associations
        .filter((association) => !currentByAssociation.has(association.id))
        .slice(0, 8)
        .map((association) => this.serializeAssociation(association)),
      trialsEndingSoon: subscriptions
        .filter((subscription) => subscription.status === SaasSubscriptionStatus.TRIALING && subscription.trialEndsAt && subscription.trialEndsAt <= soon)
        .map((subscription) => this.serializeSubscription(subscription)),
      suspendedSubscriptions: subscriptions
        .filter((subscription) => subscription.status === SaasSubscriptionStatus.SUSPENDED)
        .map((subscription) => this.serializeSubscription(subscription)),
      recentEvents: recentEvents.map((event) => this.serializeEvent(event)),
    };
  }

  async listPlans(query: Record<string, unknown>) {
    await this.ensurePresetPlans();
    const search = this.optionalString(query.search)?.toLowerCase();
    const status = this.optionalEnum(query.status, SaasPlanStatus);
    const isPublic = this.optionalBoolean(query.isPublic);
    const isDefault = this.optionalBoolean(query.isDefault);
    const plans = await this.prisma.saasPlan.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(isPublic === undefined ? {} : { isPublic }),
        ...(isDefault === undefined ? {} : { isDefault }),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: [{ status: 'asc' }, { monthlyPrice: 'asc' }, { createdAt: 'asc' }],
    });
    return { items: plans.map((plan) => this.serializePlan(plan)), meta: { total: plans.length } };
  }

  async createPlan(actor: Actor, body: unknown) {
    const input = this.parsePlan(body, true);
    const existing = await this.prisma.saasPlan.findUnique({ where: { code: input.code }, select: { id: true } });
    if (existing) throw new ConflictException('Există deja un plan SaaS cu acest cod.');
    const createData = {
        ...input.data,
        code: input.code,
        createdById: this.actorId(actor),
        updatedById: this.actorId(actor),
    } as Prisma.SaasPlanUncheckedCreateInput;
    const plan = await this.prisma.saasPlan.create({ data: createData });
    await this.audit(this.actorId(actor), 'SAAS_PLAN_CREATED', 'SAAS_PLAN', plan.id, `Plan SaaS creat: ${plan.name}.`, { planId: plan.id, planCode: plan.code });
    return this.serializePlan(plan);
  }

  async getPlan(id: string) {
    await this.ensurePresetPlans();
    const plan = await this.prisma.saasPlan.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
        subscriptions: {
          where: { status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
          include: { association: { select: { id: true, name: true, legalName: true, fiscalCode: true } } },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!plan) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    return {
      plan: this.serializePlan(plan),
      subscriptions: plan.subscriptions.map((subscription) => this.serializeSubscription(subscription)),
    };
  }

  async updatePlan(actor: Actor, id: string, body: unknown) {
    const existing = await this.prisma.saasPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    const input = this.parsePlan(body, false);
    const plan = await this.prisma.saasPlan.update({
      where: { id },
      data: {
        ...input.data,
        ...(input.code ? { code: input.code } : {}),
        updatedById: this.actorId(actor),
      },
    });
    await this.audit(this.actorId(actor), 'SAAS_PLAN_UPDATED', 'SAAS_PLAN', plan.id, `Plan SaaS actualizat: ${plan.name}.`, { planId: plan.id, planCode: plan.code });
    return this.serializePlan(plan);
  }

  async updatePlanStatus(actor: Actor, id: string, body: unknown) {
    const status = this.requiredEnum(this.payload(body).status, SaasPlanStatus, 'Statusul planului nu este valid.');
    const plan = await this.prisma.saasPlan.update({
      where: { id },
      data: { status, updatedById: this.actorId(actor) },
    }).catch(() => null);
    if (!plan) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    await this.audit(this.actorId(actor), 'SAAS_PLAN_STATUS_CHANGED', 'SAAS_PLAN', plan.id, `Status plan schimbat în ${status}.`, { planId: plan.id, planCode: plan.code, newStatus: status });
    return this.serializePlan(plan);
  }

  async duplicatePlan(actor: Actor, id: string) {
    const source = await this.prisma.saasPlan.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    const code = await this.uniquePlanCode(`${source.code}_COPY`);
    const plan = await this.prisma.saasPlan.create({
      data: {
        code,
        name: `${source.name} copy`,
        description: source.description,
        status: SaasPlanStatus.DRAFT,
        currency: source.currency,
        monthlyPrice: source.monthlyPrice,
        yearlyPrice: source.yearlyPrice,
        trialDays: source.trialDays,
        maxApartments: source.maxApartments,
        maxResidents: source.maxResidents,
        maxStaffMembers: source.maxStaffMembers,
        maxMeters: source.maxMeters,
        maxInvoicesPerMonth: source.maxInvoicesPerMonth,
        maxAnnouncementsPerMonth: source.maxAnnouncementsPerMonth,
        maxRequestsPerMonth: source.maxRequestsPerMonth,
        maxStorageMB: source.maxStorageMB,
        features: source.features as Prisma.InputJsonValue,
        limits: source.limits as Prisma.InputJsonValue,
        isPublic: false,
        isDefault: false,
        createdById: this.actorId(actor),
        updatedById: this.actorId(actor),
      },
    });
    await this.audit(this.actorId(actor), 'SAAS_PLAN_DUPLICATED', 'SAAS_PLAN', plan.id, `Plan SaaS duplicat din ${source.code}.`, { sourcePlanId: source.id, planId: plan.id, planCode: plan.code });
    return this.serializePlan(plan);
  }

  async planAssociations(id: string) {
    const plan = await this.prisma.saasPlan.findUnique({ where: { id }, select: { id: true } });
    if (!plan) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    const subscriptions = await this.prisma.saasSubscription.findMany({
      where: { planId: id },
      include: { association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } }, plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return { items: subscriptions.map((subscription) => this.serializeSubscription(subscription)), meta: { total: subscriptions.length } };
  }

  async listSubscriptions(query: Record<string, unknown>) {
    await this.ensurePresetPlans();
    const { page, limit } = resolvePagination({ page: Number(query.page) || undefined, limit: Number(query.limit) || undefined }, 20, 100);
    const search = this.optionalString(query.search)?.toLowerCase();
    const status = this.optionalEnum(query.status, SaasSubscriptionStatus);
    const planId = this.optionalString(query.planId);
    const billingCycle = this.optionalEnum(query.billingCycle, SaasBillingCycle);
    const trialEndingSoon = this.optionalBoolean(query.trialEndingSoon);
    const noSubscription = this.optionalBoolean(query.noSubscription);

    if (noSubscription) {
      const current = await this.prisma.saasSubscription.findMany({
        where: { status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
        select: { associationId: true },
      });
      const currentIds = current.map((row) => row.associationId);
      const organizations = await this.prisma.organization.findMany({
        where: {
          id: { notIn: currentIds },
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { legalName: { contains: search, mode: 'insensitive' } },
                  { fiscalCode: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      const start = (page - 1) * limit;
      return {
        items: organizations.slice(start, start + limit).map((organization) => ({ association: this.serializeAssociation(organization), subscription: null })),
        meta: buildPaginationMeta(page, limit, organizations.length),
      };
    }

    const soon = this.addDays(new Date(), 7);
    const where: Prisma.SaasSubscriptionWhereInput = {
      ...(status ? { status } : {}),
      ...(planId ? { planId } : {}),
      ...(billingCycle ? { billingCycle } : {}),
      ...(trialEndingSoon ? { status: SaasSubscriptionStatus.TRIALING, trialEndsAt: { lte: soon } } : {}),
      ...(search
        ? {
            OR: [
              { association: { name: { contains: search, mode: 'insensitive' } } },
              { association: { legalName: { contains: search, mode: 'insensitive' } } },
              { association: { fiscalCode: { contains: search, mode: 'insensitive' } } },
              { plan: { code: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, subscriptions] = await Promise.all([
      this.prisma.saasSubscription.count({ where }),
      this.prisma.saasSubscription.findMany({
        where,
        include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: await Promise.all(subscriptions.map((subscription) => this.serializeSubscriptionWithUsage(subscription))),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async createOrAssignSubscription(actor: Actor, body: unknown, associationIdFromPath?: string) {
    const input = this.parseSubscription(body, associationIdFromPath);
    const association = await this.prisma.organization.findUnique({ where: { id: input.associationId }, select: { id: true, name: true } });
    if (!association) throw new NotFoundException('Asociația nu a fost găsită.');
    const plan = await this.prisma.saasPlan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    if (plan.status !== SaasPlanStatus.ACTIVE) throw new BadRequestException('Doar planurile ACTIVE pot fi asignate.');

    const existing = await this.currentSubscription(input.associationId);
    const snapshot = this.snapshots(plan);
    const now = new Date();
    const status = input.status || SaasSubscriptionStatus.TRIALING;
    const billingCycle = input.billingCycle || SaasBillingCycle.MONTHLY;
    const price = input.price ?? (status === SaasSubscriptionStatus.TRIALING ? 0 : this.defaultPrice(plan, billingCycle));
    const trialDays = input.trialDays ?? plan.trialDays;
    const trialStartedAt = status === SaasSubscriptionStatus.TRIALING ? now : input.trialStartedAt;
    const trialEndsAt = status === SaasSubscriptionStatus.TRIALING ? this.addDays(now, trialDays) : input.trialEndsAt;
    const currentPeriodStart = input.currentPeriodStart || now;
    const currentPeriodEnd = input.currentPeriodEnd || (status === SaasSubscriptionStatus.TRIALING ? trialEndsAt : this.periodEnd(currentPeriodStart, billingCycle));

    const data = {
      planId: plan.id,
      status,
      billingCycle,
      currency: input.currency || plan.currency,
      price,
      trialStartedAt,
      trialEndsAt,
      currentPeriodStart,
      currentPeriodEnd,
      activatedAt: status === SaasSubscriptionStatus.ACTIVE ? now : null,
      expiresAt: status === SaasSubscriptionStatus.EXPIRED ? now : null,
      planSnapshot: snapshot.plan as Prisma.InputJsonValue,
      limitsSnapshot: snapshot.limits as Prisma.InputJsonValue,
      featuresSnapshot: snapshot.features as Prisma.InputJsonValue,
      internalNotes: input.internalNotes || null,
      updatedById: this.actorId(actor),
    };

    const subscription = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.saasSubscription.update({
            where: { id: existing.id },
            data,
            include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } } },
          })
        : await tx.saasSubscription.create({
            data: {
              associationId: input.associationId,
              createdById: this.actorId(actor),
              ...data,
            },
            include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } } },
          });
      await this.createEventTx(tx, saved, this.actorId(actor), existing ? SaasSubscriptionEventType.PLAN_ASSIGNED : SaasSubscriptionEventType.SUBSCRIPTION_CREATED, existing ? 'Plan asignat' : 'Abonament creat', `${plan.name} a fost asignat asociației ${association.name}.`, { planId: plan.id, status });
      if (status === SaasSubscriptionStatus.TRIALING) {
        await this.createEventTx(tx, saved, this.actorId(actor), SaasSubscriptionEventType.TRIAL_STARTED, 'Trial pornit', `Trial pornit până la ${trialEndsAt?.toISOString().slice(0, 10)}.`, { trialDays });
      }
      return saved;
    });
    await this.audit(this.actorId(actor), existing ? 'SAAS_SUBSCRIPTION_PLAN_CHANGED' : 'SAAS_SUBSCRIPTION_CREATED', 'SAAS_SUBSCRIPTION', subscription.id, `Abonament actualizat pentru ${association.name}.`, { subscriptionId: subscription.id, associationId: association.id, planId: plan.id, status });
    return this.serializeSubscription(subscription);
  }

  async getSubscription(id: string) {
    const subscription = await this.prisma.saasSubscription.findUnique({
      where: { id },
      include: {
        plan: true,
        association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } },
        events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } } },
      },
    });
    if (!subscription) throw new NotFoundException('Abonamentul nu a fost găsit.');
    return {
      subscription: await this.serializeSubscriptionWithUsage(subscription),
      events: subscription.events.map((event) => this.serializeEvent(event)),
    };
  }

  async changePlan(actor: Actor, id: string, body: unknown) {
    const subscription = await this.findSubscription(id);
    const payload = this.payload(body);
    const planId = this.requiredString(payload.planId, 'Planul este obligatoriu.');
    const plan = await this.prisma.saasPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Planul SaaS nu a fost găsit.');
    if (plan.status !== SaasPlanStatus.ACTIVE) throw new BadRequestException('Doar planurile ACTIVE pot fi asignate.');
    const billingCycle = this.optionalEnum(payload.billingCycle, SaasBillingCycle) || subscription.billingCycle;
    const snapshot = this.snapshots(plan);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.saasSubscription.update({
        where: { id },
        data: {
          planId: plan.id,
          billingCycle,
          currency: this.optionalCurrency(payload.currency) || plan.currency,
          price: this.optionalNumber(payload.price, undefined, 'Prețul nu este valid.') ?? this.defaultPrice(plan, billingCycle),
          planSnapshot: snapshot.plan as Prisma.InputJsonValue,
          limitsSnapshot: snapshot.limits as Prisma.InputJsonValue,
          featuresSnapshot: snapshot.features as Prisma.InputJsonValue,
          updatedById: this.actorId(actor),
        },
        include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } } },
      });
      await this.createEventTx(tx, saved, this.actorId(actor), SaasSubscriptionEventType.PLAN_CHANGED, 'Plan schimbat', `Planul a fost schimbat în ${plan.name}.`, { oldPlanId: subscription.planId, newPlanId: plan.id });
      return saved;
    });
    await this.audit(this.actorId(actor), 'SAAS_SUBSCRIPTION_PLAN_CHANGED', 'SAAS_SUBSCRIPTION', id, 'Plan abonament schimbat.', { subscriptionId: id, oldPlanId: subscription.planId, newPlanId: plan.id });
    return this.serializeSubscription(updated);
  }

  async activate(actor: Actor, id: string) {
    const subscription = await this.findSubscription(id);
    const now = new Date();
    const currentPeriodStart = subscription.currentPeriodStart || now;
    const currentPeriodEnd = subscription.currentPeriodEnd || this.periodEnd(currentPeriodStart, subscription.billingCycle);
    return this.statusTransition(actor, id, SaasSubscriptionStatus.ACTIVE, SaasSubscriptionEventType.SUBSCRIPTION_ACTIVATED, 'Abonament activat', 'Abonamentul a fost activat.', {
      activatedAt: now,
      currentPeriodStart,
      currentPeriodEnd,
    });
  }

  async suspend(actor: Actor, id: string, body: unknown) {
    const reason = this.requiredString(this.payload(body).reason, 'Motivul suspendării este obligatoriu.');
    return this.statusTransition(actor, id, SaasSubscriptionStatus.SUSPENDED, SaasSubscriptionEventType.SUBSCRIPTION_SUSPENDED, 'Abonament suspendat', reason, {
      suspendedAt: new Date(),
      suspendedById: this.actorId(actor),
      suspensionReason: reason,
    });
  }

  async reactivate(actor: Actor, id: string) {
    return this.statusTransition(actor, id, SaasSubscriptionStatus.ACTIVE, SaasSubscriptionEventType.SUBSCRIPTION_REACTIVATED, 'Abonament reactivat', 'Abonamentul a fost reactivat.', {
      activatedAt: new Date(),
    });
  }

  async cancel(actor: Actor, id: string, body: unknown) {
    const reason = this.requiredString(this.payload(body).reason, 'Motivul anulării este obligatoriu.');
    return this.statusTransition(actor, id, SaasSubscriptionStatus.CANCELLED, SaasSubscriptionEventType.SUBSCRIPTION_CANCELLED, 'Abonament anulat', reason, {
      cancelledAt: new Date(),
      cancelledById: this.actorId(actor),
      cancellationReason: reason,
      expiresAt: new Date(),
    });
  }

  async addNote(actor: Actor, id: string, body: unknown) {
    const subscription = await this.findSubscription(id);
    const note = this.requiredString(this.payload(body).note || this.payload(body).message, 'Nota internă este obligatorie.');
    const event = await this.prisma.saasSubscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        associationId: subscription.associationId,
        actorUserId: this.actorId(actor),
        eventType: SaasSubscriptionEventType.INTERNAL_NOTE_ADDED,
        title: 'Notă internă',
        message: note,
        metadata: { note } as Prisma.InputJsonValue,
      },
    });
    await this.audit(this.actorId(actor), 'SAAS_SUBSCRIPTION_NOTE_ADDED', 'SAAS_SUBSCRIPTION', id, 'Notă internă adăugată la abonament.', { subscriptionId: id });
    return this.serializeEvent(event);
  }

  async getAssociationSubscription(associationId: string) {
    const association = await this.prisma.organization.findUnique({
      where: { id: associationId },
      select: { id: true, name: true, legalName: true, fiscalCode: true, status: true },
    });
    if (!association) throw new NotFoundException('Asociația nu a fost găsită.');
    const subscription = await this.currentSubscription(associationId, true);
    const usage = await this.usageSummary(associationId, subscription?.limitsSnapshot as Record<string, unknown> | undefined);
    return {
      association: this.serializeAssociation(association),
      subscription: subscription ? this.serializeSubscription(subscription as any) : null,
      usage,
      events: subscription
        ? await this.prisma.saasSubscriptionEvent
            .findMany({ where: { subscriptionId: subscription.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } } })
            .then((events) => events.map((event) => this.serializeEvent(event)))
        : [],
    };
  }

  async getAssociationUsage(associationId: string) {
    const subscription = await this.currentSubscription(associationId, true);
    return this.usageSummary(associationId, subscription?.limitsSnapshot as Record<string, unknown> | undefined);
  }

  async adminSubscriptionSummary(associationId: string) {
    const subscription = await this.currentSubscription(associationId, true);
    if (!subscription) return null;
    return {
      status: subscription.status,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      billingCycle: subscription.billingCycle,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      limits: subscription.limitsSnapshot,
      features: subscription.featuresSnapshot,
    };
  }

  private async statusTransition(
    actor: Actor,
    id: string,
    status: SaasSubscriptionStatus,
    eventType: SaasSubscriptionEventType,
    title: string,
    message: string,
    extraData: Prisma.SaasSubscriptionUncheckedUpdateInput,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const data = { status, updatedById: this.actorId(actor), ...extraData } as Prisma.SaasSubscriptionUncheckedUpdateInput;
      const saved = await tx.saasSubscription.update({
        where: { id },
        data,
        include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } } },
      });
      await this.createEventTx(tx, saved, this.actorId(actor), eventType, title, message, { status });
      return saved;
    }).catch(() => null);
    if (!updated) throw new NotFoundException('Abonamentul nu a fost găsit.');
    const action =
      status === SaasSubscriptionStatus.ACTIVE && eventType === SaasSubscriptionEventType.SUBSCRIPTION_REACTIVATED
        ? 'SAAS_SUBSCRIPTION_REACTIVATED'
        : status === SaasSubscriptionStatus.ACTIVE
          ? 'SAAS_SUBSCRIPTION_ACTIVATED'
          : status === SaasSubscriptionStatus.SUSPENDED
            ? 'SAAS_SUBSCRIPTION_SUSPENDED'
            : status === SaasSubscriptionStatus.CANCELLED
              ? 'SAAS_SUBSCRIPTION_CANCELLED'
              : 'SAAS_SUBSCRIPTION_UPDATED';
    await this.audit(this.actorId(actor), action, 'SAAS_SUBSCRIPTION', id, title, { subscriptionId: id, newStatus: status });
    return this.serializeSubscription(updated);
  }

  private async findSubscription(id: string) {
    const subscription = await this.prisma.saasSubscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Abonamentul nu a fost găsit.');
    return subscription;
  }

  private async currentSubscription(associationId: string, includePlan = false) {
    return this.prisma.saasSubscription.findFirst({
      where: { associationId, status: { in: CURRENT_SUBSCRIPTION_STATUSES } },
      include: includePlan ? { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } } } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async usageSummary(associationId: string, limits?: Record<string, unknown>) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [
      apartmentsCount,
      residentsCount,
      staffMembersCount,
      metersCount,
      invoicesThisMonth,
      announcementsThisMonth,
      requestsThisMonth,
    ] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId: associationId } }),
      this.prisma.residentProfile.count({ where: { organizationId: associationId } }),
      this.prisma.organizationMember.count({ where: { organizationId: associationId, status: 'ACTIVE' } }).catch(() => 0),
      this.prisma.meter.count({ where: { organizationId: associationId } }),
      this.prisma.invoice.count({ where: { organizationId: associationId, issuedAt: { gte: monthStart } } }),
      this.prisma.announcement.count({ where: { organizationId: associationId, createdAt: { gte: monthStart } } }),
      this.prisma.issue.count({ where: { organizationId: associationId, createdAt: { gte: monthStart } } }),
    ]);
    return {
      apartments: this.usageMetric(apartmentsCount, limits?.maxApartments),
      residents: this.usageMetric(residentsCount, limits?.maxResidents),
      staffMembers: this.usageMetric(staffMembersCount, limits?.maxStaffMembers),
      meters: this.usageMetric(metersCount, limits?.maxMeters),
      invoicesThisMonth: this.usageMetric(invoicesThisMonth, limits?.maxInvoicesPerMonth),
      announcementsThisMonth: this.usageMetric(announcementsThisMonth, limits?.maxAnnouncementsPerMonth),
      requestsThisMonth: this.usageMetric(requestsThisMonth, limits?.maxRequestsPerMonth),
      storageUsedMB: this.usageMetric(null, limits?.maxStorageMB),
    };
  }

  private usageMetric(used: number | null, rawLimit: unknown) {
    const limit = typeof rawLimit === 'number' ? rawLimit : null;
    if (used === null) return { used: null, limit, percent: null, status: limit === null ? 'UNLIMITED' : 'OK' };
    if (limit === null) return { used, limit: null, percent: null, status: 'UNLIMITED' };
    const percent = limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : 0;
    return {
      used,
      limit,
      percent,
      status: percent >= 100 ? 'OVER_LIMIT' : percent >= 80 ? 'NEAR_LIMIT' : 'OK',
    };
  }

  private parsePlan(body: unknown, isCreate: boolean) {
    const payload = this.payload(body);
    const code = payload.code === undefined && !isCreate ? undefined : this.requiredString(payload.code, 'Codul planului este obligatoriu.').toUpperCase().replace(/\s+/g, '_');
    if (code && !/^[A-Z0-9_]+$/.test(code)) throw new BadRequestException('Codul planului trebuie să fie uppercase slug.');
    const name = payload.name === undefined && !isCreate ? undefined : this.requiredString(payload.name, 'Numele planului este obligatoriu.');
    const data: Prisma.SaasPlanUncheckedUpdateInput = {
      ...(name ? { name } : {}),
      ...(payload.description !== undefined ? { description: this.optionalString(payload.description) || null } : {}),
      ...(payload.status !== undefined ? { status: this.requiredEnum(payload.status, SaasPlanStatus, 'Statusul planului nu este valid.') } : {}),
      ...(payload.currency !== undefined ? { currency: this.optionalCurrency(payload.currency) || BillingCurrency.MDL } : {}),
      ...(payload.monthlyPrice !== undefined ? { monthlyPrice: this.optionalNumber(payload.monthlyPrice, 0, 'Prețul lunar nu este valid.') } : {}),
      ...(payload.yearlyPrice !== undefined ? { yearlyPrice: this.optionalNullableNumber(payload.yearlyPrice, 'Prețul anual nu este valid.') } : {}),
      ...(payload.trialDays !== undefined ? { trialDays: this.optionalInteger(payload.trialDays, 0, 'Trial days nu este valid.') } : {}),
      ...this.limitFields(payload),
      ...(payload.features !== undefined ? { features: this.featuresPayload(payload.features) as Prisma.InputJsonValue } : isCreate ? { features: {} } : {}),
      ...(payload.limits !== undefined ? { limits: this.payload(payload.limits) as Prisma.InputJsonValue } : {}),
      ...(payload.isPublic !== undefined ? { isPublic: Boolean(payload.isPublic) } : {}),
      ...(payload.isDefault !== undefined ? { isDefault: Boolean(payload.isDefault) } : {}),
    };
    return { code, data };
  }

  private parseSubscription(body: unknown, associationIdFromPath?: string) {
    const payload = this.payload(body);
    return {
      associationId: associationIdFromPath || this.requiredString(payload.associationId, 'Asociația este obligatorie.'),
      planId: this.requiredString(payload.planId, 'Planul este obligatoriu.'),
      status: payload.status ? this.requiredEnum(payload.status, SaasSubscriptionStatus, 'Statusul abonamentului nu este valid.') : undefined,
      billingCycle: payload.billingCycle ? this.requiredEnum(payload.billingCycle, SaasBillingCycle, 'Ciclul de facturare nu este valid.') : undefined,
      currency: this.optionalCurrency(payload.currency),
      price: this.optionalNumber(payload.price, undefined, 'Prețul nu este valid.'),
      trialDays: this.optionalInteger(payload.trialDays, payload.expiresInDays ? undefined : undefined, 'Durata trial nu este validă.'),
      trialStartedAt: this.optionalDate(payload.trialStartedAt),
      trialEndsAt: this.optionalDate(payload.trialEndsAt),
      currentPeriodStart: this.optionalDate(payload.currentPeriodStart),
      currentPeriodEnd: this.optionalDate(payload.currentPeriodEnd),
      internalNotes: this.optionalString(payload.internalNotes),
    };
  }

  private limitFields(payload: PlanPayload) {
    const keys = [
      'maxApartments',
      'maxResidents',
      'maxStaffMembers',
      'maxMeters',
      'maxInvoicesPerMonth',
      'maxAnnouncementsPerMonth',
      'maxRequestsPerMonth',
      'maxStorageMB',
    ];
    return keys.reduce<Record<string, number | null>>((acc, key) => {
      if (payload[key] !== undefined) acc[key] = this.optionalNullableInteger(payload[key], `${key} nu este valid.`);
      return acc;
    }, {});
  }

  private snapshots(plan: SaasPlan) {
    const limits = {
      maxApartments: plan.maxApartments,
      maxResidents: plan.maxResidents,
      maxStaffMembers: plan.maxStaffMembers,
      maxMeters: plan.maxMeters,
      maxInvoicesPerMonth: plan.maxInvoicesPerMonth,
      maxAnnouncementsPerMonth: plan.maxAnnouncementsPerMonth,
      maxRequestsPerMonth: plan.maxRequestsPerMonth,
      maxStorageMB: plan.maxStorageMB,
    };
    return {
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        status: plan.status,
        currency: plan.currency,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialDays: plan.trialDays,
      },
      limits,
      features: this.payload(plan.features),
    };
  }

  private serializePlan(plan: SaasPlan & { _count?: { subscriptions?: number } }) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      currency: plan.currency,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      trialDays: plan.trialDays,
      maxApartments: plan.maxApartments,
      maxResidents: plan.maxResidents,
      maxStaffMembers: plan.maxStaffMembers,
      maxMeters: plan.maxMeters,
      maxInvoicesPerMonth: plan.maxInvoicesPerMonth,
      maxAnnouncementsPerMonth: plan.maxAnnouncementsPerMonth,
      maxRequestsPerMonth: plan.maxRequestsPerMonth,
      maxStorageMB: plan.maxStorageMB,
      limits: plan.limits || this.snapshots(plan).limits,
      features: this.payload(plan.features),
      isPublic: plan.isPublic,
      isDefault: plan.isDefault,
      subscriptionsCount: plan._count?.subscriptions || 0,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private serializeSubscription(subscription: any) {
    return {
      id: subscription.id,
      associationId: subscription.associationId,
      association: subscription.association ? this.serializeAssociation(subscription.association) : null,
      planId: subscription.planId,
      plan: subscription.plan ? this.serializePlan(subscription.plan) : null,
      planCode: subscription.plan?.code || this.payload(subscription.planSnapshot).code,
      planName: subscription.plan?.name || this.payload(subscription.planSnapshot).name,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currency: subscription.currency,
      price: subscription.price,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      activatedAt: subscription.activatedAt,
      suspendedAt: subscription.suspendedAt,
      suspensionReason: subscription.suspensionReason,
      cancelledAt: subscription.cancelledAt,
      cancellationReason: subscription.cancellationReason,
      expiresAt: subscription.expiresAt,
      planSnapshot: subscription.planSnapshot,
      limitsSnapshot: subscription.limitsSnapshot,
      featuresSnapshot: subscription.featuresSnapshot,
      internalNotes: subscription.internalNotes,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private async serializeSubscriptionWithUsage(subscription: any) {
    return {
      ...this.serializeSubscription(subscription),
      usage: await this.usageSummary(subscription.associationId, this.payload(subscription.limitsSnapshot)),
    };
  }

  private serializeAssociation(association: any) {
    const associationCode = this.extractAssociationCode(association.fiscalCode, association.name, association.legalName);
    return {
      id: association.id,
      name: association.name,
      shortName: association.name,
      legalName: association.legalName,
      associationCode,
      status: association.status,
      createdAt: association.createdAt,
    };
  }

  private serializeEvent(event: any) {
    return {
      id: event.id,
      subscriptionId: event.subscriptionId,
      associationId: event.associationId,
      eventType: event.eventType,
      title: event.title,
      message: event.message,
      metadata: event.metadata || {},
      actor: event.actor
        ? {
            id: event.actor.id,
            fullName: this.fullName(event.actor),
            email: event.actor.email,
          }
        : null,
      association: event.association ? this.serializeAssociation(event.association) : null,
      createdAt: event.createdAt,
    };
  }

  private async createEventTx(
    tx: Prisma.TransactionClient,
    subscription: SaasSubscription,
    actorUserId: string | null,
    eventType: SaasSubscriptionEventType,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    return tx.saasSubscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        associationId: subscription.associationId,
        actorUserId,
        eventType,
        title,
        message,
        metadata: (metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async audit(actorUserId: string | null, action: string, entityType: string, entityId: string | null, description: string, metadata?: Record<string, unknown>) {
    if (!actorUserId) return null;
    return this.prisma.auditLog
      .create({
        data: {
          userId: actorUserId,
          organizationId: typeof metadata?.associationId === 'string' ? metadata.associationId : null,
          action,
          entityType,
          entityId,
          description,
          newValuesJson: { title: description, message: description, metadata: metadata || {} } as Prisma.InputJsonValue,
        },
      })
      .catch(() => null);
  }

  private defaultPrice(plan: SaasPlan, billingCycle: SaasBillingCycle) {
    if (billingCycle === SaasBillingCycle.YEARLY) return plan.yearlyPrice ?? plan.monthlyPrice * 12;
    return plan.monthlyPrice;
  }

  private monthlyEquivalent(price: number, billingCycle: SaasBillingCycle) {
    if (billingCycle === SaasBillingCycle.YEARLY) return price / 12;
    return price;
  }

  private periodEnd(start: Date, billingCycle: SaasBillingCycle) {
    if (billingCycle === SaasBillingCycle.YEARLY) return this.addMonths(start, 12);
    if (billingCycle === SaasBillingCycle.CUSTOM) return this.addMonths(start, 1);
    return this.addMonths(start, 1);
  }

  private async uniquePlanCode(base: string) {
    let index = 1;
    let code = base;
    while (await this.prisma.saasPlan.findUnique({ where: { code }, select: { id: true } })) {
      index += 1;
      code = `${base}_${index}`;
    }
    return code;
  }

  private countBy<T>(items: T[], getKey: (item: T) => string) {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = getKey(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  private payload(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private featuresPayload(value: unknown) {
    if (Array.isArray(value)) {
      return value.reduce<Record<string, boolean>>((acc, key) => {
        if (typeof key === 'string' && key.trim()) acc[key.trim()] = true;
        return acc;
      }, {});
    }
    return this.payload(value);
  }

  private actorId(actor: Actor) {
    return actor?.id || actor?.sub || null;
  }

  private fullName(user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Superadmin';
  }

  private extractAssociationCode(...values: Array<string | null | undefined>) {
    for (const value of values) {
      const match = String(value || '').match(/A\d{4}-\d{4}/i);
      if (match) return match[0].toUpperCase();
    }
    return '';
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
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(message);
    return number;
  }

  private optionalNullableNumber(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    return this.optionalNumber(value, undefined, message) ?? null;
  }

  private optionalInteger(value: unknown, fallback: number | undefined, message: string) {
    const number = this.optionalNumber(value, fallback, message);
    return number === undefined ? undefined : Math.round(number);
  }

  private optionalNullableInteger(value: unknown, message: string) {
    const number = this.optionalNullableNumber(value, message);
    return number === null ? null : Math.round(number);
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data nu este validă.');
    return date;
  }

  private optionalBoolean(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
  }

  private optionalCurrency(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const normalized = String(value).trim().toUpperCase();
    if (!Object.values(BillingCurrency).includes(normalized as BillingCurrency)) throw new BadRequestException('Moneda nu este validă.');
    return normalized as BillingCurrency;
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, enumObject: T) {
    if (value === undefined || value === null || value === '') return undefined;
    return this.requiredEnum(value, enumObject, 'Valoarea nu este validă.');
  }

  private requiredEnum<T extends Record<string, string>>(value: unknown, enumObject: T, message: string): T[keyof T] {
    const normalized = String(value || '').trim().toUpperCase();
    const values = Object.values(enumObject);
    if (!values.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
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
