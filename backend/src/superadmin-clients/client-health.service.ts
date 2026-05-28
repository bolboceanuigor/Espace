import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientFollowUpSource,
  ClientFollowUpStatus,
  ClientHealthActionStatus,
  ClientHealthCalculationSource,
  ClientHealthDimension,
  ClientHealthRiskReason,
  ClientHealthStatus,
  ClientKnownIssueSeverity,
  ClientKnownIssueStatus,
  ClientLifecycleStage,
  ClientPriority,
  ClientTaskCategory,
  ClientTaskSource,
  ClientTaskStatus,
  DataQualityBillingImpact,
  DataQualityIssueStatus,
  DataQualitySeverity,
  OrganizationMemberStatus,
  Prisma,
  SaasInvoiceStatus,
  SaasSubscriptionStatus,
  SystemErrorLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthFollowUpDto, CreateHealthTaskDto, ClientHealthOverrideDto, DismissClientHealthActionDto } from './dto/client-health.dto';

type DimensionResult = {
  key: ClientHealthDimension;
  score: number;
  status: ClientHealthStatus;
  reasons: ClientHealthRiskReason[];
  recommendedActions: string[];
  metrics?: Record<string, unknown>;
};

type HealthResult = {
  client: any;
  overallScore: number;
  status: ClientHealthStatus;
  dimensions: DimensionResult[];
  riskReasons: Array<{ key: ClientHealthRiskReason; label: string; severity: ClientPriority; message: string }>;
  recommendedActions: Array<{ riskReason: ClientHealthRiskReason; title: string; description: string; priority: ClientPriority }>;
  override: any | null;
};

@Injectable()
export class ClientHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    await this.ensureAnySnapshots();
    const [clients, snapshots, actions, overdueFollowUps, overdueInvoices] = await Promise.all([
      this.prisma.clientAccount.count(),
      this.prisma.clientHealthSnapshot.findMany({ orderBy: { calculatedAt: 'desc' }, take: 1000 }),
      this.prisma.clientHealthAction.findMany({ where: { status: { in: [ClientHealthActionStatus.SUGGESTED, ClientHealthActionStatus.ACCEPTED] } }, include: { clientAccount: { select: { id: true, displayName: true, associationName: true } } }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: 12 }),
      this.prisma.clientFollowUp.count({ where: { status: ClientFollowUpStatus.OPEN, dueAt: { lt: new Date() } } }),
      this.prisma.saasInvoice.count({ where: { balanceAmount: { gt: 0 }, dueDate: { lt: new Date() }, status: { in: [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID, SaasInvoiceStatus.OVERDUE] } } }),
    ]);
    const latest = this.latestSnapshots(snapshots);
    const counts = { excellent: 0, healthy: 0, needsAttention: 0, atRisk: 0, critical: 0, unknown: Math.max(0, clients - latest.size), trialEndingSoon: 0, overdueSaasInvoices: overdueInvoices, overdueFollowUps };
    for (const snapshot of latest.values()) {
      if (snapshot.status === ClientHealthStatus.EXCELLENT) counts.excellent++;
      else if (snapshot.status === ClientHealthStatus.HEALTHY) counts.healthy++;
      else if (snapshot.status === ClientHealthStatus.NEEDS_ATTENTION) counts.needsAttention++;
      else if (snapshot.status === ClientHealthStatus.AT_RISK) counts.atRisk++;
      else if (snapshot.status === ClientHealthStatus.CRITICAL) counts.critical++;
      else counts.unknown++;
      const reasons = Array.isArray(snapshot.riskReasons) ? snapshot.riskReasons as any[] : [];
      if (reasons.some((reason) => reason.key === ClientHealthRiskReason.TRIAL_ENDING_SOON || reason === ClientHealthRiskReason.TRIAL_ENDING_SOON)) counts.trialEndingSoon++;
    }
    const atRiskClients = await this.clients({ healthStatus: `${ClientHealthStatus.AT_RISK},${ClientHealthStatus.CRITICAL}`, limit: '8' });
    return { summary: counts, atRiskClients: atRiskClients.items, recommendedActions: actions, recentChanges: Array.from(latest.values()).slice(0, 10) };
  }

  async clients(query: Record<string, string | undefined>) {
    await this.ensureAnySnapshots();
    const search = query.search?.trim();
    const clients = await this.prisma.clientAccount.findMany({
      where: {
        ...(query.lifecycleStage ? { lifecycleStage: query.lifecycleStage as ClientLifecycleStage } : {}),
        ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
        ...(search ? { OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { associationName: { contains: search, mode: 'insensitive' } },
          { associationCode: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(200, Number(query.limit || 100)),
    });
    const [snapshots, subscriptions, invoices, followUps] = await Promise.all([
      this.prisma.clientHealthSnapshot.findMany({ where: { clientAccountId: { in: clients.map((item) => item.id) } }, orderBy: { calculatedAt: 'desc' } }),
      this.prisma.saasSubscription.findMany({ where: { associationId: { in: clients.map((item) => item.associationId).filter(Boolean) as string[] } }, include: { plan: { select: { name: true } } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.saasInvoice.groupBy({ by: ['associationId'], where: { associationId: { in: clients.map((item) => item.associationId).filter(Boolean) as string[] }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true } }).catch(() => [] as any[]),
      this.prisma.clientFollowUp.findMany({ where: { clientAccountId: { in: clients.map((item) => item.id) }, status: ClientFollowUpStatus.OPEN }, orderBy: { dueAt: 'asc' } }),
    ]);
    const latest = this.latestSnapshots(snapshots);
    const subscriptionByAssociation = new Map<string, any>();
    subscriptions.forEach((item) => { if (!subscriptionByAssociation.has(item.associationId)) subscriptionByAssociation.set(item.associationId, item); });
    const balanceByAssociation = new Map((invoices as any[]).map((item) => [item.associationId, item._sum?.balanceAmount || 0]));
    const followUpByClient = new Map<string, any>();
    followUps.forEach((item) => { if (!followUpByClient.has(item.clientAccountId)) followUpByClient.set(item.clientAccountId, item); });
    const statuses = (query.healthStatus || '').split(',').map((item) => item.trim()).filter(Boolean);
    const riskReason = query.riskReason;
    const items = clients.map((client) => {
      const snapshot = latest.get(client.id);
      const reasons = (snapshot?.riskReasons as any[]) || [];
      return {
        ...client,
        health: snapshot ? { id: snapshot.id, overallScore: snapshot.overallScore, status: snapshot.status, calculatedAt: snapshot.calculatedAt, riskReasons: reasons } : null,
        subscription: client.associationId ? subscriptionByAssociation.get(client.associationId) || null : null,
        saasBalance: client.associationId ? balanceByAssociation.get(client.associationId) || 0 : 0,
        nextFollowUp: followUpByClient.get(client.id) || null,
      };
    }).filter((item) => {
      if (statuses.length && !statuses.includes(item.health?.status || ClientHealthStatus.UNKNOWN)) return false;
      if (riskReason && !(item.health?.riskReasons || []).some((reason: any) => reason.key === riskReason || reason === riskReason)) return false;
      if (query.noOwner === 'true' && item.ownerUserId) return false;
      if (query.hasOverdueFollowUp === 'true' && !(item.nextFollowUp && new Date(item.nextFollowUp.dueAt) < new Date())) return false;
      if (query.hasOverdueSaasInvoice === 'true' && !(item.saasBalance > 0)) return false;
      return true;
    });
    return { items, meta: { total: items.length } };
  }

  async detail(id: string) {
    const client = await this.ensureClient(id);
    let latest = await this.getLatestSnapshot(id);
    if (!latest) latest = await this.saveSnapshot(await this.calculateClientHealth(id, null, ClientHealthCalculationSource.ON_DEMAND));
    const [trend, actions, override] = await Promise.all([
      this.trend(id),
      this.prisma.clientHealthAction.findMany({ where: { clientAccountId: id }, orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }], take: 50 }),
      this.getActiveOverride(id),
    ]);
    return { client, health: latest, trend: trend.items, actions, override };
  }

  async recalculate(id: string, actor: any) {
    const calculated = await this.calculateClientHealth(id, actor, ClientHealthCalculationSource.MANUAL);
    const snapshot = await this.saveSnapshot(calculated);
    const actions = await this.syncActions(calculated, actor);
    return { client: calculated.client, health: snapshot, actions };
  }

  async recalculateAll(actor: any) {
    const clients = await this.prisma.clientAccount.findMany({ take: 250, orderBy: { updatedAt: 'desc' } });
    const results = [];
    for (const client of clients) {
      const calculated = await this.calculateClientHealth(client.id, actor, ClientHealthCalculationSource.MANUAL);
      const snapshot = await this.saveSnapshot(calculated);
      await this.syncActions(calculated, actor);
      results.push(snapshot);
    }
    return { recalculated: results.length, critical: results.filter((item) => item.status === ClientHealthStatus.CRITICAL).length, atRisk: results.filter((item) => item.status === ClientHealthStatus.AT_RISK).length };
  }

  async trend(id: string) {
    await this.ensureClient(id);
    const items = await this.prisma.clientHealthSnapshot.findMany({ where: { clientAccountId: id }, orderBy: { calculatedAt: 'asc' }, take: 60 });
    return { items };
  }

  async atRisk() {
    return this.clients({ healthStatus: `${ClientHealthStatus.NEEDS_ATTENTION},${ClientHealthStatus.AT_RISK},${ClientHealthStatus.CRITICAL}` });
  }

  async recommendations() {
    const items = await this.prisma.clientHealthAction.findMany({
      where: { status: { in: [ClientHealthActionStatus.SUGGESTED, ClientHealthActionStatus.ACCEPTED] } },
      include: { clientAccount: { select: { id: true, displayName: true, associationName: true, associationCode: true } } },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
    return { items };
  }

  async acceptAction(id: string, actor: any) {
    return this.prisma.clientHealthAction.update({ where: { id }, data: { status: ClientHealthActionStatus.ACCEPTED, acceptedById: actor?.id || null } });
  }

  async dismissAction(id: string, dto: DismissClientHealthActionDto, actor: any) {
    return this.prisma.clientHealthAction.update({ where: { id }, data: { status: ClientHealthActionStatus.DISMISSED, dismissedById: actor?.id || null, dismissedReason: dto.reason || null } });
  }

  async completeAction(id: string, actor: any) {
    return this.prisma.clientHealthAction.update({ where: { id }, data: { status: ClientHealthActionStatus.COMPLETED, completedById: actor?.id || null } });
  }

  async createTaskFromAction(id: string, dto: CreateHealthTaskDto, actor: any) {
    const action = await this.ensureAction(id);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const task = await this.prisma.clientTask.create({
      data: {
        clientAccountId: action.clientAccountId,
        associationId: action.associationId,
        title: dto.title || action.title,
        description: action.description,
        status: ClientTaskStatus.OPEN,
        priority: action.priority,
        category: this.categoryForReason(action.riskReason),
        dueAt,
        assignedToId: dto.assignedToId || null,
        createdById: actor?.id || null,
        source: ClientTaskSource.SYSTEM,
        relatedEntityType: 'CLIENT_HEALTH_ACTION',
        relatedEntityId: action.id,
      },
    });
    return this.prisma.clientHealthAction.update({ where: { id }, data: { status: ClientHealthActionStatus.ACCEPTED, acceptedById: actor?.id || null, relatedTaskId: task.id } });
  }

  async createFollowUpFromAction(id: string, dto: CreateHealthFollowUpDto, actor: any) {
    const action = await this.ensureAction(id);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const followUp = await this.prisma.clientFollowUp.create({
      data: {
        clientAccountId: action.clientAccountId,
        associationId: action.associationId,
        title: dto.title || action.title,
        description: action.description,
        dueAt,
        priority: action.priority,
        assignedToId: dto.assignedToId || null,
        createdById: actor?.id || null,
        source: ClientFollowUpSource.SYSTEM,
        relatedEntityType: 'CLIENT_HEALTH_ACTION',
        relatedEntityId: action.id,
      },
    });
    await this.prisma.clientAccount.update({ where: { id: action.clientAccountId }, data: { nextFollowUpAt: dueAt } }).catch(() => undefined);
    return this.prisma.clientHealthAction.update({ where: { id }, data: { status: ClientHealthActionStatus.ACCEPTED, acceptedById: actor?.id || null, relatedFollowUpId: followUp.id } });
  }

  async createOverride(id: string, dto: ClientHealthOverrideDto, actor: any) {
    if (dto.overrideScore == null && !dto.overrideStatus) throw new BadRequestException('Seteaza overrideScore sau overrideStatus.');
    const client = await this.ensureClient(id);
    await this.prisma.clientHealthOverride.updateMany({ where: { clientAccountId: id, active: true }, data: { active: false, disabledAt: new Date(), disabledById: actor?.id || null } });
    return this.prisma.clientHealthOverride.create({
      data: { clientAccountId: id, associationId: client.associationId, overrideStatus: dto.overrideStatus || null, overrideScore: dto.overrideScore == null ? null : Number(dto.overrideScore), reason: dto.reason, createdById: actor?.id || 'system' },
    });
  }

  async disableOverride(id: string, actor: any) {
    return this.prisma.clientHealthOverride.update({ where: { id }, data: { active: false, disabledAt: new Date(), disabledById: actor?.id || null } });
  }

  async calculateClientHealth(clientAccountId: string, actor: any, source: ClientHealthCalculationSource): Promise<HealthResult> {
    const client = await this.ensureClient(clientAccountId);
    const dimensions = await Promise.all([
      this.onboarding(client),
      this.productUsage(client),
      this.subscription(client),
      this.saasBilling(client),
      this.dataQuality(client),
      this.support(client),
      this.followUp(client),
      this.security(client),
      this.engagement(client),
      this.knowledge(client),
    ]);
    const available = dimensions.filter((item) => item.status !== ClientHealthStatus.UNKNOWN);
    const baseScore = available.length ? Math.round(available.reduce((sum, item) => sum + item.score, 0) / available.length) : 0;
    const override = await this.getActiveOverride(client.id);
    const score = this.clamp(override?.overrideScore ?? baseScore);
    const status = override?.overrideStatus || this.statusForScore(score);
    const reasons = this.buildRiskReasons(dimensions, override);
    return {
      client: { ...client, calculatedById: actor?.id || null, calculationSource: source },
      overallScore: score,
      status,
      dimensions,
      riskReasons: reasons,
      recommendedActions: this.buildRecommendedActions(reasons.map((reason) => reason.key)),
      override,
    };
  }

  private async onboarding(client: any): Promise<DimensionResult> {
    const reasons: ClientHealthRiskReason[] = [];
    if (!client.associationId) return this.dimension(ClientHealthDimension.ONBOARDING, 20, [ClientHealthRiskReason.NO_ASSOCIATION_LINKED], ['Leaga clientul de o asociatie.']);
    const [apartments, residents, checklist, invoices, dqRun] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId: client.associationId, archivedAt: null } }),
      this.prisma.residentProfile.count({ where: { organizationId: client.associationId, archivedAt: null } }),
      this.prisma.onboardingChecklist.findUnique({ where: { organizationId: client.associationId } }).catch(() => null),
      this.prisma.residentInvoice.count({ where: { organizationId: client.associationId } }),
      this.prisma.dataQualityRun.count({ where: { associationId: client.associationId, completedAt: { not: null } } }),
    ]);
    let score = 20;
    if (apartments > 0) score += 15;
    if (residents > 0) score += 15;
    if (checklist?.tariffsConfigured) score += 15;
    if (dqRun > 0) score += 10;
    if (invoices > 0 || checklist?.firstInvoicesGenerated) score += 10;
    if (client.lifecycleStage === ClientLifecycleStage.ONBOARDING && client.onboardingStartedAt && this.daysSince(client.onboardingStartedAt) > 21) reasons.push(ClientHealthRiskReason.ONBOARDING_STUCK);
    if (!invoices) reasons.push(ClientHealthRiskReason.NO_BILLING_RUN);
    return this.dimension(ClientHealthDimension.ONBOARDING, score, reasons, ['Verifica pasii de onboarding.', 'Ruleaza Data Quality si primul ciclu de facturare.'], { apartments, residents, invoices });
  }

  private async productUsage(client: any): Promise<DimensionResult> {
    if (!client.associationId) return this.dimension(ClientHealthDimension.PRODUCT_USAGE, 0, [ClientHealthRiskReason.NO_ASSOCIATION_LINKED], []);
    const since45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const [invoices, payments, announcements, requests, readings] = await Promise.all([
      this.prisma.residentInvoice.count({ where: { organizationId: client.associationId, createdAt: { gte: since45 } } }),
      this.prisma.payment.count({ where: { organizationId: client.associationId, createdAt: { gte: since45 } } }),
      this.prisma.announcement.count({ where: { organizationId: client.associationId, createdAt: { gte: since45 } } }).catch(() => 0),
      this.prisma.issue.count({ where: { organizationId: client.associationId, createdAt: { gte: since45 } } }).catch(() => 0),
      this.prisma.meterReading.count({ where: { organizationId: client.associationId, createdAt: { gte: since45 } } }),
    ]);
    let score = 20;
    if (invoices > 0) score += 25;
    if (payments > 0) score += 20;
    if (announcements + requests > 0) score += 20;
    if (readings > 0) score += 15;
    const reasons: ClientHealthRiskReason[] = [];
    if (!invoices) reasons.push(ClientHealthRiskReason.NO_RECENT_INVOICES);
    if (!invoices && !payments && !announcements && !requests && client.lifecycleStage === ClientLifecycleStage.ACTIVE) reasons.push(ClientHealthRiskReason.LOW_ADMIN_ACTIVITY);
    return this.dimension(ClientHealthDimension.PRODUCT_USAGE, score, reasons, ['Verifica daca administratorul foloseste platforma activ.'], { invoices, payments, announcements, requests, readings });
  }

  private async subscription(client: any): Promise<DimensionResult> {
    if (!client.associationId) return this.dimension(ClientHealthDimension.SUBSCRIPTION, 20, [ClientHealthRiskReason.NO_ACTIVE_SUBSCRIPTION], []);
    const subscription = await this.prisma.saasSubscription.findFirst({ where: { associationId: client.associationId }, orderBy: { updatedAt: 'desc' } });
    if (!subscription) return this.dimension(ClientHealthDimension.SUBSCRIPTION, 20, [ClientHealthRiskReason.NO_ACTIVE_SUBSCRIPTION], ['Configureaza abonamentul SaaS.']);
    const reasons: ClientHealthRiskReason[] = [];
    let score = 80;
    if (subscription.status === SaasSubscriptionStatus.ACTIVE) score = 100;
    if (subscription.status === SaasSubscriptionStatus.PAST_DUE) score = 50;
    if (subscription.status === SaasSubscriptionStatus.SUSPENDED) {
      score = 20;
      reasons.push(ClientHealthRiskReason.SUBSCRIPTION_SUSPENDED);
    }
    if ([SaasSubscriptionStatus.CANCELLED, SaasSubscriptionStatus.EXPIRED].includes(subscription.status)) score = 0;
    if (subscription.trialEndsAt && subscription.trialEndsAt > new Date() && subscription.trialEndsAt < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) reasons.push(ClientHealthRiskReason.TRIAL_ENDING_SOON);
    return this.dimension(ClientHealthDimension.SUBSCRIPTION, score, reasons, ['Verifica statusul abonamentului.'], { status: subscription.status, trialEndsAt: subscription.trialEndsAt });
  }

  private async saasBilling(client: any): Promise<DimensionResult> {
    if (!client.associationId) return this.dimension(ClientHealthDimension.SAAS_BILLING, 75, [], []);
    const now = new Date();
    const [overdue, unpaid] = await Promise.all([
      this.prisma.saasInvoice.count({ where: { associationId: client.associationId, balanceAmount: { gt: 0 }, dueDate: { lt: now }, status: { in: [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID, SaasInvoiceStatus.OVERDUE] } } }),
      this.prisma.saasInvoice.count({ where: { associationId: client.associationId, balanceAmount: { gt: 0 }, status: { in: [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID, SaasInvoiceStatus.OVERDUE] } } }),
    ]);
    if (overdue > 1) return this.dimension(ClientHealthDimension.SAAS_BILLING, 15, [ClientHealthRiskReason.SAAS_INVOICE_OVERDUE], ['Contacteaza clientul privind facturile SaaS restante.'], { overdue, unpaid });
    if (overdue === 1) return this.dimension(ClientHealthDimension.SAAS_BILLING, 35, [ClientHealthRiskReason.SAAS_INVOICE_OVERDUE], ['Creeaza task pentru verificarea platii.'], { overdue, unpaid });
    return this.dimension(ClientHealthDimension.SAAS_BILLING, unpaid > 0 ? 75 : 100, [], [], { overdue, unpaid });
  }

  private async dataQuality(client: any): Promise<DimensionResult> {
    if (!client.associationId) return this.dimension(ClientHealthDimension.DATA_QUALITY, 75, [], []);
    const [open, critical, blockers] = await Promise.all([
      this.prisma.dataQualityIssue.count({ where: { associationId: client.associationId, status: DataQualityIssueStatus.OPEN } }),
      this.prisma.dataQualityIssue.count({ where: { associationId: client.associationId, status: DataQualityIssueStatus.OPEN, severity: DataQualitySeverity.CRITICAL } }),
      this.prisma.dataQualityIssue.count({ where: { associationId: client.associationId, status: DataQualityIssueStatus.OPEN, billingImpact: DataQualityBillingImpact.BLOCKS_BILLING } }),
    ]);
    const reasons: ClientHealthRiskReason[] = [];
    if (open >= 10) reasons.push(ClientHealthRiskReason.MANY_DATA_QUALITY_ISSUES);
    if (critical > 0 || blockers > 0) reasons.push(ClientHealthRiskReason.CRITICAL_DATA_QUALITY_ISSUES);
    const score = blockers > 0 ? 20 : critical > 0 ? 35 : open > 0 ? 70 : 100;
    return this.dimension(ClientHealthDimension.DATA_QUALITY, score, reasons, ['Deschide Data Quality Center si rezolva problemele critice.'], { open, critical, blockers });
  }

  private async support(client: any): Promise<DimensionResult> {
    const [knownCritical, knownOpen, supportSessions] = await Promise.all([
      this.prisma.clientKnownIssue.count({ where: { clientAccountId: client.id, status: { in: [ClientKnownIssueStatus.OPEN, ClientKnownIssueStatus.IN_PROGRESS] }, severity: ClientKnownIssueSeverity.CRITICAL } }),
      this.prisma.clientKnownIssue.count({ where: { clientAccountId: client.id, status: { in: [ClientKnownIssueStatus.OPEN, ClientKnownIssueStatus.IN_PROGRESS] } } }),
      client.associationId ? this.prisma.supportSession.count({ where: { organizationId: client.associationId, isActive: true } }) : 0,
    ]);
    const reasons: ClientHealthRiskReason[] = [];
    if (knownOpen > 0 || supportSessions > 0) reasons.push(ClientHealthRiskReason.OPEN_SUPPORT_ISSUES);
    const score = knownCritical > 0 ? 30 : knownOpen > 0 ? 60 : supportSessions > 0 ? 50 : 100;
    return this.dimension(ClientHealthDimension.SUPPORT, score, reasons, ['Creeaza task pentru problema de suport deschisa.'], { knownOpen, knownCritical, supportSessions });
  }

  private async followUp(client: any): Promise<DimensionResult> {
    const now = new Date();
    const [overdueFollowUps, overdueTasks, urgentOverdue] = await Promise.all([
      this.prisma.clientFollowUp.count({ where: { clientAccountId: client.id, status: ClientFollowUpStatus.OPEN, dueAt: { lt: now } } }),
      this.prisma.clientTask.count({ where: { clientAccountId: client.id, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: now } } }),
      this.prisma.clientTask.count({ where: { clientAccountId: client.id, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, priority: ClientPriority.URGENT, dueAt: { lt: now } } }),
    ]);
    const reasons: ClientHealthRiskReason[] = [];
    if (overdueFollowUps) reasons.push(ClientHealthRiskReason.OVERDUE_FOLLOW_UP);
    if (overdueTasks) reasons.push(ClientHealthRiskReason.OVERDUE_TASKS);
    if (!client.ownerUserId) reasons.push(ClientHealthRiskReason.NO_OWNER_ASSIGNED);
    const score = urgentOverdue > 0 ? 20 : overdueTasks > 2 ? 40 : overdueFollowUps > 0 ? 60 : !client.ownerUserId ? 50 : 100;
    return this.dimension(ClientHealthDimension.FOLLOW_UP, score, reasons, ['Finalizeaza sau reprogrameaza follow-up-urile intarziate.'], { overdueFollowUps, overdueTasks, urgentOverdue });
  }

  private async security(client: any): Promise<DimensionResult> {
    if (!client.associationId) return this.dimension(ClientHealthDimension.SECURITY, 100, [], []);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const criticalErrors = await this.prisma.systemErrorEvent.count({ where: { associationId: client.associationId, severity: { in: [SystemErrorLevel.ERROR, SystemErrorLevel.CRITICAL] }, resolvedAt: null, lastSeenAt: { gte: since30 } } });
    const reasons = criticalErrors > 0 ? [ClientHealthRiskReason.OPEN_PRODUCTION_INCIDENT] : [];
    return this.dimension(ClientHealthDimension.SECURITY, criticalErrors > 0 ? 30 : 100, reasons, ['Verifica monitoring-ul si erorile critice ale clientului.'], { criticalErrors });
  }

  private async engagement(client: any): Promise<DimensionResult> {
    if (!client.associationId || client.lifecycleStage === ClientLifecycleStage.ONBOARDING) return this.dimension(ClientHealthDimension.ENGAGEMENT, 75, [], []);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [residentAccess, requests, payments, invoices] = await Promise.all([
      this.prisma.residentProfile.count({ where: { organizationId: client.associationId, portalAccessActivatedAt: { gte: since30 } } }),
      this.prisma.issue.count({ where: { organizationId: client.associationId, createdAt: { gte: since30 } } }).catch(() => 0),
      this.prisma.payment.count({ where: { organizationId: client.associationId, createdAt: { gte: since30 } } }),
      this.prisma.residentInvoice.count({ where: { organizationId: client.associationId, createdAt: { gte: since30 } } }),
    ]);
    let score = 0;
    if (residentAccess > 0) score += 25;
    if (requests > 0) score += 20;
    if (payments > 0) score += 20;
    if (invoices > 0) score += 35;
    return this.dimension(ClientHealthDimension.ENGAGEMENT, score || 50, score ? [] : [ClientHealthRiskReason.LOW_ADMIN_ACTIVITY], ['Verifica engagement-ul administratorilor si rezidentilor.'], { residentAccess, requests, payments, invoices });
  }

  private async knowledge(client: any): Promise<DimensionResult> {
    const [primaryContact, pinnedNotes, onboardingContext] = await Promise.all([
      this.prisma.clientContact.count({ where: { clientAccountId: client.id, isPrimary: true, status: 'ACTIVE' as any } }),
      this.prisma.clientKnowledgeItem.count({ where: { clientAccountId: client.id, isPinned: true, status: 'ACTIVE' as any } }),
      this.prisma.clientKnowledgeItem.count({ where: { clientAccountId: client.id, category: { in: ['ONBOARDING', 'SUPPORT', 'BILLING'] as any }, status: 'ACTIVE' as any } }),
    ]);
    const missing = primaryContact === 0 || pinnedNotes === 0 || onboardingContext === 0;
    return this.dimension(ClientHealthDimension.KNOWLEDGE_BASE, missing ? 70 : 100, missing ? [ClientHealthRiskReason.MISSING_KNOWLEDGE_CONTEXT] : [], ['Completeaza contactul principal, pinned notes si contextul de onboarding.'], { primaryContact, pinnedNotes, onboardingContext });
  }

  private dimension(key: ClientHealthDimension, score: number, reasons: ClientHealthRiskReason[], recommendedActions: string[], metrics?: Record<string, unknown>): DimensionResult {
    const normalized = this.clamp(score);
    return { key, score: normalized, status: this.statusForScore(normalized), reasons, recommendedActions, metrics };
  }

  private async saveSnapshot(result: HealthResult) {
    return this.prisma.clientHealthSnapshot.create({
      data: {
        clientAccountId: result.client.id,
        associationId: result.client.associationId,
        overallScore: result.overallScore,
        status: result.status,
        dimensions: result.dimensions as unknown as Prisma.InputJsonValue,
        riskReasons: result.riskReasons as unknown as Prisma.InputJsonValue,
        recommendedActions: result.recommendedActions as unknown as Prisma.InputJsonValue,
        calculatedById: result.client.calculatedById || null,
        calculationSource: result.client.calculationSource || ClientHealthCalculationSource.ON_DEMAND,
      },
    });
  }

  private async syncActions(result: HealthResult, actor: any) {
    const actions = [];
    for (const item of result.recommendedActions) {
      const existing = await this.prisma.clientHealthAction.findFirst({ where: { clientAccountId: result.client.id, riskReason: item.riskReason, status: { in: [ClientHealthActionStatus.SUGGESTED, ClientHealthActionStatus.ACCEPTED] } } });
      if (existing) {
        actions.push(existing);
        continue;
      }
      actions.push(await this.prisma.clientHealthAction.create({ data: { clientAccountId: result.client.id, associationId: result.client.associationId, riskReason: item.riskReason, title: item.title, description: item.description, priority: item.priority, createdById: actor?.id || null } }));
    }
    return actions;
  }

  private buildRiskReasons(dimensions: DimensionResult[], override: any | null) {
    const unique = new Set<ClientHealthRiskReason>();
    dimensions.forEach((dimension) => dimension.reasons.forEach((reason) => unique.add(reason)));
    if (override) unique.add(ClientHealthRiskReason.CUSTOMER_AT_RISK_MANUAL);
    return Array.from(unique).map((key) => ({ key, ...this.reasonMeta(key) }));
  }

  private buildRecommendedActions(reasons: ClientHealthRiskReason[]) {
    const map: Partial<Record<ClientHealthRiskReason, { title: string; description: string; priority: ClientPriority }>> = {
      ONBOARDING_STUCK: { title: 'Programeaza follow-up cu clientul', description: 'Clientul pare blocat in onboarding. Verifica pasii ramasi.', priority: ClientPriority.HIGH },
      SAAS_INVOICE_OVERDUE: { title: 'Contacteaza clientul privind factura SaaS', description: 'Exista sold SaaS restant sau factura scadenta neachitata.', priority: ClientPriority.HIGH },
      TRIAL_ENDING_SOON: { title: 'Discuta activarea abonamentului', description: 'Trial-ul se apropie de final.', priority: ClientPriority.HIGH },
      MANY_DATA_QUALITY_ISSUES: { title: 'Ruleaza Data Quality Center', description: 'Sunt multe probleme de calitate a datelor deschise.', priority: ClientPriority.NORMAL },
      CRITICAL_DATA_QUALITY_ISSUES: { title: 'Rezolva problemele Data Quality critice', description: 'Exista probleme critice sau blocante pentru facturare.', priority: ClientPriority.URGENT },
      LOW_ADMIN_ACTIVITY: { title: 'Contacteaza administratorul', description: 'Activitatea recenta in produs este scazuta.', priority: ClientPriority.NORMAL },
      OVERDUE_FOLLOW_UP: { title: 'Reprogrameaza follow-up-ul intarziat', description: 'Clientul are follow-up intarziat.', priority: ClientPriority.HIGH },
      OVERDUE_TASKS: { title: 'Finalizeaza taskurile intarziate', description: 'Exista taskuri interne intarziate pentru client.', priority: ClientPriority.HIGH },
      NO_OWNER_ASSIGNED: { title: 'Asigneaza responsabil clientului', description: 'Clientul nu are owner intern.', priority: ClientPriority.NORMAL },
      OPEN_SUPPORT_ISSUES: { title: 'Creeaza task pentru problema de suport', description: 'Clientul are probleme cunoscute sau suport activ.', priority: ClientPriority.HIGH },
      MISSING_KNOWLEDGE_CONTEXT: { title: 'Completeaza contextul intern al clientului', description: 'Lipsesc contactul principal, note pinned sau context operational.', priority: ClientPriority.LOW },
      NO_ACTIVE_SUBSCRIPTION: { title: 'Configureaza abonamentul SaaS', description: 'Clientul nu are abonament activ detectat.', priority: ClientPriority.HIGH },
      SUBSCRIPTION_SUSPENDED: { title: 'Verifica abonamentul suspendat', description: 'Clientul are abonament suspendat sau in stare critica.', priority: ClientPriority.URGENT },
    };
    return Array.from(new Set(reasons)).map((reason) => map[reason] ? { riskReason: reason, ...map[reason]! } : null).filter(Boolean) as any[];
  }

  private reasonMeta(key: ClientHealthRiskReason) {
    const labels: Record<string, string> = {
      SAAS_INVOICE_OVERDUE: 'Factura SaaS restanta',
      TRIAL_ENDING_SOON: 'Trial aproape de final',
      ONBOARDING_STUCK: 'Onboarding blocat',
      LOW_ADMIN_ACTIVITY: 'Activitate scazuta',
      OVERDUE_FOLLOW_UP: 'Follow-up intarziat',
      OVERDUE_TASKS: 'Taskuri intarziate',
      NO_OWNER_ASSIGNED: 'Fara responsabil',
      MISSING_KNOWLEDGE_CONTEXT: 'Context intern incomplet',
      CRITICAL_DATA_QUALITY_ISSUES: 'Data Quality critic',
      MANY_DATA_QUALITY_ISSUES: 'Multe probleme Data Quality',
      OPEN_SUPPORT_ISSUES: 'Probleme suport deschise',
      NO_ACTIVE_SUBSCRIPTION: 'Fara abonament activ',
      SUBSCRIPTION_SUSPENDED: 'Abonament suspendat',
      CUSTOMER_AT_RISK_MANUAL: 'Override manual',
    };
    const urgent = [ClientHealthRiskReason.SUBSCRIPTION_SUSPENDED, ClientHealthRiskReason.CRITICAL_DATA_QUALITY_ISSUES, ClientHealthRiskReason.CUSTOMER_AT_RISK_MANUAL];
    const high = [ClientHealthRiskReason.SAAS_INVOICE_OVERDUE, ClientHealthRiskReason.ONBOARDING_STUCK, ClientHealthRiskReason.OVERDUE_FOLLOW_UP, ClientHealthRiskReason.OVERDUE_TASKS, ClientHealthRiskReason.OPEN_SUPPORT_ISSUES];
    return { label: labels[key] || key, severity: urgent.includes(key) ? ClientPriority.URGENT : high.includes(key) ? ClientPriority.HIGH : ClientPriority.NORMAL, message: labels[key] || key };
  }

  private categoryForReason(reason: ClientHealthRiskReason) {
    if ([ClientHealthRiskReason.SAAS_INVOICE_OVERDUE].includes(reason)) return ClientTaskCategory.SAAS_INVOICE;
    if ([ClientHealthRiskReason.NO_ACTIVE_SUBSCRIPTION, ClientHealthRiskReason.TRIAL_ENDING_SOON, ClientHealthRiskReason.SUBSCRIPTION_SUSPENDED].includes(reason)) return ClientTaskCategory.SUBSCRIPTION;
    if ([ClientHealthRiskReason.ONBOARDING_STUCK, ClientHealthRiskReason.NO_ASSOCIATION_LINKED].includes(reason)) return ClientTaskCategory.ONBOARDING;
    if ([ClientHealthRiskReason.OPEN_SUPPORT_ISSUES].includes(reason)) return ClientTaskCategory.SUPPORT;
    if ([ClientHealthRiskReason.SECURITY_EVENTS, ClientHealthRiskReason.OPEN_PRODUCTION_INCIDENT].includes(reason)) return ClientTaskCategory.SECURITY;
    return ClientTaskCategory.GENERAL;
  }

  private statusForScore(score: number) {
    if (score >= 90) return ClientHealthStatus.EXCELLENT;
    if (score >= 75) return ClientHealthStatus.HEALTHY;
    if (score >= 50) return ClientHealthStatus.NEEDS_ATTENTION;
    if (score >= 25) return ClientHealthStatus.AT_RISK;
    return ClientHealthStatus.CRITICAL;
  }

  private latestSnapshots(snapshots: any[]) {
    const map = new Map<string, any>();
    for (const snapshot of snapshots) if (!map.has(snapshot.clientAccountId)) map.set(snapshot.clientAccountId, snapshot);
    return map;
  }

  private async getLatestSnapshot(clientAccountId: string) {
    return this.prisma.clientHealthSnapshot.findFirst({ where: { clientAccountId }, orderBy: { calculatedAt: 'desc' } });
  }

  private async getActiveOverride(clientAccountId: string) {
    return this.prisma.clientHealthOverride.findFirst({ where: { clientAccountId, active: true }, orderBy: { createdAt: 'desc' } });
  }

  private async ensureClient(id: string) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client account not found');
    return client;
  }

  private async ensureAction(id: string) {
    const action = await this.prisma.clientHealthAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundException('Health action not found');
    return action;
  }

  private async ensureAnySnapshots() {
    const [snapshots, clients] = await Promise.all([this.prisma.clientHealthSnapshot.count(), this.prisma.clientAccount.count()]);
    if (snapshots === 0 && clients > 0) {
      const first = await this.prisma.clientAccount.findMany({ take: 25, orderBy: { updatedAt: 'desc' } });
      for (const client of first) await this.saveSnapshot(await this.calculateClientHealth(client.id, null, ClientHealthCalculationSource.ON_DEMAND));
    }
  }

  private daysSince(date: Date) {
    return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  }

  private clamp(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
