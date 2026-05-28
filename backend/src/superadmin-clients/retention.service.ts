import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  ClientChurnReason,
  ClientChurnRiskSeverity,
  ClientChurnRiskStatus,
  ClientFollowUpSource,
  ClientFollowUpStatus,
  ClientHealthStatus,
  ClientLifecycleStage,
  ClientPriority,
  ClientRenewalOutcome,
  ClientRenewalStatus,
  ClientRetentionActionStatus,
  ClientRetentionActionType,
  ClientRetentionEventType,
  ClientRetentionPlanOutcome,
  ClientRetentionPlanStatus,
  ClientTaskCategory,
  ClientTaskSource,
  ClientTaskStatus,
  ChurnRiskDetectedBy,
  ChurnRiskSource,
  PaymentPromiseStatus,
  Prisma,
  RevenueCollectionStatus,
  SaasBillingCycle,
  SaasInvoiceStatus,
  SaasSubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignRetentionDto,
  CompleteRenewalDto,
  CompleteRetentionActionDto,
  CompleteRetentionPlanDto,
  CreateChurnRiskDto,
  CreateRenewalDto,
  CreateRetentionFollowUpDto,
  CreateRetentionPlanDto,
  CreateRetentionTaskDto,
  MarkRiskOutcomeDto,
  RetentionActionDto,
  RetentionNoteDto,
  UpdateChurnRiskDto,
  UpdateChurnRiskStatusDto,
  UpdateRenewalDto,
  UpdateRetentionPlanDto,
} from './dto/retention.dto';

type Query = Record<string, string | undefined>;

const OPEN_RISK_STATUSES: ClientChurnRiskStatus[] = [
  ClientChurnRiskStatus.NEW,
  ClientChurnRiskStatus.IN_REVIEW,
  ClientChurnRiskStatus.RETENTION_IN_PROGRESS,
  ClientChurnRiskStatus.WAITING_CLIENT,
];

const CLOSED_RISK_STATUSES: ClientChurnRiskStatus[] = [
  ClientChurnRiskStatus.SAVED,
  ClientChurnRiskStatus.LOST,
  ClientChurnRiskStatus.DISMISSED,
  ClientChurnRiskStatus.CLOSED,
];

const OUTCOME_RISK_STATUSES: ClientChurnRiskStatus[] = [
  ClientChurnRiskStatus.SAVED,
  ClientChurnRiskStatus.LOST,
];

const OPEN_RENEWAL_STATUSES: ClientRenewalStatus[] = [
  ClientRenewalStatus.NOT_STARTED,
  ClientRenewalStatus.UPCOMING,
  ClientRenewalStatus.IN_PROGRESS,
  ClientRenewalStatus.WAITING_CLIENT,
];

const RENEWED_OUTCOMES: ClientRenewalOutcome[] = [
  ClientRenewalOutcome.RENEWED_SAME_PLAN,
  ClientRenewalOutcome.RENEWED_UPGRADED,
  ClientRenewalOutcome.RENEWED_DOWNGRADED,
  ClientRenewalOutcome.EXTENDED_TRIAL,
];

const HEALTH_RISK_STATUSES: ClientHealthStatus[] = [
  ClientHealthStatus.AT_RISK,
  ClientHealthStatus.CRITICAL,
];

const ONBOARDING_STAGES: ClientLifecycleStage[] = [
  ClientLifecycleStage.ONBOARDING,
  ClientLifecycleStage.PREPARING_ONBOARDING,
  ClientLifecycleStage.READY_TO_ACTIVATE,
];

const OPEN_PLAN_STATUSES: ClientRetentionPlanStatus[] = [
  ClientRetentionPlanStatus.DRAFT,
  ClientRetentionPlanStatus.ACTIVE,
];

const COLLECTIBLE_INVOICE_STATUSES: SaasInvoiceStatus[] = [
  SaasInvoiceStatus.ISSUED,
  SaasInvoiceStatus.PARTIALLY_PAID,
  SaasInvoiceStatus.OVERDUE,
];

const OPEN_COLLECTION_STATUSES: RevenueCollectionStatus[] = [
  RevenueCollectionStatus.NOT_STARTED,
  RevenueCollectionStatus.NEEDS_FOLLOW_UP,
  RevenueCollectionStatus.CONTACTED,
  RevenueCollectionStatus.PROMISE_TO_PAY,
  RevenueCollectionStatus.PARTIALLY_PAID,
  RevenueCollectionStatus.DISPUTED,
  RevenueCollectionStatus.ESCALATED,
  RevenueCollectionStatus.SUSPENSION_RECOMMENDED,
];

type RiskInput = {
  clientAccountId: string;
  associationId?: string | null;
  reason: ClientChurnReason;
  severity: ClientChurnRiskSeverity;
  title: string;
  description?: string | null;
  score?: number | null;
  source: ChurnRiskSource;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  detectedBy?: ChurnRiskDetectedBy;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const in30 = this.addDays(now, 30);
    const in7 = this.addDays(now, 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      clientsAtRisk,
      criticalRisks,
      highRisks,
      upcomingRenewals30Days,
      trialEndingSoon,
      savedThisMonth,
      lostThisMonth,
      activeRetentionPlans,
      overdueFollowUps,
      criticalRiskItems,
      renewalItems,
      planItems,
      followUpItems,
      openRisks,
    ] = await Promise.all([
      this.prisma.clientChurnRisk.count({ where: { status: { in: OPEN_RISK_STATUSES } } }),
      this.prisma.clientChurnRisk.count({ where: { status: { in: OPEN_RISK_STATUSES }, severity: ClientChurnRiskSeverity.CRITICAL } }),
      this.prisma.clientChurnRisk.count({ where: { status: { in: OPEN_RISK_STATUSES }, severity: ClientChurnRiskSeverity.HIGH } }),
      this.prisma.clientRenewal.count({ where: { status: { in: OPEN_RENEWAL_STATUSES }, renewalDate: { gte: now, lte: in30 } } }),
      this.prisma.saasSubscription.count({ where: { status: SaasSubscriptionStatus.TRIALING, trialEndsAt: { gte: now, lte: in7 } } }),
      this.prisma.clientChurnRisk.count({ where: { status: ClientChurnRiskStatus.SAVED, savedAt: { gte: monthStart } } }),
      this.prisma.clientChurnRisk.count({ where: { status: ClientChurnRiskStatus.LOST, lostAt: { gte: monthStart } } }),
      this.prisma.clientRetentionPlan.count({ where: { status: ClientRetentionPlanStatus.ACTIVE } }),
      this.prisma.clientFollowUp.count({ where: { status: ClientFollowUpStatus.OPEN, dueAt: { lt: now }, relatedEntityType: { in: ['CLIENT_CHURN_RISK', 'CLIENT_RENEWAL', 'CLIENT_RETENTION_PLAN'] } } }),
      this.prisma.clientChurnRisk.findMany({ where: { status: { in: OPEN_RISK_STATUSES }, severity: { in: [ClientChurnRiskSeverity.CRITICAL, ClientChurnRiskSeverity.HIGH] } }, orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }], take: 8 }),
      this.prisma.clientRenewal.findMany({ where: { status: { in: OPEN_RENEWAL_STATUSES }, renewalDate: { lte: in30 } }, orderBy: { renewalDate: 'asc' }, take: 8 }),
      this.prisma.clientRetentionPlan.findMany({ where: { status: ClientRetentionPlanStatus.ACTIVE }, include: { actions: true }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], take: 8 }),
      this.prisma.clientFollowUp.findMany({ where: { status: ClientFollowUpStatus.OPEN, dueAt: { lt: now }, relatedEntityType: { in: ['CLIENT_CHURN_RISK', 'CLIENT_RENEWAL', 'CLIENT_RETENTION_PLAN'] } }, orderBy: { dueAt: 'asc' }, take: 8 }),
      this.prisma.clientChurnRisk.findMany({ where: { status: { in: OPEN_RISK_STATUSES } }, take: 500 }),
    ]);

    const revenueAtRisk = await this.sumRevenueAtRisk(openRisks);
    const savedRisks = await this.prisma.clientChurnRisk.findMany({ where: { status: ClientChurnRiskStatus.SAVED, savedAt: { gte: monthStart } }, take: 500 });
    const revenueSaved = this.sumMetadataAmount(savedRisks, 'revenueAtRisk');

    return {
      summary: {
        clientsAtRisk,
        criticalRisks,
        highRisks,
        upcomingRenewals30Days,
        trialEndingSoon,
        savedThisMonth,
        lostThisMonth,
        activeRetentionPlans,
        overdueFollowUps,
        revenueAtRisk,
        revenueSaved,
        currency: 'MDL',
      },
      criticalRisks: await this.enrichRisks(criticalRiskItems),
      upcomingRenewals: await this.enrichRenewals(renewalItems),
      activePlans: await this.enrichPlans(planItems),
      overdueFollowUps: followUpItems,
    };
  }

  async reports() {
    const [risks, renewals, plans, events] = await Promise.all([
      this.prisma.clientChurnRisk.findMany({ take: 1000, orderBy: { detectedAt: 'desc' } }),
      this.prisma.clientRenewal.findMany({ take: 1000, orderBy: { renewalDate: 'desc' } }),
      this.prisma.clientRetentionPlan.findMany({ take: 1000, include: { actions: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.clientRetentionEvent.findMany({ take: 50, orderBy: { createdAt: 'desc' } }),
    ]);
    const revenueAtRisk = await this.sumRevenueAtRisk(risks.filter((risk) => OPEN_RISK_STATUSES.includes(risk.status)));
    return {
      summary: {
        totalRisks: risks.length,
        openRisks: risks.filter((item) => OPEN_RISK_STATUSES.includes(item.status)).length,
        savedRisks: risks.filter((item) => item.status === ClientChurnRiskStatus.SAVED).length,
        lostRisks: risks.filter((item) => item.status === ClientChurnRiskStatus.LOST).length,
        renewals: renewals.length,
        activePlans: plans.filter((item) => item.status === ClientRetentionPlanStatus.ACTIVE).length,
        completedPlans: plans.filter((item) => item.status === ClientRetentionPlanStatus.COMPLETED).length,
        revenueAtRisk,
        currency: 'MDL',
      },
      byReason: this.groupCount(risks, 'reason'),
      bySeverity: this.groupCount(risks, 'severity'),
      byRiskStatus: this.groupCount(risks, 'status'),
      byRenewalStatus: this.groupCount(renewals, 'status'),
      byRenewalOutcome: this.groupCount(renewals, 'outcome'),
      byPlanStatus: this.groupCount(plans, 'status'),
      recentEvents: events,
    };
  }

  async listRisks(query: Query = {}) {
    const search = query.search?.trim();
    const where: Prisma.ClientChurnRiskWhereInput = {
      ...(query.status ? { status: query.status as ClientChurnRiskStatus } : {}),
      ...(query.severity ? { severity: query.severity as ClientChurnRiskSeverity } : {}),
      ...(query.reason ? { reason: query.reason as ClientChurnReason } : {}),
      ...(query.source ? { source: query.source as ChurnRiskSource } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.associationId ? { associationId: query.associationId } : {}),
      ...(query.nextFollowUpOverdue === 'true' ? { nextFollowUpAt: { lt: new Date() }, status: { in: OPEN_RISK_STATUSES } } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const items = await this.prisma.clientChurnRisk.findMany({
      where,
      include: { retentionPlans: true },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      take: Math.min(200, Number(query.limit || 100)),
    });
    const filtered = query.hasRetentionPlan === 'true' ? items.filter((item) => item.retentionPlans.length > 0) : items;
    const enriched = await this.enrichRisks(filtered);
    return { items: enriched, meta: { total: enriched.length } };
  }

  async riskDetail(id: string) {
    const risk = await this.prisma.clientChurnRisk.findUnique({ where: { id }, include: { retentionPlans: { include: { actions: true } }, events: { orderBy: { createdAt: 'desc' }, take: 80 } } });
    if (!risk) throw new NotFoundException('Churn risk not found');
    const [client, association, health, subscription, tasks, followUps] = await Promise.all([
      this.prisma.clientAccount.findUnique({ where: { id: risk.clientAccountId } }),
      risk.associationId ? this.prisma.organization.findUnique({ where: { id: risk.associationId }, select: { id: true, name: true, legalName: true, status: true } }) : null,
      this.latestHealth(risk.clientAccountId),
      risk.associationId ? this.latestSubscription(risk.associationId) : null,
      this.prisma.clientTask.findMany({ where: { relatedEntityType: 'CLIENT_CHURN_RISK', relatedEntityId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientFollowUp.findMany({ where: { relatedEntityType: 'CLIENT_CHURN_RISK', relatedEntityId: id }, orderBy: { dueAt: 'asc' } }),
    ]);
    return { risk, client, association, health, subscription, evidence: risk.metadata || {}, retentionPlans: risk.retentionPlans, events: risk.events, tasks, followUps };
  }

  async createRisk(dto: CreateChurnRiskDto, actor: any) {
    const client = await this.ensureClient(dto.clientAccountId);
    const input: RiskInput = {
      clientAccountId: client.id,
      associationId: client.associationId,
      reason: dto.reason || ClientChurnReason.MANUAL,
      severity: dto.severity || ClientChurnRiskSeverity.MEDIUM,
      title: dto.title,
      description: dto.description || null,
      score: dto.score ?? null,
      source: dto.source || ChurnRiskSource.MANUAL,
      detectedBy: ChurnRiskDetectedBy.MANUAL,
      metadata: { manual: true },
    };
    const result = await this.createOrUpdateRisk(input, actor);
    if (dto.assignedToId || dto.nextFollowUpAt) {
      return this.prisma.clientChurnRisk.update({ where: { id: result.item.id }, data: { assignedToId: dto.assignedToId || null, nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null } });
    }
    return result.item;
  }

  async updateRisk(id: string, dto: UpdateChurnRiskDto, actor: any) {
    await this.ensureRisk(id);
    return this.prisma.clientChurnRisk.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.severity ? { severity: dto.severity } : {}),
        ...(dto.score !== undefined ? { score: dto.score } : {}),
        ...(dto.nextFollowUpAt !== undefined ? { nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null } : {}),
        updatedById: actor?.id || null,
      },
    });
  }

  async updateRiskStatus(id: string, dto: UpdateChurnRiskStatusDto, actor: any) {
    const current = await this.ensureRisk(id);
    const now = new Date();
    const updated = await this.prisma.clientChurnRisk.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedAt: dto.status === ClientChurnRiskStatus.IN_REVIEW ? now : current.reviewedAt,
        reviewedById: dto.status === ClientChurnRiskStatus.IN_REVIEW ? actor?.id || null : current.reviewedById,
        closedAt: CLOSED_RISK_STATUSES.includes(dto.status) && !OUTCOME_RISK_STATUSES.includes(dto.status) ? now : current.closedAt,
        closeReason: dto.reason || current.closeReason,
        updatedById: actor?.id || null,
      },
    });
    await this.event({ risk: updated }, actor, ClientRetentionEventType.CHURN_RISK_STATUS_CHANGED, 'Status risc schimbat', `${current.status} -> ${updated.status}`, { reason: dto.reason });
    return updated;
  }

  async assignRisk(id: string, dto: AssignRetentionDto, actor: any) {
    await this.ensureRisk(id);
    const updated = await this.prisma.clientChurnRisk.update({ where: { id }, data: { assignedToId: dto.assignedToId || null, updatedById: actor?.id || null } });
    await this.event({ risk: updated }, actor, ClientRetentionEventType.CHURN_RISK_ASSIGNED, 'Risc asignat', dto.assignedToId || 'Neasignat');
    return updated;
  }

  async markRiskSaved(id: string, dto: MarkRiskOutcomeDto, actor: any) {
    const risk = await this.ensureRisk(id);
    const updated = await this.prisma.clientChurnRisk.update({ where: { id }, data: { status: ClientChurnRiskStatus.SAVED, savedAt: new Date(), outcomeNotes: dto.note || null, updatedById: actor?.id || null } });
    await this.event({ risk: updated }, actor, ClientRetentionEventType.CHURN_RISK_SAVED, 'Client salvat', dto.note || risk.title);
    return updated;
  }

  async markRiskLost(id: string, dto: MarkRiskOutcomeDto, actor: any) {
    const risk = await this.ensureRisk(id);
    const updated = await this.prisma.clientChurnRisk.update({ where: { id }, data: { status: ClientChurnRiskStatus.LOST, lostAt: new Date(), outcomeNotes: dto.note || null, updatedById: actor?.id || null } });
    await this.event({ risk: updated }, actor, ClientRetentionEventType.CHURN_RISK_LOST, 'Client pierdut', dto.note || risk.title);
    return updated;
  }

  async dismissRisk(id: string, dto: MarkRiskOutcomeDto, actor: any) {
    const risk = await this.ensureRisk(id);
    const updated = await this.prisma.clientChurnRisk.update({ where: { id }, data: { status: ClientChurnRiskStatus.DISMISSED, closedAt: new Date(), closeReason: dto.note || 'Risc irelevant', updatedById: actor?.id || null } });
    await this.event({ risk: updated }, actor, ClientRetentionEventType.CHURN_RISK_STATUS_CHANGED, 'Risc ignorat', dto.note || risk.title);
    return updated;
  }

  async addRiskNote(id: string, dto: RetentionNoteDto, actor: any) {
    const risk = await this.ensureRisk(id);
    return this.event({ risk }, actor, ClientRetentionEventType.RETENTION_NOTE_ADDED, 'Nota retenție adăugată', dto.note);
  }

  async createRiskTask(id: string, dto: CreateRetentionTaskDto, actor: any) {
    const risk = await this.ensureRisk(id);
    const task = await this.createTaskForEntity(risk.clientAccountId, risk.associationId, 'CLIENT_CHURN_RISK', id, dto.title || `Retention: ${risk.title}`, dto.dueAt, dto.assignedToId || risk.assignedToId, actor, this.priorityForSeverity(risk.severity));
    await this.event({ risk }, actor, ClientRetentionEventType.RETENTION_TASK_CREATED, 'Task retenție creat', task.title, { taskId: task.id });
    return task;
  }

  async createRiskFollowUp(id: string, dto: CreateRetentionFollowUpDto, actor: any) {
    const risk = await this.ensureRisk(id);
    const followUp = await this.createFollowUpForEntity(risk.clientAccountId, risk.associationId, 'CLIENT_CHURN_RISK', id, dto.title || `Follow-up retenție: ${risk.title}`, dto.dueAt, dto.assignedToId || risk.assignedToId, actor, this.priorityForSeverity(risk.severity));
    await this.prisma.clientChurnRisk.update({ where: { id }, data: { nextFollowUpAt: new Date(dto.dueAt), updatedById: actor?.id || null } });
    await this.event({ risk }, actor, ClientRetentionEventType.RETENTION_FOLLOW_UP_CREATED, 'Follow-up retenție creat', dto.dueAt, { followUpId: followUp.id });
    return followUp;
  }

  async listRenewals(query: Query = {}) {
    const now = new Date();
    const where: Prisma.ClientRenewalWhereInput = {
      ...(query.status ? { status: query.status as ClientRenewalStatus } : {}),
      ...(query.outcome ? { outcome: query.outcome as ClientRenewalOutcome } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.associationId ? { associationId: query.associationId } : {}),
      ...(query.subscriptionId ? { subscriptionId: query.subscriptionId } : {}),
      ...(query.upcoming30 === 'true' ? { renewalDate: { gte: now, lte: this.addDays(now, 30) }, status: { in: OPEN_RENEWAL_STATUSES } } : {}),
      ...(query.overdue === 'true' ? { renewalDate: { lt: now }, status: { in: OPEN_RENEWAL_STATUSES } } : {}),
    };
    const items = await this.prisma.clientRenewal.findMany({ where, include: { retentionPlans: true }, orderBy: { renewalDate: 'asc' }, take: Math.min(200, Number(query.limit || 100)) });
    const enriched = await this.enrichRenewals(items);
    return { items: enriched, meta: { total: enriched.length } };
  }

  async renewalDetail(id: string) {
    const renewal = await this.prisma.clientRenewal.findUnique({ where: { id }, include: { retentionPlans: { include: { actions: true } }, events: { orderBy: { createdAt: 'desc' }, take: 80 } } });
    if (!renewal) throw new NotFoundException('Renewal not found');
    const [client, association, subscription, currentPlan, proposedPlan, risks, tasks, followUps] = await Promise.all([
      this.prisma.clientAccount.findUnique({ where: { id: renewal.clientAccountId } }),
      renewal.associationId ? this.prisma.organization.findUnique({ where: { id: renewal.associationId }, select: { id: true, name: true, legalName: true, status: true } }) : null,
      renewal.subscriptionId ? this.prisma.saasSubscription.findUnique({ where: { id: renewal.subscriptionId }, include: { plan: true } }) : null,
      renewal.currentPlanId ? this.prisma.saasPlan.findUnique({ where: { id: renewal.currentPlanId } }) : null,
      renewal.proposedPlanId ? this.prisma.saasPlan.findUnique({ where: { id: renewal.proposedPlanId } }) : null,
      this.prisma.clientChurnRisk.findMany({ where: { clientAccountId: renewal.clientAccountId, status: { in: OPEN_RISK_STATUSES } }, orderBy: { detectedAt: 'desc' } }),
      this.prisma.clientTask.findMany({ where: { relatedEntityType: 'CLIENT_RENEWAL', relatedEntityId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientFollowUp.findMany({ where: { relatedEntityType: 'CLIENT_RENEWAL', relatedEntityId: id }, orderBy: { dueAt: 'asc' } }),
    ]);
    return { renewal, client, association, subscription, currentPlan, proposedPlan, relatedChurnRisks: risks, retentionPlans: renewal.retentionPlans, events: renewal.events, tasks, followUps };
  }

  async createRenewal(dto: CreateRenewalDto, actor: any) {
    const client = await this.ensureClient(dto.clientAccountId);
    const subscription = dto.subscriptionId ? await this.prisma.saasSubscription.findUnique({ where: { id: dto.subscriptionId }, include: { plan: true } }) : client.associationId ? await this.latestSubscription(client.associationId) : null;
    const renewalDate = new Date(dto.renewalDate);
    const created = await this.prisma.clientRenewal.create({
      data: {
        clientAccountId: client.id,
        associationId: client.associationId || null,
        subscriptionId: subscription?.id || null,
        currentPlanId: subscription?.planId || null,
        proposedPlanId: dto.proposedPlanId || null,
        status: ClientRenewalStatus.UPCOMING,
        outcome: ClientRenewalOutcome.NOT_SET,
        renewalDate,
        periodStart: subscription?.currentPeriodStart || null,
        periodEnd: subscription?.currentPeriodEnd || subscription?.trialEndsAt || null,
        currentMonthlyValue: subscription ? this.monthlyEquivalent(subscription.price, subscription.billingCycle) : 0,
        proposedMonthlyValue: dto.proposedMonthlyValue ?? null,
        currency: subscription?.currency || BillingCurrency.MDL,
        createdById: actor?.id || null,
      },
    });
    await this.event({ renewal: created }, actor, ClientRetentionEventType.RENEWAL_CREATED, 'Renewal creat', created.renewalDate.toISOString());
    return created;
  }

  async updateRenewal(id: string, dto: UpdateRenewalDto, actor: any) {
    await this.ensureRenewal(id);
    return this.prisma.clientRenewal.update({
      where: { id },
      data: {
        ...(dto.renewalDate ? { renewalDate: new Date(dto.renewalDate) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.outcome ? { outcome: dto.outcome } : {}),
        ...(dto.proposedPlanId !== undefined ? { proposedPlanId: dto.proposedPlanId || null } : {}),
        ...(dto.proposedMonthlyValue !== undefined ? { proposedMonthlyValue: dto.proposedMonthlyValue ?? null } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId || null } : {}),
        updatedById: actor?.id || null,
      },
    });
  }

  async updateRenewalStatus(id: string, dto: UpdateRenewalDto, actor: any) {
    if (!dto.status) throw new BadRequestException('Statusul este obligatoriu.');
    const current = await this.ensureRenewal(id);
    const updated = await this.prisma.clientRenewal.update({ where: { id }, data: { status: dto.status, startedAt: dto.status === ClientRenewalStatus.IN_PROGRESS ? new Date() : current.startedAt, updatedById: actor?.id || null } });
    await this.event({ renewal: updated }, actor, ClientRetentionEventType.RENEWAL_STATUS_CHANGED, 'Status renewal schimbat', `${current.status} -> ${updated.status}`);
    return updated;
  }

  async startRenewal(id: string, actor: any) {
    return this.updateRenewalStatus(id, { status: ClientRenewalStatus.IN_PROGRESS }, actor);
  }

  async completeRenewal(id: string, dto: CompleteRenewalDto, actor: any) {
    const current = await this.ensureRenewal(id);
    const renewed = RENEWED_OUTCOMES.includes(dto.outcome);
    const updated = await this.prisma.clientRenewal.update({
      where: { id },
      data: {
        status: renewed ? ClientRenewalStatus.RENEWED : ClientRenewalStatus.NOT_RENEWED,
        outcome: dto.outcome,
        outcomeNotes: dto.outcomeNotes || null,
        completedAt: new Date(),
        completedById: actor?.id || null,
        updatedById: actor?.id || null,
      },
    });
    await this.event({ renewal: updated }, actor, ClientRetentionEventType.RENEWAL_COMPLETED, 'Renewal finalizat', dto.outcome, { previousStatus: current.status, notes: dto.outcomeNotes });
    return updated;
  }

  async createRenewalTask(id: string, dto: CreateRetentionTaskDto, actor: any) {
    const renewal = await this.ensureRenewal(id);
    const task = await this.createTaskForEntity(renewal.clientAccountId, renewal.associationId, 'CLIENT_RENEWAL', id, dto.title || 'Pregătește renewal client', dto.dueAt, dto.assignedToId || renewal.assignedToId, actor, ClientPriority.NORMAL);
    await this.event({ renewal }, actor, ClientRetentionEventType.RETENTION_TASK_CREATED, 'Task renewal creat', task.title, { taskId: task.id });
    return task;
  }

  async createRenewalFollowUp(id: string, dto: CreateRetentionFollowUpDto, actor: any) {
    const renewal = await this.ensureRenewal(id);
    const followUp = await this.createFollowUpForEntity(renewal.clientAccountId, renewal.associationId, 'CLIENT_RENEWAL', id, dto.title || 'Follow-up renewal client', dto.dueAt, dto.assignedToId || renewal.assignedToId, actor, ClientPriority.NORMAL);
    await this.event({ renewal }, actor, ClientRetentionEventType.RETENTION_FOLLOW_UP_CREATED, 'Follow-up renewal creat', dto.dueAt, { followUpId: followUp.id });
    return followUp;
  }

  async generateRenewalsFromSubscriptions(actor: any) {
    const now = new Date();
    const subscriptions = await this.prisma.saasSubscription.findMany({
      where: {
        status: { in: [SaasSubscriptionStatus.ACTIVE, SaasSubscriptionStatus.TRIALING] },
        OR: [{ currentPeriodEnd: { gte: now } }, { trialEndsAt: { gte: now } }],
      },
      include: { plan: true, association: { select: { id: true, name: true, legalName: true } } },
      take: 500,
    });
    let created = 0;
    let skipped = 0;
    const items: any[] = [];
    for (const subscription of subscriptions) {
      const renewalDate = subscription.status === SaasSubscriptionStatus.TRIALING ? subscription.trialEndsAt : subscription.currentPeriodEnd;
      if (!renewalDate) {
        skipped++;
        continue;
      }
      const client = await this.prisma.clientAccount.findFirst({ where: { associationId: subscription.associationId }, orderBy: { updatedAt: 'desc' } });
      if (!client) {
        skipped++;
        continue;
      }
      const existing = await this.prisma.clientRenewal.findFirst({ where: { subscriptionId: subscription.id, renewalDate } });
      if (existing) {
        skipped++;
        items.push(existing);
        continue;
      }
      const saved = await this.prisma.clientRenewal.create({
        data: {
          clientAccountId: client.id,
          associationId: subscription.associationId,
          subscriptionId: subscription.id,
          currentPlanId: subscription.planId,
          status: ClientRenewalStatus.UPCOMING,
          outcome: ClientRenewalOutcome.NOT_SET,
          renewalDate,
          periodStart: subscription.currentPeriodStart || null,
          periodEnd: subscription.currentPeriodEnd || subscription.trialEndsAt || null,
          currentMonthlyValue: this.monthlyEquivalent(subscription.price, subscription.billingCycle),
          currency: subscription.currency || BillingCurrency.MDL,
          metadata: { generatedFromSubscription: true, subscriptionStatus: subscription.status } as Prisma.InputJsonValue,
          createdById: actor?.id || 'system',
        },
      });
      await this.event({ renewal: saved }, actor, ClientRetentionEventType.RENEWAL_CREATED, 'Renewal generat din subscription', renewalDate.toISOString());
      created++;
      items.push(saved);
    }
    return { created, skipped, items };
  }

  async listPlans(query: Query = {}) {
    const where: Prisma.ClientRetentionPlanWhereInput = {
      ...(query.status ? { status: query.status as ClientRetentionPlanStatus } : {}),
      ...(query.priority ? { priority: query.priority as ClientPriority } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.associationId ? { associationId: query.associationId } : {}),
      ...(query.churnRiskId ? { churnRiskId: query.churnRiskId } : {}),
      ...(query.renewalId ? { renewalId: query.renewalId } : {}),
      ...(query.dueOverdue === 'true' ? { dueAt: { lt: new Date() }, status: { in: OPEN_PLAN_STATUSES } } : {}),
    };
    const items = await this.prisma.clientRetentionPlan.findMany({ where, include: { actions: true }, orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueAt: 'asc' }], take: Math.min(200, Number(query.limit || 100)) });
    const enriched = await this.enrichPlans(items);
    return { items: enriched, meta: { total: enriched.length } };
  }

  async planDetail(id: string) {
    const plan = await this.prisma.clientRetentionPlan.findUnique({ where: { id }, include: { actions: { orderBy: [{ status: 'asc' }, { dueAt: 'asc' }] }, events: { orderBy: { createdAt: 'desc' }, take: 80 }, churnRisk: true, renewal: true } });
    if (!plan) throw new NotFoundException('Retention plan not found');
    const [client, association, tasks, followUps] = await Promise.all([
      this.prisma.clientAccount.findUnique({ where: { id: plan.clientAccountId } }),
      plan.associationId ? this.prisma.organization.findUnique({ where: { id: plan.associationId }, select: { id: true, name: true, legalName: true, status: true } }) : null,
      this.prisma.clientTask.findMany({ where: { relatedEntityType: 'CLIENT_RETENTION_PLAN', relatedEntityId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientFollowUp.findMany({ where: { relatedEntityType: 'CLIENT_RETENTION_PLAN', relatedEntityId: id }, orderBy: { dueAt: 'asc' } }),
    ]);
    return { plan, client, association, actions: plan.actions, events: plan.events, churnRisk: plan.churnRisk, renewal: plan.renewal, tasks, followUps };
  }

  async createPlan(dto: CreateRetentionPlanDto, actor: any) {
    let clientAccountId = dto.clientAccountId;
    let associationId: string | null | undefined = null;
    let risk: any = null;
    let renewal: any = null;
    if (dto.churnRiskId) {
      risk = await this.ensureRisk(dto.churnRiskId);
      clientAccountId = risk.clientAccountId;
      associationId = risk.associationId;
    }
    if (dto.renewalId) {
      renewal = await this.ensureRenewal(dto.renewalId);
      clientAccountId = renewal.clientAccountId;
      associationId = renewal.associationId;
    }
    if (!clientAccountId) throw new BadRequestException('clientAccountId, churnRiskId sau renewalId este obligatoriu.');
    const client = await this.ensureClient(clientAccountId);
    associationId = associationId ?? client.associationId;
    const title = dto.title || (risk ? `Plan retenție: ${risk.title}` : renewal ? 'Plan renewal client' : `Plan retenție: ${client.displayName}`);
    const plan = await this.prisma.clientRetentionPlan.create({
      data: {
        clientAccountId: client.id,
        associationId: associationId || null,
        churnRiskId: risk?.id || null,
        renewalId: renewal?.id || null,
        status: ClientRetentionPlanStatus.ACTIVE,
        title,
        goal: dto.goal || 'Păstrarea clientului și clarificarea pașilor de renewal.',
        priority: dto.priority || (risk ? this.priorityForSeverity(risk.severity) : ClientPriority.NORMAL),
        ownerUserId: dto.ownerUserId || risk?.assignedToId || renewal?.assignedToId || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : this.addDays(new Date(), 7),
        createdById: actor?.id || 'system',
      },
    });
    await this.createPlanTemplateActions(plan, risk?.reason || (renewal ? ClientChurnReason.SUBSCRIPTION_EXPIRING : ClientChurnReason.MANUAL), actor);
    if (risk) await this.prisma.clientChurnRisk.update({ where: { id: risk.id }, data: { status: ClientChurnRiskStatus.RETENTION_IN_PROGRESS, updatedById: actor?.id || null } });
    await this.event({ plan, risk, renewal }, actor, ClientRetentionEventType.RETENTION_PLAN_CREATED, 'Plan de retenție creat', plan.title);
    return this.planDetail(plan.id);
  }

  async updatePlan(id: string, dto: UpdateRetentionPlanDto, actor: any) {
    await this.ensurePlan(id);
    return this.prisma.clientRetentionPlan.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.goal ? { goal: dto.goal } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
        ...(dto.ownerUserId !== undefined ? { ownerUserId: dto.ownerUserId || null } : {}),
        updatedById: actor?.id || null,
      },
    });
  }

  async createPlanAction(id: string, dto: RetentionActionDto, actor: any) {
    const plan = await this.ensurePlan(id);
    const action = await this.prisma.clientRetentionAction.create({
      data: {
        retentionPlanId: id,
        clientAccountId: plan.clientAccountId,
        associationId: plan.associationId,
        actionType: dto.actionType,
        title: dto.title,
        description: dto.description || null,
        status: dto.status || ClientRetentionActionStatus.PENDING,
        priority: dto.priority || plan.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        assignedToId: dto.assignedToId || plan.ownerUserId || null,
      },
    });
    return action;
  }

  async updatePlanAction(planId: string, actionId: string, dto: RetentionActionDto, actor: any) {
    await this.ensurePlan(planId);
    return this.prisma.clientRetentionAction.update({
      where: { id: actionId },
      data: {
        ...(dto.actionType ? { actionType: dto.actionType } : {}),
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId || null } : {}),
      },
    });
  }

  async completePlanAction(planId: string, actionId: string, dto: CompleteRetentionActionDto, actor: any) {
    const action = await this.prisma.clientRetentionAction.update({ where: { id: actionId }, data: { status: ClientRetentionActionStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null, resultNote: dto.resultNote || null } });
    const plan = await this.ensurePlan(planId);
    await this.event({ plan }, actor, ClientRetentionEventType.RETENTION_ACTION_COMPLETED, 'Acțiune retenție completată', action.title, { actionId, resultNote: dto.resultNote });
    return action;
  }

  async completePlan(id: string, dto: CompleteRetentionPlanDto, actor: any) {
    const plan = await this.ensurePlan(id);
    const updated = await this.prisma.clientRetentionPlan.update({ where: { id }, data: { status: ClientRetentionPlanStatus.COMPLETED, outcome: dto.outcome, outcomeNotes: dto.outcomeNotes || null, completedAt: new Date(), completedById: actor?.id || null, updatedById: actor?.id || null } });
    if (plan.churnRiskId && dto.outcome === ClientRetentionPlanOutcome.SAVED) await this.markRiskSaved(plan.churnRiskId, { note: dto.outcomeNotes }, actor);
    if (plan.churnRiskId && dto.outcome === ClientRetentionPlanOutcome.LOST) await this.markRiskLost(plan.churnRiskId, { note: dto.outcomeNotes }, actor);
    await this.event({ plan: updated }, actor, ClientRetentionEventType.RETENTION_PLAN_COMPLETED, 'Plan retenție finalizat', dto.outcome, { notes: dto.outcomeNotes });
    return updated;
  }

  async cancelPlan(id: string, dto: MarkRiskOutcomeDto, actor: any) {
    const plan = await this.ensurePlan(id);
    const updated = await this.prisma.clientRetentionPlan.update({ where: { id }, data: { status: ClientRetentionPlanStatus.CANCELLED, outcomeNotes: dto.note || null, updatedById: actor?.id || null } });
    await this.event({ plan: updated }, actor, ClientRetentionEventType.RETENTION_PLAN_CANCELLED, 'Plan retenție anulat', dto.note || plan.title);
    return updated;
  }

  async createPlanTask(id: string, dto: CreateRetentionTaskDto, actor: any) {
    const plan = await this.ensurePlan(id);
    const task = await this.createTaskForEntity(plan.clientAccountId, plan.associationId, 'CLIENT_RETENTION_PLAN', id, dto.title || `Task retenție: ${plan.title}`, dto.dueAt, dto.assignedToId || plan.ownerUserId, actor, plan.priority);
    await this.event({ plan }, actor, ClientRetentionEventType.RETENTION_TASK_CREATED, 'Task retenție creat', task.title, { taskId: task.id });
    return task;
  }

  async createPlanFollowUp(id: string, dto: CreateRetentionFollowUpDto, actor: any) {
    const plan = await this.ensurePlan(id);
    const followUp = await this.createFollowUpForEntity(plan.clientAccountId, plan.associationId, 'CLIENT_RETENTION_PLAN', id, dto.title || `Follow-up retenție: ${plan.title}`, dto.dueAt, dto.assignedToId || plan.ownerUserId, actor, plan.priority);
    await this.event({ plan }, actor, ClientRetentionEventType.RETENTION_FOLLOW_UP_CREATED, 'Follow-up retenție creat', dto.dueAt, { followUpId: followUp.id });
    return followUp;
  }

  async clientRetention(clientId: string) {
    await this.ensureClient(clientId);
    const [risks, renewals, plans, health] = await Promise.all([
      this.listRisks({ clientAccountId: clientId }),
      this.listRenewals({ clientAccountId: clientId }),
      this.listPlans({ clientAccountId: clientId }),
      this.latestHealth(clientId),
    ]);
    return { health, risks: risks.items, renewals: renewals.items, plans: plans.items };
  }

  async detectAll(actor: any) {
    const clients = await this.prisma.clientAccount.findMany({ take: 250, orderBy: { updatedAt: 'desc' } });
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items: any[] = [];
    for (const client of clients) {
      const result = await this.detectClient(client.id, actor);
      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
      items.push(...result.items);
    }
    return { created, updated, skipped, items };
  }

  async detectClient(clientId: string, actor: any) {
    const client = await this.ensureClient(clientId);
    const now = new Date();
    const [health, subscriptions, invoices, collections, followUps, tasks, promises] = await Promise.all([
      this.latestHealth(client.id),
      client.associationId ? this.prisma.saasSubscription.findMany({ where: { associationId: client.associationId }, include: { plan: true }, orderBy: { updatedAt: 'desc' } }) : Promise.resolve([] as any[]),
      client.associationId ? this.prisma.saasInvoice.findMany({ where: { associationId: client.associationId, balanceAmount: { gt: 0 }, status: { in: COLLECTIBLE_INVOICE_STATUSES } }, orderBy: { dueDate: 'asc' }, take: 20 }) : Promise.resolve([] as any[]),
      this.prisma.revenueCollectionCase.findMany({ where: { clientAccountId: client.id, status: { in: OPEN_COLLECTION_STATUSES } }, orderBy: [{ priority: 'desc' }, { nextFollowUpAt: 'asc' }], take: 20 }),
      this.prisma.clientFollowUp.findMany({ where: { clientAccountId: client.id, status: ClientFollowUpStatus.OPEN, dueAt: { lt: now } }, orderBy: { dueAt: 'asc' }, take: 20 }),
      this.prisma.clientTask.findMany({ where: { clientAccountId: client.id, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: now } }, orderBy: { dueAt: 'asc' }, take: 20 }),
      this.prisma.paymentPromise.findMany({ where: { clientAccountId: client.id, status: PaymentPromiseStatus.MISSED }, take: 20 }),
    ]);

    const inputs: RiskInput[] = [];
    if (health && (HEALTH_RISK_STATUSES.includes(health.status) || health.overallScore < 50)) {
      const reason = this.reasonFromHealth(health);
      inputs.push({
        clientAccountId: client.id,
        associationId: client.associationId,
        reason,
        severity: health.status === ClientHealthStatus.CRITICAL || health.overallScore < 30 ? ClientChurnRiskSeverity.CRITICAL : ClientChurnRiskSeverity.HIGH,
        title: `Health ${health.status}: ${client.displayName}`,
        description: `Client health score este ${health.overallScore}/100.`,
        score: Math.max(0, 100 - health.overallScore),
        source: ChurnRiskSource.HEALTH_SCORE,
        sourceEntityType: 'CLIENT_HEALTH_SNAPSHOT',
        sourceEntityId: health.id,
        metadata: { healthStatus: health.status, healthScore: health.overallScore, riskReasons: health.riskReasons },
      });
    }

    for (const subscription of subscriptions.slice(0, 3)) {
      const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
      const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
      if (subscription.status === SaasSubscriptionStatus.SUSPENDED || subscription.status === SaasSubscriptionStatus.PAST_DUE) {
        inputs.push(this.subscriptionRisk(client, subscription, subscription.status === SaasSubscriptionStatus.SUSPENDED ? ClientChurnReason.SUBSCRIPTION_SUSPENDED : ClientChurnReason.PAYMENT_ISSUES, ClientChurnRiskSeverity.HIGH));
      }
      if (subscription.status === SaasSubscriptionStatus.TRIALING && trialEndsAt && trialEndsAt <= this.addDays(now, 7)) {
        inputs.push(this.subscriptionRisk(client, subscription, ClientChurnReason.TRIAL_EXPIRING, ClientChurnRiskSeverity.HIGH));
      }
      if (subscription.status === SaasSubscriptionStatus.ACTIVE && periodEnd && periodEnd <= this.addDays(now, 30)) {
        inputs.push(this.subscriptionRisk(client, subscription, ClientChurnReason.SUBSCRIPTION_EXPIRING, ClientChurnRiskSeverity.MEDIUM));
      }
    }

    const overdueInvoices = invoices.filter((invoice) => invoice.dueDate < now);
    if (overdueInvoices.length) {
      inputs.push({
        clientAccountId: client.id,
        associationId: client.associationId,
        reason: ClientChurnReason.SAAS_INVOICE_OVERDUE,
        severity: overdueInvoices.some((invoice) => invoice.dueDate < this.addDays(now, -30)) ? ClientChurnRiskSeverity.HIGH : ClientChurnRiskSeverity.MEDIUM,
        title: `Facturi SaaS restante: ${client.displayName}`,
        description: `${overdueInvoices.length} facturi SaaS au sold restant.`,
        score: Math.min(100, 50 + overdueInvoices.length * 10),
        source: ChurnRiskSource.REVENUE_COLLECTIONS,
        metadata: { overdueInvoices: overdueInvoices.map((invoice) => ({ id: invoice.id, balanceAmount: invoice.balanceAmount, dueDate: invoice.dueDate })) },
      });
    }

    if (collections.length || promises.length) {
      inputs.push({
        clientAccountId: client.id,
        associationId: client.associationId,
        reason: ClientChurnReason.PAYMENT_ISSUES,
        severity: promises.length ? ClientChurnRiskSeverity.HIGH : ClientChurnRiskSeverity.MEDIUM,
        title: `Collections active: ${client.displayName}`,
        description: `Există ${collections.length} collection cases active și ${promises.length} promisiuni ratate.`,
        score: Math.min(100, 45 + collections.length * 8 + promises.length * 15),
        source: ChurnRiskSource.REVENUE_COLLECTIONS,
        metadata: { collectionCaseIds: collections.map((item) => item.id), missedPromiseIds: promises.map((item) => item.id) },
      });
    }

    if (followUps.length || tasks.length) {
      inputs.push({
        clientAccountId: client.id,
        associationId: client.associationId,
        reason: ClientChurnReason.NO_FOLLOW_UP,
        severity: tasks.length > 3 || followUps.length > 2 ? ClientChurnRiskSeverity.HIGH : ClientChurnRiskSeverity.MEDIUM,
        title: `Follow-up întârziat: ${client.displayName}`,
        description: `Există follow-up-uri sau taskuri întârziate pentru client.`,
        score: Math.min(100, 40 + followUps.length * 10 + tasks.length * 5),
        source: ChurnRiskSource.CUSTOMER_SUCCESS,
        metadata: { overdueFollowUps: followUps.map((item) => item.id), overdueTasks: tasks.map((item) => item.id) },
      });
    }

    if (ONBOARDING_STAGES.includes(client.lifecycleStage) && client.updatedAt < this.addDays(now, -14)) {
      inputs.push({
        clientAccountId: client.id,
        associationId: client.associationId,
        reason: ClientChurnReason.ONBOARDING_STUCK,
        severity: ClientChurnRiskSeverity.MEDIUM,
        title: `Onboarding blocat: ${client.displayName}`,
        description: 'Clientul este în onboarding fără progres recent.',
        score: 55,
        source: ChurnRiskSource.CUSTOMER_SUCCESS,
        metadata: { lifecycleStage: client.lifecycleStage, lastUpdatedAt: client.updatedAt },
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items: any[] = [];
    for (const input of inputs) {
      const result = await this.createOrUpdateRisk(input, actor);
      if (result.action === 'created') created++;
      else if (result.action === 'updated') updated++;
      else skipped++;
      items.push(result.item);
    }
    return { created, updated, skipped, items };
  }

  private async createOrUpdateRisk(input: RiskInput, actor: any) {
    const metadata = {
      ...(input.metadata || {}),
      revenueAtRisk: await this.calculateRevenueAtRisk(input.clientAccountId, input.severity),
      detectionVersion: 'ES-161',
    };
    const existing = await this.prisma.clientChurnRisk.findFirst({
      where: {
        clientAccountId: input.clientAccountId,
        reason: input.reason,
        source: input.source,
        status: { in: OPEN_RISK_STATUSES },
      },
      orderBy: { detectedAt: 'desc' },
    });
    if (existing) {
      const updated = await this.prisma.clientChurnRisk.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          title: input.title,
          description: input.description || existing.description,
          score: input.score ?? existing.score,
          sourceEntityType: input.sourceEntityType || existing.sourceEntityType,
          sourceEntityId: input.sourceEntityId || existing.sourceEntityId,
          metadata: metadata as Prisma.InputJsonValue,
          updatedById: actor?.id || null,
        },
      });
      return { action: 'updated', item: updated };
    }
    const created = await this.prisma.clientChurnRisk.create({
      data: {
        clientAccountId: input.clientAccountId,
        associationId: input.associationId || null,
        status: ClientChurnRiskStatus.NEW,
        severity: input.severity,
        reason: input.reason,
        title: input.title,
        description: input.description || null,
        score: input.score ?? null,
        detectedAt: new Date(),
        detectedBy: input.detectedBy || ChurnRiskDetectedBy.SYSTEM,
        source: input.source,
        sourceEntityType: input.sourceEntityType || null,
        sourceEntityId: input.sourceEntityId || null,
        metadata: metadata as Prisma.InputJsonValue,
        createdById: actor?.id || null,
      },
    });
    await this.event({ risk: created }, actor, ClientRetentionEventType.CHURN_RISK_DETECTED, 'Churn risk detectat', created.title);
    return { action: 'created', item: created };
  }

  private async enrichRisks(items: any[]) {
    const clients = await this.clientsById(items.map((item) => item.clientAccountId));
    const health = await this.healthByClientId(items.map((item) => item.clientAccountId));
    const subscriptions = await this.subscriptionsByAssociation(items.map((item) => item.associationId).filter(Boolean));
    return Promise.all(items.map(async (item) => ({
      ...item,
      client: clients.get(item.clientAccountId) || null,
      health: health.get(item.clientAccountId) || null,
      subscription: item.associationId ? subscriptions.get(item.associationId) || null : null,
      revenueAtRisk: await this.calculateRevenueAtRisk(item.clientAccountId, item.severity),
    })));
  }

  private async enrichRenewals(items: any[]) {
    const clients = await this.clientsById(items.map((item) => item.clientAccountId));
    const subscriptions = await this.subscriptionsById(items.map((item) => item.subscriptionId).filter(Boolean));
    return items.map((item) => ({
      ...item,
      client: clients.get(item.clientAccountId) || null,
      subscription: item.subscriptionId ? subscriptions.get(item.subscriptionId) || null : null,
      daysRemaining: Math.ceil((new Date(item.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    }));
  }

  private async enrichPlans(items: any[]) {
    const clients = await this.clientsById(items.map((item) => item.clientAccountId));
    return items.map((item) => {
      const actions = item.actions || [];
      const completed = actions.filter((action: any) => action.status === ClientRetentionActionStatus.COMPLETED).length;
      return { ...item, client: clients.get(item.clientAccountId) || null, progress: { total: actions.length, completed, percent: actions.length ? Math.round((completed / actions.length) * 100) : 0 } };
    });
  }

  private async clientsById(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, any>();
    const clients = await this.prisma.clientAccount.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(clients.map((item) => [item.id, item]));
  }

  private async subscriptionsById(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, any>();
    const subscriptions = await this.prisma.saasSubscription.findMany({ where: { id: { in: uniqueIds } }, include: { plan: true } });
    return new Map(subscriptions.map((item) => [item.id, item]));
  }

  private async subscriptionsByAssociation(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, any>();
    const subscriptions = await this.prisma.saasSubscription.findMany({ where: { associationId: { in: uniqueIds } }, include: { plan: true }, orderBy: { updatedAt: 'desc' } });
    const map = new Map<string, any>();
    subscriptions.forEach((item) => { if (!map.has(item.associationId)) map.set(item.associationId, item); });
    return map;
  }

  private async healthByClientId(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return new Map<string, any>();
    const snapshots = await this.prisma.clientHealthSnapshot.findMany({ where: { clientAccountId: { in: uniqueIds } }, orderBy: { calculatedAt: 'desc' } });
    const map = new Map<string, any>();
    snapshots.forEach((item) => { if (!map.has(item.clientAccountId)) map.set(item.clientAccountId, item); });
    return map;
  }

  private async latestHealth(clientAccountId: string) {
    return this.prisma.clientHealthSnapshot.findFirst({ where: { clientAccountId }, orderBy: { calculatedAt: 'desc' } });
  }

  private async latestSubscription(associationId: string) {
    return this.prisma.saasSubscription.findFirst({ where: { associationId }, include: { plan: true }, orderBy: { updatedAt: 'desc' } });
  }

  private async sumRevenueAtRisk(risks: any[]) {
    let total = 0;
    for (const risk of risks) total += await this.calculateRevenueAtRisk(risk.clientAccountId, risk.severity);
    return Math.round(total);
  }

  private sumMetadataAmount(items: any[], key: string) {
    return Math.round(items.reduce((sum, item) => {
      const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {};
      return sum + Number(metadata[key] || 0);
    }, 0));
  }

  private async calculateRevenueAtRisk(clientAccountId: string, severity: ClientChurnRiskSeverity = ClientChurnRiskSeverity.MEDIUM) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id: clientAccountId } });
    if (!client?.associationId) return 0;
    const [subscription, overdue] = await Promise.all([
      this.latestSubscription(client.associationId),
      this.prisma.saasInvoice.aggregate({ where: { associationId: client.associationId, balanceAmount: { gt: 0 }, status: { in: COLLECTIBLE_INVOICE_STATUSES } }, _sum: { balanceAmount: true } }),
    ]);
    const mrr = subscription ? this.monthlyEquivalent(subscription.price, subscription.billingCycle) || this.defaultMonthlyForPlan(subscription.plan, subscription.billingCycle) : 0;
    const multiplier = severity === ClientChurnRiskSeverity.CRITICAL ? 1 : severity === ClientChurnRiskSeverity.HIGH ? 0.75 : severity === ClientChurnRiskSeverity.MEDIUM ? 0.5 : 0.25;
    return Math.round(mrr * multiplier + Number(overdue._sum.balanceAmount || 0));
  }

  private monthlyEquivalent(price: number, billingCycle: SaasBillingCycle | string) {
    return String(billingCycle) === SaasBillingCycle.YEARLY ? Number(price || 0) / 12 : Number(price || 0);
  }

  private defaultMonthlyForPlan(plan: any, billingCycle?: SaasBillingCycle | string) {
    if (!plan) return 0;
    if (String(billingCycle) === SaasBillingCycle.YEARLY && plan.yearlyPrice) return Number(plan.yearlyPrice || 0) / 12;
    return Number(plan.monthlyPrice || 0);
  }

  private subscriptionRisk(client: any, subscription: any, reason: ClientChurnReason, severity: ClientChurnRiskSeverity): RiskInput {
    return {
      clientAccountId: client.id,
      associationId: client.associationId,
      reason,
      severity,
      title: `${this.reasonLabel(reason)}: ${client.displayName}`,
      description: `Subscription ${subscription.status} pentru planul ${subscription.plan?.name || subscription.planId}.`,
      score: severity === ClientChurnRiskSeverity.HIGH ? 80 : 60,
      source: ChurnRiskSource.RENEWAL,
      sourceEntityType: 'SAAS_SUBSCRIPTION',
      sourceEntityId: subscription.id,
      metadata: { subscriptionId: subscription.id, subscriptionStatus: subscription.status, trialEndsAt: subscription.trialEndsAt, currentPeriodEnd: subscription.currentPeriodEnd },
    };
  }

  private reasonFromHealth(health: any) {
    const reasons = Array.isArray(health.riskReasons) ? health.riskReasons : [];
    const keys = reasons.map((reason: any) => reason.key || reason);
    if (keys.includes('TRIAL_ENDING_SOON')) return ClientChurnReason.TRIAL_EXPIRING;
    if (keys.includes('SUBSCRIPTION_SUSPENDED')) return ClientChurnReason.SUBSCRIPTION_SUSPENDED;
    if (keys.includes('SAAS_INVOICE_OVERDUE')) return ClientChurnReason.SAAS_INVOICE_OVERDUE;
    if (keys.includes('LOW_ADMIN_ACTIVITY') || keys.includes('NO_RECENT_LOGIN') || keys.includes('NO_BILLING_RUN')) return ClientChurnReason.LOW_USAGE;
    if (keys.includes('OPEN_SUPPORT_ISSUES') || keys.includes('OPEN_PRODUCTION_INCIDENT')) return ClientChurnReason.SUPPORT_ISSUES;
    if (keys.includes('MANY_DATA_QUALITY_ISSUES') || keys.includes('CRITICAL_DATA_QUALITY_ISSUES')) return ClientChurnReason.DATA_QUALITY_PROBLEMS;
    if (keys.includes('OVERDUE_FOLLOW_UP') || keys.includes('OVERDUE_TASKS') || keys.includes('NO_OWNER_ASSIGNED')) return ClientChurnReason.NO_FOLLOW_UP;
    return ClientChurnReason.OTHER;
  }

  private async createTaskForEntity(clientAccountId: string, associationId: string | null, relatedEntityType: string, relatedEntityId: string, title: string, dueAt: string | undefined, assignedToId: string | null | undefined, actor: any, priority: ClientPriority) {
    return this.prisma.clientTask.create({
      data: {
        clientAccountId,
        associationId,
        title,
        status: ClientTaskStatus.OPEN,
        priority,
        category: ClientTaskCategory.FOLLOW_UP,
        dueAt: dueAt ? new Date(dueAt) : this.addDays(new Date(), 1),
        assignedToId: assignedToId || null,
        createdById: actor?.id || null,
        source: ClientTaskSource.SYSTEM,
        relatedEntityType,
        relatedEntityId,
      },
    });
  }

  private async createFollowUpForEntity(clientAccountId: string, associationId: string | null, relatedEntityType: string, relatedEntityId: string, title: string, dueAt: string, assignedToId: string | null | undefined, actor: any, priority: ClientPriority) {
    return this.prisma.clientFollowUp.create({
      data: {
        clientAccountId,
        associationId,
        title,
        dueAt: new Date(dueAt),
        status: ClientFollowUpStatus.OPEN,
        priority,
        assignedToId: assignedToId || null,
        createdById: actor?.id || null,
        source: ClientFollowUpSource.SYSTEM,
        relatedEntityType,
        relatedEntityId,
      },
    });
  }

  private async createPlanTemplateActions(plan: any, reason: ClientChurnReason, actor: any) {
    const titles = this.templateActions(reason);
    for (const [index, title] of titles.entries()) {
      await this.prisma.clientRetentionAction.create({
        data: {
          retentionPlanId: plan.id,
          clientAccountId: plan.clientAccountId,
          associationId: plan.associationId,
          actionType: this.actionTypeForTitle(title),
          title,
          status: ClientRetentionActionStatus.PENDING,
          priority: plan.priority,
          dueAt: this.addDays(new Date(), index + 1),
          assignedToId: plan.ownerUserId || null,
        },
      });
    }
  }

  private templateActions(reason: ClientChurnReason) {
    const templates: Record<string, string[]> = {
      [ClientChurnReason.LOW_USAGE]: ['Verifică ultima activitate Admin', 'Verifică dacă există facturare recentă', 'Contactează administratorul', 'Oferă ajutor de folosire', 'Programează follow-up'],
      [ClientChurnReason.ONBOARDING_STUCK]: ['Verifică etapa blocată', 'Verifică importul de date', 'Creează task pentru pasul următor', 'Contactează clientul', 'Actualizează stage-ul'],
      [ClientChurnReason.TRIAL_EXPIRING]: ['Verifică usage și health', 'Contactează clientul pentru activare', 'Discută planul potrivit', 'Creează renewal/follow-up'],
      [ClientChurnReason.SAAS_INVOICE_OVERDUE]: ['Verifică collection case', 'Verifică promise to pay', 'Contactează clientul', 'Creează follow-up plată'],
      [ClientChurnReason.MISSING_FEATURE]: ['Identifică feature-ul necesar', 'Verifică planul recomandat', 'Creează upgrade opportunity', 'Discută cu clientul'],
      [ClientChurnReason.SUPPORT_ISSUES]: ['Verifică known issues', 'Creează task intern', 'Oferă sesiune suport', 'Urmărește rezolvarea'],
    };
    return templates[reason] || ['Analizează riscul', 'Contactează clientul', 'Definește următorul pas', 'Programează follow-up', 'Marchează outcome'];
  }

  private actionTypeForTitle(title: string) {
    if (title.includes('Contactează')) return ClientRetentionActionType.CALL_CLIENT;
    if (title.includes('follow-up')) return ClientRetentionActionType.CREATE_FOLLOW_UP;
    if (title.includes('task')) return ClientRetentionActionType.CREATE_TASK;
    if (title.includes('billing') || title.includes('plată') || title.includes('collection')) return ClientRetentionActionType.REVIEW_BILLING;
    if (title.includes('health')) return ClientRetentionActionType.REVIEW_HEALTH;
    if (title.includes('suport')) return ClientRetentionActionType.REVIEW_SUPPORT_ISSUES;
    return ClientRetentionActionType.REVIEW_USAGE;
  }

  private priorityForSeverity(severity: ClientChurnRiskSeverity) {
    if (severity === ClientChurnRiskSeverity.CRITICAL) return ClientPriority.URGENT;
    if (severity === ClientChurnRiskSeverity.HIGH) return ClientPriority.HIGH;
    if (severity === ClientChurnRiskSeverity.LOW) return ClientPriority.LOW;
    return ClientPriority.NORMAL;
  }

  private groupCount(items: any[], field: string) {
    const map = new Map<string, number>();
    for (const item of items) map.set(String(item[field] || 'UNKNOWN'), (map.get(String(item[field] || 'UNKNOWN')) || 0) + 1);
    return Array.from(map.entries()).map(([key, count]) => ({ key, count }));
  }

  private reasonLabel(reason: ClientChurnReason) {
    return reason.replace(/_/g, ' ').toLowerCase();
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private async ensureClient(id: string) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private async ensureRisk(id: string) {
    const risk = await this.prisma.clientChurnRisk.findUnique({ where: { id } });
    if (!risk) throw new NotFoundException('Churn risk not found');
    return risk;
  }

  private async ensureRenewal(id: string) {
    const renewal = await this.prisma.clientRenewal.findUnique({ where: { id } });
    if (!renewal) throw new NotFoundException('Renewal not found');
    return renewal;
  }

  private async ensurePlan(id: string) {
    const plan = await this.prisma.clientRetentionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Retention plan not found');
    return plan;
  }

  private async event(entity: { risk?: any; renewal?: any; plan?: any }, actor: any, eventType: ClientRetentionEventType, title: string, message: string, metadata?: unknown) {
    const risk = entity.risk;
    const renewal = entity.renewal;
    const plan = entity.plan;
    const clientAccountId = risk?.clientAccountId || renewal?.clientAccountId || plan?.clientAccountId;
    if (!clientAccountId) return null;
    return this.prisma.clientRetentionEvent.create({
      data: {
        clientAccountId,
        associationId: risk?.associationId || renewal?.associationId || plan?.associationId || null,
        churnRiskId: risk?.id || plan?.churnRiskId || null,
        renewalId: renewal?.id || plan?.renewalId || null,
        retentionPlanId: plan?.id || null,
        actorUserId: actor?.id || null,
        eventType,
        title,
        message,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
