import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  ClientFollowUpSource,
  ClientFollowUpStatus,
  ClientPriority,
  ClientTaskCategory,
  ClientTaskSource,
  ClientTaskStatus,
  Prisma,
  RevenueForecastHorizon,
  RevenueForecastScenarioStatus,
  RevenueForecastScenarioType,
  RevenueForecastType,
  SaasBillingCycle,
  SaasPlanStatus,
  SaasSubscriptionStatus,
  UpgradeOpportunityEventType,
  UpgradeOpportunityPriority,
  UpgradeOpportunityReason,
  UpgradeOpportunityStatus,
} from '@prisma/client';
import { SaasBillingService } from '../saas-billing/saas-billing.service';
import { SaasUsageService } from '../saas-usage/saas-usage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignUpgradeOpportunityDto,
  ConvertUpgradeOpportunityDto,
  CreateManualUpgradeOpportunityDto,
  RevenueForecastScenarioDto,
  UpdateUpgradeOpportunityDto,
  UpdateUpgradeOpportunityStatusDto,
  UpgradeOpportunityFollowUpDto,
  UpgradeOpportunityNoteDto,
  UpgradeOpportunityTaskDto,
} from './dto/revenue-forecast.dto';

type Query = Record<string, string | undefined>;
type Assumptions = {
  trialConversionRate: number;
  upgradeConversionRate: number;
  collectionRecoveryRate: number;
  churnRiskLossRate: number;
  includePastDue?: boolean;
  includeSuspended?: boolean;
  includeTrialing?: boolean;
};

const OPEN_OPPORTUNITY_STATUSES: UpgradeOpportunityStatus[] = [
  UpgradeOpportunityStatus.NEW,
  UpgradeOpportunityStatus.QUALIFIED,
  UpgradeOpportunityStatus.IN_DISCUSSION,
  UpgradeOpportunityStatus.PROPOSAL_SENT,
  UpgradeOpportunityStatus.ACCEPTED,
];

const DEFAULT_SCENARIOS: Array<{ name: string; type: RevenueForecastScenarioType; assumptions: Assumptions }> = [
  { name: 'Conservative', type: RevenueForecastScenarioType.CONSERVATIVE, assumptions: { trialConversionRate: 0.25, upgradeConversionRate: 0.15, collectionRecoveryRate: 0.35, churnRiskLossRate: 0.5 } },
  { name: 'Base', type: RevenueForecastScenarioType.BASE, assumptions: { trialConversionRate: 0.5, upgradeConversionRate: 0.25, collectionRecoveryRate: 0.6, churnRiskLossRate: 0.3 } },
  { name: 'Optimistic', type: RevenueForecastScenarioType.OPTIMISTIC, assumptions: { trialConversionRate: 0.75, upgradeConversionRate: 0.4, collectionRecoveryRate: 0.8, churnRiskLossRate: 0.15 } },
];

@Injectable()
export class RevenueForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: SaasUsageService,
    private readonly billing: SaasBillingService,
  ) {}

  async dashboard(query: Query = {}) {
    await this.ensureDefaultScenarios();
    const scenario = await this.getScenarioForQuery(query);
    const forecast = await this.calculateForecast(scenario);
    const [opportunities, highScore, scenarios] = await Promise.all([
      this.listOpportunities({ limit: '10' }),
      this.prisma.upgradeOpportunity.count({ where: { status: { in: OPEN_OPPORTUNITY_STATUSES }, score: { gte: 80 } } }),
      this.prisma.revenueForecastScenario.findMany({ where: { status: { not: RevenueForecastScenarioStatus.ARCHIVED } }, orderBy: { updatedAt: 'desc' }, take: 10 }),
    ]);
    return {
      currency: 'MDL',
      current: forecast.current,
      forecast: forecast.forecast,
      breakdown: forecast.breakdown,
      scenarios,
      topUpgradeOpportunities: opportunities.items,
      summary: {
        currentMrr: forecast.current.mrr,
        currentArr: forecast.current.arr,
        forecastMrr: forecast.forecast.forecastMrr,
        forecastArr: forecast.forecast.forecastArr,
        upgradePotential: forecast.forecast.upgradePotential,
        trialConversionPotential: forecast.forecast.trialConversionPotential,
        collectionRecoveryPotential: forecast.forecast.collectionRecoveryPotential,
        revenueAtRisk: forecast.forecast.churnRiskAmount,
        openUpgradeOpportunities: opportunities.meta.total,
        highScoreOpportunities: highScore,
      },
      note: 'Valori estimative interne, nu raport contabil fiscal.',
    };
  }

  async forecast(query: Query = {}) {
    const scenario = await this.getScenarioForQuery(query);
    return this.calculateForecast(scenario);
  }

  async generateSnapshot(body: { scenarioId?: string; horizon?: RevenueForecastHorizon }, actor: any) {
    const scenario = body.scenarioId ? await this.ensureScenario(body.scenarioId) : await this.getScenarioForQuery({ horizon: body.horizon });
    const result = await this.calculateForecast(scenario);
    const snapshot = await this.prisma.revenueForecastSnapshot.create({
      data: {
        scenarioId: scenario?.id || null,
        forecastType: this.forecastTypeForScenario(scenario?.type),
        horizon: body.horizon || scenario?.horizon || RevenueForecastHorizon.DAYS_90,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        currency: BillingCurrency.MDL,
        currentMrr: result.current.mrr,
        currentArr: result.current.arr,
        forecastMrr: result.forecast.forecastMrr,
        forecastArr: result.forecast.forecastArr,
        expansionPotential: result.forecast.upgradePotential + result.forecast.trialConversionPotential,
        churnRiskAmount: result.forecast.churnRiskAmount,
        collectionRecoveryPotential: result.forecast.collectionRecoveryPotential,
        trialConversionPotential: result.forecast.trialConversionPotential,
        upgradePotential: result.forecast.upgradePotential,
        assumptions: result.assumptions as Prisma.InputJsonValue,
        breakdown: result.breakdown as Prisma.InputJsonValue,
        generatedById: actor?.id || null,
      },
    });
    return { snapshot, result };
  }

  async snapshots(query: Query = {}) {
    const items = await this.prisma.revenueForecastSnapshot.findMany({
      where: { ...(query.scenarioId ? { scenarioId: query.scenarioId } : {}) },
      include: { scenario: true },
      orderBy: { generatedAt: 'desc' },
      take: Math.min(100, Number(query.limit || 50)),
    });
    return { items, meta: { total: items.length } };
  }

  async snapshot(id: string) {
    const snapshot = await this.prisma.revenueForecastSnapshot.findUnique({ where: { id }, include: { scenario: true } });
    if (!snapshot) throw new NotFoundException('Forecast snapshot not found');
    return snapshot;
  }

  async scenarios() {
    await this.ensureDefaultScenarios();
    const items = await this.prisma.revenueForecastScenario.findMany({ where: { status: { not: RevenueForecastScenarioStatus.ARCHIVED } }, orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }] });
    return { items, meta: { total: items.length } };
  }

  async createScenario(dto: RevenueForecastScenarioDto, actor: any) {
    return this.prisma.revenueForecastScenario.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        type: dto.type,
        status: dto.status || RevenueForecastScenarioStatus.DRAFT,
        horizon: dto.horizon || RevenueForecastHorizon.DAYS_90,
        assumptions: this.assumptionsFromDto(dto) as Prisma.InputJsonValue,
        createdById: actor?.id || 'system',
      },
    });
  }

  async scenario(id: string) {
    const scenario = await this.ensureScenario(id);
    const latestSnapshot = await this.prisma.revenueForecastSnapshot.findFirst({ where: { scenarioId: id }, orderBy: { generatedAt: 'desc' } });
    return { scenario, latestSnapshot };
  }

  async updateScenario(id: string, dto: Partial<RevenueForecastScenarioDto>, actor: any) {
    await this.ensureScenario(id);
    return this.prisma.revenueForecastScenario.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.horizon ? { horizon: dto.horizon } : {}),
        assumptions: this.assumptionsFromDto(dto),
        updatedById: actor?.id || null,
      },
    });
  }

  async archiveScenario(id: string, actor: any) {
    await this.ensureScenario(id);
    return this.prisma.revenueForecastScenario.update({ where: { id }, data: { status: RevenueForecastScenarioStatus.ARCHIVED, updatedById: actor?.id || null } });
  }

  async listOpportunities(query: Query = {}) {
    const search = query.search?.trim();
    const take = Math.min(200, Number(query.limit || 100));
    const where: Prisma.UpgradeOpportunityWhereInput = {
      ...(query.status ? { status: query.status as UpgradeOpportunityStatus } : {}),
      ...(query.reason ? { reason: query.reason as UpgradeOpportunityReason } : {}),
      ...(query.priority ? { priority: query.priority as UpgradeOpportunityPriority } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.associationId ? { associationId: query.associationId } : {}),
      ...(query.scoreMin ? { score: { gte: Number(query.scoreMin) } } : {}),
      ...(query.currentPlanId ? { currentPlanId: query.currentPlanId } : {}),
      ...(query.recommendedPlanId ? { recommendedPlanId: query.recommendedPlanId } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const items = await this.prisma.upgradeOpportunity.findMany({ where, include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }], take });
    const summary = {
      total: await this.prisma.upgradeOpportunity.count({ where }),
      new: items.filter((item) => item.status === UpgradeOpportunityStatus.NEW).length,
      qualified: items.filter((item) => item.status === UpgradeOpportunityStatus.QUALIFIED).length,
      estimatedMonthlyIncrease: Math.round(items.reduce((sum, item) => sum + item.estimatedMonthlyIncrease, 0)),
      estimatedAnnualIncrease: Math.round(items.reduce((sum, item) => sum + item.estimatedAnnualIncrease, 0)),
      highScore: items.filter((item) => item.score >= 80).length,
    };
    return { items, summary, meta: { total: summary.total } };
  }

  async opportunity(id: string) {
    const opportunity = await this.prisma.upgradeOpportunity.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!opportunity) throw new NotFoundException('Upgrade opportunity not found');
    const [client, association, currentPlan, recommendedPlan, subscription, tasks, followUps] = await Promise.all([
      opportunity.clientAccountId ? this.prisma.clientAccount.findUnique({ where: { id: opportunity.clientAccountId } }) : null,
      this.prisma.organization.findUnique({ where: { id: opportunity.associationId }, select: { id: true, name: true, legalName: true, status: true } }),
      opportunity.currentPlanId ? this.prisma.saasPlan.findUnique({ where: { id: opportunity.currentPlanId } }) : null,
      opportunity.recommendedPlanId ? this.prisma.saasPlan.findUnique({ where: { id: opportunity.recommendedPlanId } }) : null,
      opportunity.subscriptionId ? this.prisma.saasSubscription.findUnique({ where: { id: opportunity.subscriptionId }, include: { plan: true } }) : null,
      this.prisma.clientTask.findMany({ where: { relatedEntityType: 'UPGRADE_OPPORTUNITY', relatedEntityId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientFollowUp.findMany({ where: { relatedEntityType: 'UPGRADE_OPPORTUNITY', relatedEntityId: id }, orderBy: { dueAt: 'asc' } }),
    ]);
    return { opportunity, client, association, currentPlan, recommendedPlan, subscription, events: opportunity.events, tasks, followUps };
  }

  async createManualOpportunity(dto: CreateManualUpgradeOpportunityDto, actor: any) {
    const current = dto.currentMonthlyValue || 0;
    const recommended = dto.recommendedMonthlyValue || current;
    const created = await this.prisma.upgradeOpportunity.create({
      data: {
        associationId: dto.associationId,
        clientAccountId: dto.clientAccountId || null,
        subscriptionId: dto.subscriptionId || null,
        currentPlanId: dto.currentPlanId || null,
        recommendedPlanId: dto.recommendedPlanId || null,
        reason: dto.reason || UpgradeOpportunityReason.MANUAL,
        priority: dto.priority || UpgradeOpportunityPriority.NORMAL,
        score: this.calculateOpportunityScore({ reason: dto.reason || UpgradeOpportunityReason.MANUAL, healthy: true, overdue: false, overLimit: false, nearLimit: false }),
        title: dto.title,
        description: dto.description || null,
        currentMonthlyValue: current,
        recommendedMonthlyValue: recommended,
        estimatedMonthlyIncrease: Math.max(0, recommended - current),
        estimatedAnnualIncrease: Math.max(0, recommended - current) * 12,
        currency: dto.currency || BillingCurrency.MDL,
        evidence: { manual: true } as Prisma.InputJsonValue,
        recommendedActions: [{ title: 'Creeaza follow-up pentru discutia de upgrade.' }] as Prisma.InputJsonValue,
        createdById: actor?.id || null,
      },
    });
    await this.event(created, actor, UpgradeOpportunityEventType.OPPORTUNITY_CREATED, 'Oportunitate manuala creata', created.title);
    return created;
  }

  async updateOpportunity(id: string, dto: UpdateUpgradeOpportunityDto, actor: any) {
    const current = await this.ensureOpportunity(id);
    const updated = await this.prisma.upgradeOpportunity.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.nextFollowUpAt ? { nextFollowUpAt: new Date(dto.nextFollowUpAt) } : {}),
        updatedById: actor?.id || null,
      },
    });
    if (dto.priority && dto.priority !== current.priority) await this.event(updated, actor, UpgradeOpportunityEventType.OPPORTUNITY_PRIORITY_CHANGED, 'Prioritate schimbata', `${current.priority} -> ${updated.priority}`);
    return updated;
  }

  async updateStatus(id: string, dto: UpdateUpgradeOpportunityStatusDto, actor: any) {
    const current = await this.ensureOpportunity(id);
    const now = new Date();
    const data: Prisma.UpgradeOpportunityUpdateInput = { status: dto.status, updatedById: actor?.id || null };
    if (dto.status === UpgradeOpportunityStatus.QUALIFIED) data.qualifiedAt = now;
    if (dto.status === UpgradeOpportunityStatus.PROPOSAL_SENT) data.proposalSentAt = now;
    if (dto.status === UpgradeOpportunityStatus.ACCEPTED) data.acceptedAt = now;
    if (dto.status === UpgradeOpportunityStatus.REJECTED) data.rejectedAt = now;
    if (dto.status === UpgradeOpportunityStatus.LOST) data.lostAt = now;
    if (dto.status === UpgradeOpportunityStatus.DISMISSED) {
      data.dismissedAt = now;
      data.dismissalReason = dto.reason || 'Dismissed manual.';
    }
    const updated = await this.prisma.upgradeOpportunity.update({ where: { id }, data });
    await this.event(updated, actor, this.eventTypeForStatus(dto.status), 'Status oportunitate schimbat', `${current.status} -> ${updated.status}`, { reason: dto.reason });
    return updated;
  }

  async assign(id: string, dto: AssignUpgradeOpportunityDto, actor: any) {
    const updated = await this.prisma.upgradeOpportunity.update({ where: { id }, data: { assignedToId: dto.assignedToId || null, updatedById: actor?.id || null } });
    await this.event(updated, actor, UpgradeOpportunityEventType.OPPORTUNITY_ASSIGNED, 'Oportunitate asignata', dto.assignedToId || 'Neasignat');
    return updated;
  }

  async addNote(id: string, dto: UpgradeOpportunityNoteDto, actor: any) {
    const opportunity = await this.ensureOpportunity(id);
    await this.event(opportunity, actor, UpgradeOpportunityEventType.NOTE_ADDED, 'Nota upgrade adaugata', dto.note);
    if (opportunity.clientAccountId) {
      await this.prisma.clientKnowledgeItem.create({
        data: {
          clientAccountId: opportunity.clientAccountId,
          associationId: opportunity.associationId,
          type: 'BILLING_CONTEXT' as any,
          category: 'BILLING' as any,
          status: 'ACTIVE' as any,
          visibility: 'INTERNAL_SUPERADMIN' as any,
          priority: 'NORMAL' as any,
          title: `Upgrade opportunity: ${opportunity.title}`,
          content: dto.note,
          createdById: actor?.id || 'system',
          relatedEntityType: 'UPGRADE_OPPORTUNITY',
          relatedEntityId: id,
        },
      }).catch(() => undefined);
    }
    return { ok: true };
  }

  async createTask(id: string, dto: UpgradeOpportunityTaskDto, actor: any) {
    const opportunity = await this.ensureOpportunity(id);
    if (!opportunity.clientAccountId) throw new BadRequestException('Oportunitatea nu are ClientAccount legat.');
    const task = await this.prisma.clientTask.create({
      data: {
        clientAccountId: opportunity.clientAccountId,
        associationId: opportunity.associationId,
        title: dto.title || `Discuta upgrade: ${opportunity.title}`,
        status: ClientTaskStatus.OPEN,
        priority: this.clientPriority(opportunity.priority),
        category: ClientTaskCategory.SUBSCRIPTION,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedToId: dto.assignedToId || opportunity.assignedToId || null,
        createdById: actor?.id || null,
        source: ClientTaskSource.SUBSCRIPTION,
        relatedEntityType: 'UPGRADE_OPPORTUNITY',
        relatedEntityId: id,
      },
    });
    await this.event(opportunity, actor, UpgradeOpportunityEventType.TASK_CREATED, 'Task upgrade creat', task.title, { taskId: task.id });
    return task;
  }

  async createFollowUp(id: string, dto: UpgradeOpportunityFollowUpDto, actor: any) {
    const opportunity = await this.ensureOpportunity(id);
    if (!opportunity.clientAccountId) throw new BadRequestException('Oportunitatea nu are ClientAccount legat.');
    const dueAt = new Date(dto.dueAt);
    const followUp = await this.prisma.clientFollowUp.create({
      data: {
        clientAccountId: opportunity.clientAccountId,
        associationId: opportunity.associationId,
        title: dto.title || `Follow-up upgrade: ${opportunity.title}`,
        dueAt,
        status: ClientFollowUpStatus.OPEN,
        priority: this.clientPriority(opportunity.priority),
        assignedToId: dto.assignedToId || opportunity.assignedToId || null,
        createdById: actor?.id || null,
        source: ClientFollowUpSource.SUBSCRIPTION,
        relatedEntityType: 'UPGRADE_OPPORTUNITY',
        relatedEntityId: id,
      },
    });
    const updated = await this.prisma.upgradeOpportunity.update({ where: { id }, data: { nextFollowUpAt: dueAt, updatedById: actor?.id || null } });
    await this.event(updated, actor, UpgradeOpportunityEventType.FOLLOW_UP_CREATED, 'Follow-up upgrade creat', dueAt.toISOString(), { followUpId: followUp.id });
    return followUp;
  }

  async convert(id: string, dto: ConvertUpgradeOpportunityDto, actor: any) {
    const opportunity = await this.ensureOpportunity(id);
    if (!dto.confirm) throw new BadRequestException('Confirmarea este obligatorie pentru schimbarea controlata a planului.');
    const subscriptionId = opportunity.subscriptionId;
    if (!subscriptionId) {
      const updated = await this.updateStatus(id, { status: UpgradeOpportunityStatus.ACCEPTED, reason: 'Nu exista subscription legat; creeaza schimbarea manual.' }, actor);
      await this.createTask(id, { title: 'Schimba planul manual pentru oportunitatea acceptata' }, actor).catch(() => undefined);
      return { opportunity: updated, planChange: null, message: 'Oportunitatea a fost acceptata. Subscription lipsa, creeaza schimbarea manual.' };
    }
    const planChange = await this.billing.changePlan(actor, subscriptionId, { planId: dto.selectedPlanId, billingCycle: dto.billingCycle, price: dto.price, internalNotes: dto.internalNotes });
    const updated = await this.prisma.upgradeOpportunity.update({ where: { id }, data: { status: UpgradeOpportunityStatus.CONVERTED, recommendedPlanId: dto.selectedPlanId, convertedAt: new Date(), updatedById: actor?.id || null } });
    await this.event(updated, actor, UpgradeOpportunityEventType.OPPORTUNITY_CONVERTED, 'Oportunitate convertita', 'Planul a fost schimbat prin workflow controlat.', { subscriptionId, selectedPlanId: dto.selectedPlanId });
    await this.event(updated, actor, UpgradeOpportunityEventType.SUBSCRIPTION_PLAN_CHANGED_LINKED, 'Plan change legat', subscriptionId, { subscriptionId });
    return { opportunity: updated, planChange };
  }

  async detectAll(actor: any) {
    const subscriptions = await this.prisma.saasSubscription.findMany({
      where: { status: { in: [SaasSubscriptionStatus.ACTIVE, SaasSubscriptionStatus.TRIALING, SaasSubscriptionStatus.PAST_DUE] } },
      include: { plan: true, association: { select: { id: true, name: true, legalName: true, status: true } } },
      take: 250,
    });
    let created = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    const items: any[] = [];
    for (const subscription of subscriptions) {
      const result = await this.detectForAssociation(subscription.associationId, actor);
      created += result.created;
      updated += result.updated;
      skippedDuplicates += result.skippedDuplicates;
      items.push(...result.items);
    }
    return { created, updated, skippedDuplicates, items };
  }

  async detectForAssociation(associationId: string, actor: any) {
    const usage = await this.usage.getAssociationUsage(associationId);
    const subscription = usage.subscription ? await this.prisma.saasSubscription.findUnique({ where: { id: usage.subscription.id }, include: { plan: true, association: true } }) : null;
    if (!subscription) return { created: 0, updated: 0, skippedDuplicates: 0, items: [] };
    const opportunities = await this.buildOpportunitiesFromUsage(subscription as any, usage);
    let created = 0;
    let updated = 0;
    const skippedDuplicates = 0;
    const items: any[] = [];
    for (const input of opportunities) {
      const existing = await this.prisma.upgradeOpportunity.findFirst({
        where: {
          associationId,
          reason: input.reason,
          recommendedPlanId: input.recommendedPlanId || null,
          status: { in: OPEN_OPPORTUNITY_STATUSES },
        },
      });
      if (existing) {
        const saved = await this.prisma.upgradeOpportunity.update({ where: { id: existing.id }, data: { score: input.score, evidence: input.evidence, estimatedMonthlyIncrease: input.estimatedMonthlyIncrease, estimatedAnnualIncrease: input.estimatedAnnualIncrease, updatedById: actor?.id || null } });
        updated++;
        items.push(saved);
        continue;
      }
      const saved = await this.prisma.upgradeOpportunity.create({ data: { ...input, createdById: actor?.id || null } });
      await this.event(saved, actor, UpgradeOpportunityEventType.OPPORTUNITY_CREATED, 'Oportunitate upgrade detectata', saved.title);
      created++;
      items.push(saved);
    }
    return { created, updated, skippedDuplicates, items };
  }

  async clientForecast(clientId: string) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');
    const [forecast, opportunities] = await Promise.all([this.dashboard(), this.listOpportunities({ clientAccountId: clientId })]);
    return { client, forecast: forecast.summary, opportunities: opportunities.items };
  }

  async clientOpportunities(clientId: string) {
    return this.listOpportunities({ clientAccountId: clientId });
  }

  private async calculateForecast(scenario: any) {
    const now = new Date();
    const horizon = scenario?.horizon || RevenueForecastHorizon.DAYS_90;
    const periodEnd = this.periodEnd(now, horizon);
    const assumptions = this.normalizeAssumptions(scenario?.assumptions);
    const [subscriptions, opportunities, collectionCases, clients, snapshots] = await Promise.all([
      this.prisma.saasSubscription.findMany({ where: { status: { in: [SaasSubscriptionStatus.ACTIVE, SaasSubscriptionStatus.TRIALING, SaasSubscriptionStatus.PAST_DUE, SaasSubscriptionStatus.SUSPENDED] } }, include: { plan: true, association: true }, take: 1000 }) as Promise<any[]>,
      this.prisma.upgradeOpportunity.findMany({ where: { status: { in: OPEN_OPPORTUNITY_STATUSES } }, take: 1000 }) as Promise<any[]>,
      this.prisma.revenueCollectionCase.findMany({ where: { status: { in: ['NEEDS_FOLLOW_UP', 'CONTACTED', 'PROMISE_TO_PAY', 'ESCALATED'] as any } }, take: 1000 }) as Promise<any[]>,
      this.prisma.clientAccount.findMany({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] as any } }, take: 1000 }) as Promise<any[]>,
      this.prisma.clientHealthSnapshot.findMany({ orderBy: { calculatedAt: 'desc' }, take: 1000 }).catch(() => [] as any[]),
    ]);
    const active = subscriptions.filter((item) => item.status === SaasSubscriptionStatus.ACTIVE);
    const pastDue = subscriptions.filter((item) => item.status === SaasSubscriptionStatus.PAST_DUE);
    const trialing = subscriptions.filter((item) => item.status === SaasSubscriptionStatus.TRIALING);
    const currentMrr = Math.round(active.reduce((sum, item) => sum + this.monthlyEquivalent(item.price, item.billingCycle), 0));
    const contractedPastDueMrr = Math.round(pastDue.reduce((sum, item) => sum + this.monthlyEquivalent(item.price, item.billingCycle), 0));
    const trialMrr = Math.round(trialing.reduce((sum, item) => sum + this.defaultMonthlyForPlan(item.plan, item.billingCycle), 0));
    const upgradePotential = Math.round(opportunities.reduce((sum, item) => sum + item.estimatedMonthlyIncrease, 0));
    const collectionRecoveryPotential = Math.round(collectionCases.reduce((sum, item) => sum + item.amountDue, 0));
    const atRiskAssociationIds = new Set<string>(clients.map((client) => client.associationId).filter(Boolean));
    for (const snapshot of snapshots) {
      if (['AT_RISK', 'CRITICAL'].includes(snapshot.status) && snapshot.associationId) atRiskAssociationIds.add(snapshot.associationId);
    }
    const churnRiskAmount = Math.round(subscriptions.filter((item) => item.associationId && atRiskAssociationIds.has(item.associationId)).reduce((sum, item) => sum + this.monthlyEquivalent(item.price, item.billingCycle), 0));
    const expectedTrialConversionMrr = Math.round(trialMrr * assumptions.trialConversionRate);
    const expectedUpgradeMrr = Math.round(upgradePotential * assumptions.upgradeConversionRate);
    const expectedChurnLossMrr = Math.round(churnRiskAmount * assumptions.churnRiskLossRate);
    const forecastMrr = Math.max(0, currentMrr + expectedTrialConversionMrr + expectedUpgradeMrr + (assumptions.includePastDue ? contractedPastDueMrr : 0) - expectedChurnLossMrr);
    const byPlan = this.byPlan(subscriptions);
    return {
      periodStart: now,
      periodEnd,
      assumptions,
      current: { mrr: currentMrr, arr: currentMrr * 12, activeSubscriptions: active.length, trialingSubscriptions: trialing.length, pastDueMrr: contractedPastDueMrr },
      forecast: {
        scenario: scenario?.type || RevenueForecastScenarioType.BASE,
        horizon,
        forecastMrr,
        forecastArr: forecastMrr * 12,
        upgradePotential,
        trialConversionPotential: expectedTrialConversionMrr,
        churnRiskAmount,
        collectionRecoveryPotential: Math.round(collectionRecoveryPotential * assumptions.collectionRecoveryRate),
      },
      breakdown: {
        byPlan,
        byOpportunityStatus: this.groupCount(opportunities, 'status'),
        atRiskClients: clients.slice(0, 10),
        collectionRecovery: { gross: collectionRecoveryPotential, expected: Math.round(collectionRecoveryPotential * assumptions.collectionRecoveryRate) },
      },
    };
  }

  private async buildOpportunitiesFromUsage(subscription: any, usage: any) {
    const plans = await this.prisma.saasPlan.findMany({ where: { status: SaasPlanStatus.ACTIVE }, orderBy: { monthlyPrice: 'asc' } });
    const currentPlan = subscription.plan;
    const recommendedPlan = this.recommendNextPlan(currentPlan, plans);
    if (!recommendedPlan || recommendedPlan.id === currentPlan?.id) return [];
    const client = await this.prisma.clientAccount.findFirst({ where: { associationId: subscription.associationId }, orderBy: { updatedAt: 'desc' } });
    const health = client ? await this.prisma.clientHealthSnapshot.findFirst({ where: { clientAccountId: client.id }, orderBy: { calculatedAt: 'desc' } }).catch(() => null) : null;
    const hasOverdue = await this.prisma.revenueCollectionCase.count({ where: { associationId: subscription.associationId, status: { in: ['NEEDS_FOLLOW_UP', 'CONTACTED', 'PROMISE_TO_PAY', 'ESCALATED'] as any }, daysOverdue: { gt: 0 } } });
    const inputs: any[] = [];
    for (const limit of usage.limits || []) {
      if (!['NEAR_LIMIT', 'OVER_LIMIT'].includes(limit.status)) continue;
      const reason = this.reasonForLimit(limit.limitKey, limit.status);
      const currentMonthlyValue = this.monthlyEquivalent(subscription.price, subscription.billingCycle);
      const recommendedMonthlyValue = this.defaultMonthlyForPlan(recommendedPlan, subscription.billingCycle);
      const overLimit = limit.status === 'OVER_LIMIT';
      const nearLimit = limit.status === 'NEAR_LIMIT';
      const score = this.calculateOpportunityScore({ reason, healthy: !['AT_RISK', 'CRITICAL'].includes(String(health?.status || '')), overdue: hasOverdue > 0, overLimit, nearLimit });
      inputs.push({
        associationId: subscription.associationId,
        clientAccountId: client?.id || null,
        subscriptionId: subscription.id,
        currentPlanId: currentPlan?.id || null,
        recommendedPlanId: recommendedPlan.id,
        reason,
        priority: score >= 80 ? UpgradeOpportunityPriority.HIGH : score >= 50 ? UpgradeOpportunityPriority.NORMAL : UpgradeOpportunityPriority.LOW,
        score,
        title: `${subscription.association?.name || client?.displayName || 'Client'} ${overLimit ? 'a depasit' : 'se apropie de'} limita ${limit.label}`,
        description: `Plan recomandat: ${recommendedPlan.name}.`,
        currentMonthlyValue,
        recommendedMonthlyValue,
        estimatedMonthlyIncrease: Math.max(0, recommendedMonthlyValue - currentMonthlyValue),
        estimatedAnnualIncrease: Math.max(0, recommendedMonthlyValue - currentMonthlyValue) * 12,
        currency: subscription.currency || BillingCurrency.MDL,
        evidence: { limit, healthStatus: health?.status || null, hasOverdueCollections: hasOverdue > 0 } as Prisma.InputJsonValue,
        recommendedActions: this.recommendedActions(reason) as Prisma.InputJsonValue,
      });
    }
    const requestedUpgrade = await this.prisma.saasUpgradeRequest.findFirst({ where: { associationId: subscription.associationId, status: { in: ['PENDING', 'APPROVED'] as any } }, orderBy: { createdAt: 'desc' } });
    if (requestedUpgrade) {
      const recommended = requestedUpgrade.requestedPlanId ? plans.find((plan) => plan.id === requestedUpgrade.requestedPlanId) || recommendedPlan : recommendedPlan;
      const currentMonthlyValue = this.monthlyEquivalent(subscription.price, subscription.billingCycle);
      const recommendedMonthlyValue = this.defaultMonthlyForPlan(recommended, subscription.billingCycle);
      inputs.push({
        associationId: subscription.associationId,
        clientAccountId: client?.id || null,
        subscriptionId: subscription.id,
        currentPlanId: currentPlan?.id || null,
        recommendedPlanId: recommended.id,
        reason: UpgradeOpportunityReason.CUSTOMER_REQUESTED_UPGRADE,
        priority: UpgradeOpportunityPriority.HIGH,
        score: this.calculateOpportunityScore({ reason: UpgradeOpportunityReason.CUSTOMER_REQUESTED_UPGRADE, healthy: true, overdue: hasOverdue > 0, overLimit: false, nearLimit: false }),
        title: `${subscription.association?.name || 'Client'} a cerut upgrade`,
        description: requestedUpgrade.message || 'Upgrade request existent.',
        currentMonthlyValue,
        recommendedMonthlyValue,
        estimatedMonthlyIncrease: Math.max(0, recommendedMonthlyValue - currentMonthlyValue),
        estimatedAnnualIncrease: Math.max(0, recommendedMonthlyValue - currentMonthlyValue) * 12,
        currency: subscription.currency || BillingCurrency.MDL,
        evidence: { upgradeRequestId: requestedUpgrade.id, status: requestedUpgrade.status } as Prisma.InputJsonValue,
        recommendedActions: this.recommendedActions(UpgradeOpportunityReason.CUSTOMER_REQUESTED_UPGRADE) as Prisma.InputJsonValue,
      });
    }
    return inputs;
  }

  private calculateOpportunityScore(input: { reason: UpgradeOpportunityReason; healthy: boolean; overdue: boolean; overLimit: boolean; nearLimit: boolean }) {
    let score = 20;
    if (input.overLimit) score += 35;
    if (input.nearLimit) score += 20;
    if (String(input.reason).startsWith('FEATURE_NEEDED')) score += 25;
    if (input.reason === UpgradeOpportunityReason.CUSTOMER_REQUESTED_UPGRADE) score += 30;
    if (input.reason === UpgradeOpportunityReason.MULTIPLE_APC_POTENTIAL) score += 25;
    if (input.healthy) score += 15;
    if (input.overdue) score -= 25;
    return Math.max(0, Math.min(100, score));
  }

  private reasonForLimit(limitKey: string, status: string) {
    const over = status === 'OVER_LIMIT';
    if (limitKey === 'maxApartments') return over ? UpgradeOpportunityReason.OVER_APARTMENT_LIMIT : UpgradeOpportunityReason.NEAR_APARTMENT_LIMIT;
    if (limitKey === 'maxResidents') return over ? UpgradeOpportunityReason.OVER_RESIDENT_LIMIT : UpgradeOpportunityReason.NEAR_RESIDENT_LIMIT;
    if (limitKey === 'maxStaffMembers') return over ? UpgradeOpportunityReason.OVER_STAFF_LIMIT : UpgradeOpportunityReason.NEAR_STAFF_LIMIT;
    if (limitKey === 'maxMeters') return over ? UpgradeOpportunityReason.OVER_METER_LIMIT : UpgradeOpportunityReason.NEAR_METER_LIMIT;
    if (limitKey === 'maxInvoicesPerMonth') return UpgradeOpportunityReason.HIGH_INVOICE_VOLUME;
    if (limitKey === 'maxAnnouncementsPerMonth') return UpgradeOpportunityReason.HIGH_ANNOUNCEMENT_VOLUME;
    if (limitKey === 'maxRequestsPerMonth') return UpgradeOpportunityReason.HIGH_REQUEST_VOLUME;
    return UpgradeOpportunityReason.PLAN_MISMATCH;
  }

  private recommendNextPlan(currentPlan: any, plans: any[]) {
    if (!plans.length) return null;
    if (!currentPlan) return plans[0];
    return plans.find((plan) => plan.monthlyPrice > Number(currentPlan.monthlyPrice || 0)) || plans[plans.length - 1];
  }

  private recommendedActions(reason: UpgradeOpportunityReason) {
    if (reason === UpgradeOpportunityReason.CUSTOMER_REQUESTED_UPGRADE) return [{ title: 'Califica cererea de upgrade' }, { title: 'Trimite propunerea de plan' }];
    if (String(reason).includes('LIMIT')) return [{ title: 'Verifica usage vs limits' }, { title: 'Programeaza discutie de upgrade' }];
    return [{ title: 'Califica oportunitatea' }, { title: 'Creeaza follow-up comercial' }];
  }

  private async ensureDefaultScenarios() {
    for (const item of DEFAULT_SCENARIOS) {
      const existing = await this.prisma.revenueForecastScenario.findFirst({ where: { type: item.type, name: item.name } });
      if (!existing) {
        await this.prisma.revenueForecastScenario.create({ data: { name: item.name, type: item.type, status: RevenueForecastScenarioStatus.ACTIVE, horizon: RevenueForecastHorizon.DAYS_90, assumptions: item.assumptions as Prisma.InputJsonValue, createdById: 'system' } });
      }
    }
  }

  private async getScenarioForQuery(query: Query) {
    await this.ensureDefaultScenarios();
    if (query.scenarioId) return this.ensureScenario(query.scenarioId);
    const type = (query.type as RevenueForecastScenarioType) || RevenueForecastScenarioType.BASE;
    return this.prisma.revenueForecastScenario.findFirst({ where: { type, status: RevenueForecastScenarioStatus.ACTIVE }, orderBy: { updatedAt: 'desc' } });
  }

  private async ensureScenario(id: string) {
    const scenario = await this.prisma.revenueForecastScenario.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundException('Forecast scenario not found');
    return scenario;
  }

  private async ensureOpportunity(id: string) {
    const opportunity = await this.prisma.upgradeOpportunity.findUnique({ where: { id } });
    if (!opportunity) throw new NotFoundException('Upgrade opportunity not found');
    return opportunity;
  }

  private normalizeAssumptions(value: unknown): Assumptions {
    const data = (value && typeof value === 'object' ? value : {}) as Partial<Assumptions>;
    return {
      trialConversionRate: this.rate(data.trialConversionRate, 0.5),
      upgradeConversionRate: this.rate(data.upgradeConversionRate, 0.25),
      collectionRecoveryRate: this.rate(data.collectionRecoveryRate, 0.6),
      churnRiskLossRate: this.rate(data.churnRiskLossRate, 0.3),
      includePastDue: data.includePastDue === true,
      includeSuspended: data.includeSuspended === true,
      includeTrialing: data.includeTrialing !== false,
    };
  }

  private assumptionsFromDto(dto: Partial<RevenueForecastScenarioDto>) {
    return {
      trialConversionRate: this.rate(dto.trialConversionRate, dto.type === RevenueForecastScenarioType.CONSERVATIVE ? 0.25 : dto.type === RevenueForecastScenarioType.OPTIMISTIC ? 0.75 : 0.5),
      upgradeConversionRate: this.rate(dto.upgradeConversionRate, dto.type === RevenueForecastScenarioType.CONSERVATIVE ? 0.15 : dto.type === RevenueForecastScenarioType.OPTIMISTIC ? 0.4 : 0.25),
      collectionRecoveryRate: this.rate(dto.collectionRecoveryRate, dto.type === RevenueForecastScenarioType.CONSERVATIVE ? 0.35 : dto.type === RevenueForecastScenarioType.OPTIMISTIC ? 0.8 : 0.6),
      churnRiskLossRate: this.rate(dto.churnRiskLossRate, dto.type === RevenueForecastScenarioType.CONSERVATIVE ? 0.5 : dto.type === RevenueForecastScenarioType.OPTIMISTIC ? 0.15 : 0.3),
    };
  }

  private rate(value: unknown, fallback: number) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
  }

  private forecastTypeForScenario(type?: RevenueForecastScenarioType) {
    if (type === RevenueForecastScenarioType.CONSERVATIVE) return RevenueForecastType.CONSERVATIVE;
    if (type === RevenueForecastScenarioType.OPTIMISTIC) return RevenueForecastType.OPTIMISTIC;
    return RevenueForecastType.BASE;
  }

  private periodEnd(start: Date, horizon: RevenueForecastHorizon) {
    const days = horizon === RevenueForecastHorizon.DAYS_30 ? 30 : horizon === RevenueForecastHorizon.DAYS_60 ? 60 : horizon === RevenueForecastHorizon.MONTHS_6 ? 183 : horizon === RevenueForecastHorizon.MONTHS_12 ? 365 : 90;
    return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private monthlyEquivalent(price: number, billingCycle: SaasBillingCycle | string) {
    return String(billingCycle) === SaasBillingCycle.YEARLY ? Number(price || 0) / 12 : Number(price || 0);
  }

  private defaultMonthlyForPlan(plan: any, billingCycle?: SaasBillingCycle | string) {
    if (!plan) return 0;
    if (String(billingCycle) === SaasBillingCycle.YEARLY && plan.yearlyPrice) return Number(plan.yearlyPrice || 0) / 12;
    return Number(plan.monthlyPrice || 0);
  }

  private byPlan(subscriptions: any[]) {
    const map = new Map<string, any>();
    for (const subscription of subscriptions) {
      const key = subscription.plan?.code || subscription.planId || 'UNKNOWN';
      const row = map.get(key) || { planCode: key, planName: subscription.plan?.name || key, subscriptions: 0, active: 0, trialing: 0, mrr: 0 };
      row.subscriptions++;
      if (subscription.status === SaasSubscriptionStatus.ACTIVE) {
        row.active++;
        row.mrr += this.monthlyEquivalent(subscription.price, subscription.billingCycle);
      }
      if (subscription.status === SaasSubscriptionStatus.TRIALING) row.trialing++;
      map.set(key, row);
    }
    return Array.from(map.values()).map((row) => ({ ...row, mrr: Math.round(row.mrr) }));
  }

  private groupCount(items: any[], field: string) {
    const map = new Map<string, number>();
    for (const item of items) map.set(String(item[field] || 'UNKNOWN'), (map.get(String(item[field] || 'UNKNOWN')) || 0) + 1);
    return Array.from(map.entries()).map(([key, count]) => ({ key, count }));
  }

  private clientPriority(priority: UpgradeOpportunityPriority) {
    if (priority === UpgradeOpportunityPriority.URGENT) return ClientPriority.URGENT;
    if (priority === UpgradeOpportunityPriority.HIGH) return ClientPriority.HIGH;
    if (priority === UpgradeOpportunityPriority.LOW) return ClientPriority.LOW;
    return ClientPriority.NORMAL;
  }

  private eventTypeForStatus(status: UpgradeOpportunityStatus) {
    if (status === UpgradeOpportunityStatus.QUALIFIED) return UpgradeOpportunityEventType.OPPORTUNITY_QUALIFIED;
    if (status === UpgradeOpportunityStatus.PROPOSAL_SENT) return UpgradeOpportunityEventType.PROPOSAL_SENT;
    if (status === UpgradeOpportunityStatus.ACCEPTED) return UpgradeOpportunityEventType.OPPORTUNITY_ACCEPTED;
    if (status === UpgradeOpportunityStatus.REJECTED) return UpgradeOpportunityEventType.OPPORTUNITY_REJECTED;
    if (status === UpgradeOpportunityStatus.LOST) return UpgradeOpportunityEventType.OPPORTUNITY_LOST;
    if (status === UpgradeOpportunityStatus.DISMISSED) return UpgradeOpportunityEventType.OPPORTUNITY_DISMISSED;
    if (status === UpgradeOpportunityStatus.CONVERTED) return UpgradeOpportunityEventType.OPPORTUNITY_CONVERTED;
    return UpgradeOpportunityEventType.OPPORTUNITY_STATUS_CHANGED;
  }

  private async event(opportunity: any, actor: any, eventType: UpgradeOpportunityEventType, title: string, message: string, metadata?: unknown) {
    return this.prisma.upgradeOpportunityEvent.create({
      data: {
        opportunityId: opportunity.id,
        associationId: opportunity.associationId,
        clientAccountId: opportunity.clientAccountId || null,
        actorUserId: actor?.id || null,
        eventType,
        title,
        message,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
