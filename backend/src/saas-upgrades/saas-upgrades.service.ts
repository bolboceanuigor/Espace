import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  Prisma,
  SaasBillingCycle,
  SaasPlanStatus,
  SaasSubscriptionStatus,
  SaasUpgradeRequestReason,
  SaasUpgradeRequestStatus,
} from '@prisma/client';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SaasBillingService } from '../saas-billing/saas-billing.service';
import { SaasUsageService } from '../saas-usage/saas-usage.service';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string | null };

const OPEN_STATUSES: SaasUpgradeRequestStatus[] = [SaasUpgradeRequestStatus.PENDING, SaasUpgradeRequestStatus.IN_REVIEW];
const REVIEWABLE_STATUSES: SaasUpgradeRequestStatus[] = [SaasUpgradeRequestStatus.PENDING, SaasUpgradeRequestStatus.IN_REVIEW];

@Injectable()
export class SaasUpgradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: SaasUsageService,
    private readonly billing: SaasBillingService,
  ) {}

  async adminUpgradeOptions(actor: Actor) {
    const associationId = this.adminAssociationId(actor);
    const [usage, plans, openRequest] = await Promise.all([
      this.usage.getAssociationUsage(associationId),
      this.prisma.saasPlan.findMany({ where: { status: SaasPlanStatus.ACTIVE }, orderBy: [{ monthlyPrice: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.saasUpgradeRequest.findFirst({
        where: { associationId, status: { in: OPEN_STATUSES } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    ]);
    const currentPlanId = usage.subscription?.planId || null;
    return {
      currentSubscription: usage.subscription,
      usageWarnings: usage.warnings,
      limits: usage.limits,
      availablePlans: plans.filter((plan) => plan.id !== currentPlanId).map((plan) => this.planOption(plan)),
      hasOpenRequest: Boolean(openRequest),
      openRequestId: openRequest?.id || null,
    };
  }

  async adminCreate(actor: Actor, body: unknown) {
    const associationId = this.adminAssociationId(actor);
    const payload = this.payload(body);
    const reason = this.requiredEnum(payload.reason, SaasUpgradeRequestReason, 'Motivul cererii este obligatoriu.');
    const message = this.optionalString(payload.message);
    if (reason === SaasUpgradeRequestReason.OTHER && (!message || message.length < 10)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Mesajul trebuie să aibă cel puțin 10 caractere pentru Alt motiv.' });
    }
    const requestedPlanId = this.optionalString(payload.requestedPlanId);
    if (requestedPlanId) await this.assertActivePlan(requestedPlanId);
    const existing = await this.prisma.saasUpgradeRequest.findFirst({
      where: { associationId, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (existing && !this.optionalBoolean(payload.confirmSeparateRequest)) {
      throw new BadRequestException({
        code: 'SAAS_UPGRADE_REQUEST_ALREADY_OPEN',
        message: 'Există deja o cerere de upgrade în procesare pentru această asociație.',
        details: { openRequestId: existing.id, status: existing.status },
      });
    }
    const usage = await this.usage.getAssociationUsage(associationId);
    const currentPlanId = usage.subscription?.planId || null;
    const request = await this.prisma.saasUpgradeRequest.create({
      data: {
        associationId,
        subscriptionId: usage.subscription?.id || null,
        currentPlanId,
        requestedPlanId: requestedPlanId || null,
        reason,
        message,
        requestedById: this.actorId(actor),
        metadata: {
          currentSubscription: usage.subscription,
          usageSummary: usage.usageSummary,
          warnings: usage.warnings,
          limits: usage.limits,
          affectedLimitKey: this.optionalString(payload.affectedLimitKey),
          affectedFeatureKey: this.optionalString(payload.affectedFeatureKey),
        } as Prisma.InputJsonValue,
      },
      include: this.detailInclude(),
    });
    await this.audit(this.actorId(actor), 'SAAS_UPGRADE_REQUEST_CREATED', request.associationId, request.id, {
      requestId: request.id,
      associationId,
      currentPlanId,
      requestedPlanId,
      reason,
    });
    return this.serializeDetail(request);
  }

  async adminList(actor: Actor) {
    const associationId = this.adminAssociationId(actor);
    const requests = await this.prisma.saasUpgradeRequest.findMany({
      where: { associationId },
      include: this.listInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return { items: requests.map((request) => this.serializeListItem(request)), meta: { total: requests.length } };
  }

  async adminGet(actor: Actor, id: string) {
    const associationId = this.adminAssociationId(actor);
    const request = await this.prisma.saasUpgradeRequest.findFirst({
      where: { id, associationId },
      include: this.detailInclude(),
    });
    if (!request) throw new NotFoundException('Cererea de upgrade nu a fost găsită.');
    return this.serializeDetail(request);
  }

  async adminCancel(actor: Actor, id: string, body: unknown) {
    const associationId = this.adminAssociationId(actor);
    const existing = await this.prisma.saasUpgradeRequest.findFirst({ where: { id, associationId } });
    if (!existing) throw new NotFoundException('Cererea de upgrade nu a fost găsită.');
    if (existing.status !== SaasUpgradeRequestStatus.PENDING) {
      throw new ForbiddenException({ code: 'SAAS_UPGRADE_REQUEST_NOT_CANCELLABLE', message: 'Poți anula doar cererile în așteptare.' });
    }
    const request = await this.prisma.saasUpgradeRequest.update({
      where: { id },
      data: {
        status: SaasUpgradeRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: this.actorId(actor),
        cancellationReason: this.optionalString(this.payload(body).cancellationReason),
      },
      include: this.detailInclude(),
    });
    await this.audit(this.actorId(actor), 'SAAS_UPGRADE_REQUEST_CANCELLED', associationId, id, { requestId: id, associationId });
    return this.serializeDetail(request);
  }

  async superadminList(query: Record<string, unknown>) {
    const { page, limit } = resolvePagination({ page: Number(query.page) || undefined, limit: Number(query.limit) || undefined }, 20, 100);
    const where = this.superadminWhere(query);
    const [total, requests] = await Promise.all([
      this.prisma.saasUpgradeRequest.count({ where }),
      this.prisma.saasUpgradeRequest.findMany({
        where,
        include: this.listInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: requests.map((request) => this.serializeListItem(request)), meta: buildPaginationMeta(page, limit, total) };
  }

  async superadminStats() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [byStatus, thisMonth, limitRelated, latest] = await Promise.all([
      this.prisma.saasUpgradeRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.saasUpgradeRequest.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.saasUpgradeRequest.count({ where: { reason: { in: [SaasUpgradeRequestReason.LIMIT_REACHED, SaasUpgradeRequestReason.NEAR_LIMIT] } } }),
      this.prisma.saasUpgradeRequest.findFirst({ orderBy: { createdAt: 'desc' }, include: this.listInclude() }),
    ]);
    const statusCounts = byStatus.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: row._count._all }), {});
    return {
      pending: statusCounts.PENDING || 0,
      inReview: statusCounts.IN_REVIEW || 0,
      approved: statusCounts.APPROVED || 0,
      rejected: statusCounts.REJECTED || 0,
      cancelled: statusCounts.CANCELLED || 0,
      thisMonth,
      limitRelated,
      latest: latest ? this.serializeListItem(latest) : null,
    };
  }

  async superadminGet(id: string) {
    const request = await this.prisma.saasUpgradeRequest.findUnique({ where: { id }, include: this.detailInclude() });
    if (!request) throw new NotFoundException('Cererea de upgrade nu a fost găsită.');
    const [associationHistory, subscriptionHistory, auditEvents] = await Promise.all([
      this.prisma.saasUpgradeRequest.findMany({
        where: { associationId: request.associationId, id: { not: id } },
        include: this.listInclude(),
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.saasSubscriptionEvent.findMany({
        where: { associationId: request.associationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: request.associationId, entityType: 'SAAS_UPGRADE_REQUEST', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      ...this.serializeDetail(request),
      previousRequests: associationHistory.map((item) => this.serializeListItem(item)),
      subscriptionEvents: subscriptionHistory,
      auditEvents,
    };
  }

  async superadminAssociationRequests(associationId: string) {
    const requests = await this.prisma.saasUpgradeRequest.findMany({
      where: { associationId },
      include: this.listInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return { items: requests.map((request) => this.serializeListItem(request)), meta: { total: requests.length } };
  }

  async markInReview(actor: Actor, id: string) {
    const existing = await this.requireReviewable(id);
    if (existing.status !== SaasUpgradeRequestStatus.PENDING) {
      throw new BadRequestException('Doar cererile în așteptare pot fi marcate în verificare.');
    }
    const request = await this.prisma.saasUpgradeRequest.update({
      where: { id },
      data: { status: SaasUpgradeRequestStatus.IN_REVIEW, reviewedById: this.actorId(actor), reviewedAt: new Date() },
      include: this.detailInclude(),
    });
    await this.audit(this.actorId(actor), 'SAAS_UPGRADE_REQUEST_IN_REVIEW', request.associationId, id, { requestId: id, associationId: request.associationId });
    return this.serializeDetail(request);
  }

  async approve(actor: Actor, id: string, body: unknown) {
    const existing = await this.requireReviewable(id);
    const payload = this.payload(body);
    const applyPlanChangeNow = this.optionalBoolean(payload.applyPlanChangeNow);
    const selectedPlanId = this.optionalString(payload.selectedPlanId) || existing.requestedPlanId;
    if (applyPlanChangeNow && !selectedPlanId) throw new BadRequestException('Planul selectat este obligatoriu pentru schimbarea planului.');
    if (selectedPlanId) await this.assertActivePlan(selectedPlanId);

    let appliedSubscriptionId: string | null = null;
    if (applyPlanChangeNow && selectedPlanId) {
      const subscription = await this.usage.getCurrentSubscription(existing.associationId);
      const changeBody = {
        planId: selectedPlanId,
        billingCycle: this.optionalEnum(payload.billingCycle, SaasBillingCycle) || subscription?.billingCycle || SaasBillingCycle.MONTHLY,
        ...(payload.price !== undefined ? { price: this.optionalNumber(payload.price, 'Prețul nu este valid.') } : {}),
        ...(payload.internalNotes !== undefined ? { internalNotes: this.optionalString(payload.internalNotes) } : {}),
      };
      const changed = subscription
        ? await this.billing.changePlan(actor, subscription.id, changeBody)
        : await this.billing.createOrAssignSubscription(actor, {
            associationId: existing.associationId,
            planId: selectedPlanId,
            status: SaasSubscriptionStatus.ACTIVE,
            billingCycle: changeBody.billingCycle,
            ...(changeBody.price !== undefined ? { price: changeBody.price } : {}),
            internalNotes: this.optionalString(payload.internalNotes),
          });
      appliedSubscriptionId = (changed as any).id || (changed as any).subscription?.id || subscription?.id || null;
      await this.audit(this.actorId(actor), 'SAAS_UPGRADE_PLAN_CHANGE_APPLIED', existing.associationId, id, {
        requestId: id,
        associationId: existing.associationId,
        selectedPlanId,
        appliedSubscriptionId,
      });
    }

    const request = await this.prisma.saasUpgradeRequest.update({
      where: { id },
      data: {
        status: SaasUpgradeRequestStatus.APPROVED,
        reviewedById: this.actorId(actor),
        reviewedAt: new Date(),
        approvedAt: new Date(),
        adminResponse: this.optionalString(payload.adminResponse) || null,
        appliedPlanChange: Boolean(applyPlanChangeNow),
        appliedSubscriptionId,
        ...(selectedPlanId ? { requestedPlanId: existing.requestedPlanId || selectedPlanId } : {}),
        metadata: {
          ...(this.payload(existing.metadata)),
          review: {
            adminResponse: this.optionalString(payload.adminResponse),
            applyPlanChangeNow,
            selectedPlanId,
            billingCycle: changeBodyValue(payload.billingCycle),
            price: payload.price ?? null,
            internalNotes: this.optionalString(payload.internalNotes),
          },
        } as Prisma.InputJsonValue,
      },
      include: this.detailInclude(),
    });
    await this.audit(this.actorId(actor), 'SAAS_UPGRADE_REQUEST_APPROVED', request.associationId, id, {
      requestId: id,
      associationId: request.associationId,
      currentPlanId: request.currentPlanId,
      requestedPlanId: request.requestedPlanId,
      selectedPlanId,
      appliedPlanChange: Boolean(applyPlanChangeNow),
    });
    return this.serializeDetail(request);
  }

  async reject(actor: Actor, id: string, body: unknown) {
    const existing = await this.requireReviewable(id);
    const payload = this.payload(body);
    const adminResponse = this.requiredString(payload.adminResponse, 'Răspunsul către Admin este obligatoriu pentru respingere.');
    const request = await this.prisma.saasUpgradeRequest.update({
      where: { id },
      data: {
        status: SaasUpgradeRequestStatus.REJECTED,
        reviewedById: this.actorId(actor),
        reviewedAt: new Date(),
        rejectedAt: new Date(),
        adminResponse,
        metadata: {
          ...(this.payload(existing.metadata)),
          review: { adminResponse, internalNotes: this.optionalString(payload.internalNotes) },
        } as Prisma.InputJsonValue,
      },
      include: this.detailInclude(),
    });
    await this.audit(this.actorId(actor), 'SAAS_UPGRADE_REQUEST_REJECTED', request.associationId, id, {
      requestId: id,
      associationId: request.associationId,
      currentPlanId: request.currentPlanId,
      requestedPlanId: request.requestedPlanId,
      reason: request.reason,
    });
    return this.serializeDetail(request);
  }

  private async requireReviewable(id: string) {
    const request = await this.prisma.saasUpgradeRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Cererea de upgrade nu a fost găsită.');
    if (!REVIEWABLE_STATUSES.includes(request.status)) {
      throw new BadRequestException('Cererea nu mai poate fi procesată.');
    }
    return request;
  }

  private superadminWhere(query: Record<string, unknown>): Prisma.SaasUpgradeRequestWhereInput {
    const status = this.optionalEnum(query.status, SaasUpgradeRequestStatus);
    const reason = this.optionalEnum(query.reason, SaasUpgradeRequestReason);
    const currentPlanId = this.optionalString(query.currentPlanId);
    const requestedPlanId = this.optionalString(query.requestedPlanId);
    const associationId = this.optionalString(query.associationId);
    const dateFrom = this.optionalDate(query.dateFrom);
    const dateTo = this.optionalDate(query.dateTo);
    const search = this.optionalString(query.search);
    return {
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
      ...(currentPlanId ? { currentPlanId } : {}),
      ...(requestedPlanId ? { requestedPlanId } : {}),
      ...(associationId ? { associationId } : {}),
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: 'insensitive' } },
              { adminResponse: { contains: search, mode: 'insensitive' } },
              { association: { name: { contains: search, mode: 'insensitive' } } },
              { association: { legalName: { contains: search, mode: 'insensitive' } } },
              { association: { fiscalCode: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private async assertActivePlan(planId: string) {
    const plan = await this.prisma.saasPlan.findUnique({ where: { id: planId }, select: { id: true, status: true } });
    if (!plan) throw new NotFoundException('Planul solicitat nu a fost găsit.');
    if (plan.status !== SaasPlanStatus.ACTIVE) throw new BadRequestException('Planul solicitat trebuie să fie ACTIVE.');
  }

  private listInclude() {
    return {
      association: { select: { id: true, name: true, legalName: true, fiscalCode: true, status: true } },
      currentPlan: true,
      requestedPlan: true,
      requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    } satisfies Prisma.SaasUpgradeRequestInclude;
  }

  private detailInclude() {
    return {
      ...this.listInclude(),
      subscription: { include: { plan: true } },
      appliedSubscription: { include: { plan: true } },
      cancelledBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    } satisfies Prisma.SaasUpgradeRequestInclude;
  }

  private serializeDetail(request: any) {
    return {
      request: this.serializeListItem(request),
      association: this.serializeAssociation(request.association),
      currentPlan: request.currentPlan ? this.serializePlan(request.currentPlan) : null,
      requestedPlan: request.requestedPlan ? this.serializePlan(request.requestedPlan) : null,
      subscription: request.subscription ? this.serializeSubscription(request.subscription) : null,
      appliedSubscription: request.appliedSubscription ? this.serializeSubscription(request.appliedSubscription) : null,
      usageSnapshot: this.payload(request.metadata).limits || null,
      limitsSnapshot: this.payload(request.metadata).limits || null,
      metadata: request.metadata || null,
    };
  }

  private serializeListItem(request: any) {
    return {
      id: request.id,
      associationId: request.associationId,
      association: request.association ? this.serializeAssociation(request.association) : null,
      subscriptionId: request.subscriptionId,
      currentPlanId: request.currentPlanId,
      requestedPlanId: request.requestedPlanId,
      currentPlan: request.currentPlan ? this.serializePlan(request.currentPlan) : null,
      requestedPlan: request.requestedPlan ? this.serializePlan(request.requestedPlan) : null,
      status: request.status,
      reason: request.reason,
      message: request.message,
      requestedBy: request.requestedBy ? this.serializeUser(request.requestedBy) : null,
      reviewedBy: request.reviewedBy ? this.serializeUser(request.reviewedBy) : null,
      reviewedAt: request.reviewedAt,
      adminResponse: request.adminResponse,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      cancelledAt: request.cancelledAt,
      cancellationReason: request.cancellationReason,
      appliedPlanChange: request.appliedPlanChange,
      appliedSubscriptionId: request.appliedSubscriptionId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private planOption(plan: any) {
    return {
      ...this.serializePlan(plan),
      highlights: [
        plan.maxApartments === null ? 'Apartamente nelimitate' : `Până la ${plan.maxApartments || 0} apartamente`,
        this.payload(plan.features).dataQuality ? 'Data Quality' : null,
        this.payload(plan.features).financialReports ? 'Rapoarte financiare' : null,
        this.payload(plan.features).supportAccess ? 'Acces suport' : null,
      ].filter(Boolean),
    };
  }

  private serializePlan(plan: any) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      maxApartments: plan.maxApartments,
      maxResidents: plan.maxResidents,
      maxStaffMembers: plan.maxStaffMembers,
      maxMeters: plan.maxMeters,
      features: this.payload(plan.features),
    };
  }

  private serializeSubscription(subscription: any) {
    return {
      id: subscription.id,
      status: subscription.status,
      planId: subscription.planId,
      planName: subscription.plan?.name || this.payload(subscription.planSnapshot).name,
      planCode: subscription.plan?.code || this.payload(subscription.planSnapshot).code,
      billingCycle: subscription.billingCycle,
      price: subscription.price,
      currency: subscription.currency,
    };
  }

  private serializeAssociation(association: any) {
    return {
      id: association.id,
      name: association.name,
      shortName: association.name,
      legalName: association.legalName,
      associationCode: association.fiscalCode || '',
      status: association.status,
    };
  }

  private serializeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    };
  }

  private adminAssociationId(actor: Actor) {
    if (!actor.organizationId) throw new ForbiddenException('Organization context missing');
    return actor.organizationId;
  }

  private actorId(actor: Actor) {
    const id = actor.id || actor.sub;
    if (!id) throw new ForbiddenException('Autentificare necesară.');
    return id;
  }

  private payload(body: unknown): Record<string, any> {
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, any>) : {};
  }

  private requiredString(value: unknown, message: string) {
    const text = String(value || '').trim();
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private optionalString(value: unknown) {
    const text = typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value).trim();
    return text || null;
  }

  private optionalNumber(value: unknown, message: string) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new BadRequestException(message);
    return number;
  }

  private optionalBoolean(value: unknown) {
    return value === true || value === 'true' || value === '1';
  }

  private optionalDate(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private requiredEnum<T extends Record<string, string>>(value: unknown, source: T, message: string): T[keyof T] {
    const normalized = String(value || '').trim().toUpperCase();
    if (!Object.values(source).includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, source: T): T[keyof T] | null {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    return Object.values(source).includes(normalized) ? (normalized as T[keyof T]) : null;
  }

  private async audit(actorUserId: string, action: string, associationId: string, requestId: string, metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: associationId,
        userId: actorUserId,
        action,
        entityType: 'SAAS_UPGRADE_REQUEST',
        entityId: requestId,
        description: 'Eveniment cerere upgrade SaaS.',
        newValuesJson: metadata as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
  }
}

function changeBodyValue(value: unknown) {
  return value === undefined ? null : value;
}
