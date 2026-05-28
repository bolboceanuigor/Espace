import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientFollowUpStatus,
  ClientHealthStatus,
  ClientInterventionStatus,
  ClientLifecycleStage,
  ClientTaskStatus,
  CustomerSuccessMetricGranularity,
  CustomerSuccessReportExportFormat,
  CustomerSuccessReportExportStatus,
  CustomerSuccessReportPeriod,
  CustomerSuccessReportType,
  Prisma,
  SaasInvoiceStatus,
  SaasSubscriptionStatus,
  SavedCustomerReportStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExportCustomerReportDto, SaveCustomerReportDto, SaveMetricSnapshotDto, UpdateSavedCustomerReportDto } from './dto/customer-success-reports.dto';

type ReportFilters = Record<string, string | undefined>;

@Injectable()
export class CustomerSuccessAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: ReportFilters) {
    return this.getPortfolioOverview(query);
  }

  async getPortfolioOverview(query: ReportFilters = {}) {
    const now = new Date();
    const [clients, health, onboarding, revenue, followUps, tasks, playbooks, overdueInvoices, atRiskClients] = await Promise.all([
      this.prisma.clientAccount.count({ where: this.clientWhere(query) }),
      this.getHealthDistribution(query),
      this.getOnboardingReport(query),
      this.getRevenueEstimate(query),
      this.prisma.clientFollowUp.count({ where: { status: ClientFollowUpStatus.OPEN, dueAt: { lt: now } } }),
      this.prisma.clientTask.count({ where: { status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: now } } }),
      this.getPlaybookPerformance(query),
      this.prisma.saasInvoice.findMany({ where: this.overdueInvoiceWhere(), include: { association: { select: { id: true, name: true } }, plan: { select: { name: true, code: true } } }, orderBy: { dueDate: 'asc' }, take: 10 }),
      this.getChurnRiskReport({ ...query, limit: '10' }),
    ]);
    const lifecycleDistribution = onboarding.lifecycleDistribution;
    return {
      summary: {
        totalClients: clients,
        activeClients: lifecycleDistribution.find((item: any) => item.stage === ClientLifecycleStage.ACTIVE)?.count || 0,
        onboardingClients: lifecycleDistribution.filter((item: any) => ['PREPARING_ONBOARDING', 'ONBOARDING', 'READY_TO_ACTIVATE'].includes(item.stage)).reduce((sum: number, item: any) => sum + item.count, 0),
        atRiskClients: (health.distribution.find((item: any) => item.status === ClientHealthStatus.AT_RISK)?.count || 0),
        criticalClients: (health.distribution.find((item: any) => item.status === ClientHealthStatus.CRITICAL)?.count || 0),
        trialEndingSoon: revenue.summary.trialEndingSoon,
        overdueSaasInvoices: revenue.summary.overdueInvoices,
        overdueFollowUps: followUps,
        overdueTasks: tasks,
        estimatedMrr: revenue.summary.estimatedMrr,
        estimatedArr: revenue.summary.estimatedArr,
        activePlans: revenue.byPlan.length,
        currency: revenue.summary.currency,
      },
      healthDistribution: health.distribution,
      lifecycleDistribution,
      topRiskReasons: health.topRiskReasons,
      atRiskClients: atRiskClients.items,
      overdueSaasInvoices: overdueInvoices,
      overdueFollowUps: (await this.getFollowUpPerformance(query)).overdueItems,
      playbookPerformance: playbooks.items.slice(0, 8),
      revenueEstimate: revenue.summary,
    };
  }

  async getHealthDistribution(query: ReportFilters = {}) {
    const clients = await this.prisma.clientAccount.findMany({ where: this.clientWhere(query), select: { id: true, displayName: true, associationCode: true, lifecycleStage: true, ownerUserId: true } });
    const snapshots = await this.prisma.clientHealthSnapshot.findMany({ where: { clientAccountId: { in: clients.map((item) => item.id) } }, orderBy: { calculatedAt: 'desc' } });
    const latest = this.latestSnapshots(snapshots);
    const distribution = Object.values(ClientHealthStatus).map((status) => ({ status, count: 0 }));
    const riskCounter = new Map<string, number>();
    const rows = clients.map((client) => {
      const snapshot = latest.get(client.id);
      const status = snapshot?.status || ClientHealthStatus.UNKNOWN;
      const bucket = distribution.find((item) => item.status === status);
      if (bucket) bucket.count++;
      const reasons = Array.isArray(snapshot?.riskReasons) ? snapshot?.riskReasons as any[] : [];
      reasons.forEach((reason) => {
        const key = reason?.key || reason;
        if (key) riskCounter.set(String(key), (riskCounter.get(String(key)) || 0) + 1);
      });
      return { ...client, healthScore: snapshot?.overallScore ?? null, healthStatus: status, riskReasons: reasons, lastCalculatedAt: snapshot?.calculatedAt || null };
    }).filter((item) => !query.healthStatus || String(query.healthStatus).split(',').includes(item.healthStatus));
    const scores = rows.map((item) => item.healthScore).filter((value): value is number => typeof value === 'number');
    const averageScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
    const sorted = [...scores].sort((a, b) => a - b);
    const medianScore = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const topRiskReasons = Array.from(riskCounter.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([key, count]) => ({ key, count }));
    return {
      summary: { totalClients: clients.length, averageScore, medianScore, withoutSnapshot: clients.length - latest.size },
      distribution,
      topRiskReasons,
      items: rows.sort((a, b) => (a.healthScore || 0) - (b.healthScore || 0)).slice(0, 200),
      trends: await this.getHealthTrends(query),
    };
  }

  async getHealthTrends(query: ReportFilters = {}) {
    const range = this.periodRange(query);
    const snapshots = await this.prisma.clientHealthSnapshot.findMany({ where: { calculatedAt: { gte: range.start, lte: range.end } }, orderBy: { calculatedAt: 'asc' }, take: 2000 });
    if (!snapshots.length) return { items: [], message: 'Trendurile vor aparea dupa mai multe recalculari de health score.' };
    const buckets = new Map<string, { date: string; total: number; count: number; atRisk: number; critical: number }>();
    for (const snapshot of snapshots) {
      const key = snapshot.calculatedAt.toISOString().slice(0, 10);
      const row = buckets.get(key) || { date: key, total: 0, count: 0, atRisk: 0, critical: 0 };
      row.total += snapshot.overallScore;
      row.count++;
      if (snapshot.status === ClientHealthStatus.AT_RISK) row.atRisk++;
      if (snapshot.status === ClientHealthStatus.CRITICAL) row.critical++;
      buckets.set(key, row);
    }
    return { items: Array.from(buckets.values()).map((item) => ({ ...item, averageScore: Math.round(item.total / item.count) })) };
  }

  async getOnboardingReport(query: ReportFilters = {}) {
    const clients = await this.prisma.clientAccount.findMany({ where: this.clientWhere(query), orderBy: { updatedAt: 'desc' }, take: 1000 });
    const lifecycleDistribution = Object.values(ClientLifecycleStage).map((stage) => ({ stage, count: clients.filter((client) => client.lifecycleStage === stage).length }));
    const onboarding = clients.filter((client) => ['PREPARING_ONBOARDING', 'ONBOARDING', 'READY_TO_ACTIVATE'].includes(client.lifecycleStage));
    const now = Date.now();
    const stuck = onboarding.filter((client) => client.onboardingStartedAt && now - client.onboardingStartedAt.getTime() > 21 * 24 * 60 * 60 * 1000);
    const averageDays = onboarding.length ? Math.round(onboarding.reduce((sum, client) => sum + this.daysBetween(client.onboardingStartedAt || client.createdAt, new Date()), 0) / onboarding.length) : 0;
    return {
      summary: {
        onboarding: onboarding.length,
        stuck: stuck.length,
        readyToActivate: clients.filter((client) => client.lifecycleStage === ClientLifecycleStage.READY_TO_ACTIVATE).length,
        noOwner: clients.filter((client) => !client.ownerUserId).length,
        noFollowUp: clients.filter((client) => !client.nextFollowUpAt).length,
        averageDaysInOnboarding: averageDays,
      },
      lifecycleDistribution,
      stuckClients: stuck.slice(0, 50),
      noAssociationLinked: clients.filter((client) => !client.associationId).slice(0, 50),
      readyToActivate: clients.filter((client) => client.lifecycleStage === ClientLifecycleStage.READY_TO_ACTIVATE).slice(0, 50),
    };
  }

  async getRevenueEstimate(query: ReportFilters = {}) {
    const now = new Date();
    const [subscriptions, invoices] = await Promise.all([
      this.prisma.saasSubscription.findMany({ include: { plan: true, association: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 1000 }) as Promise<any[]>,
      this.prisma.saasInvoice.findMany({ include: { association: { select: { id: true, name: true } }, plan: true }, orderBy: { dueDate: 'asc' }, take: 1000 }),
    ]);
    const active = subscriptions.filter((item) => item.status === SaasSubscriptionStatus.ACTIVE);
    const estimatedMrr = Math.round(active.reduce((sum, item) => sum + this.monthlyEquivalent(item.price, String(item.billingCycle)), 0));
    const byPlanMap = new Map<string, any>();
    for (const subscription of active) {
      const key = subscription.plan?.code || subscription.planId;
      const row = byPlanMap.get(key) || { planCode: subscription.plan?.code || key, planName: subscription.plan?.name || key, clients: 0, estimatedMrr: 0 };
      row.clients++;
      row.estimatedMrr += this.monthlyEquivalent(subscription.price, String(subscription.billingCycle));
      byPlanMap.set(key, row);
    }
    const closedInvoiceStatuses: SaasInvoiceStatus[] = [SaasInvoiceStatus.CANCELLED, SaasInvoiceStatus.VOID];
    const openInvoices = invoices.filter((invoice) => invoice.balanceAmount > 0 && !closedInvoiceStatuses.includes(invoice.status));
    const overdueInvoices = openInvoices.filter((invoice) => invoice.dueDate < now);
    const paidThisMonth = invoices.filter((invoice) => invoice.status === SaasInvoiceStatus.PAID && invoice.paidAt && invoice.paidAt >= new Date(now.getFullYear(), now.getMonth(), 1));
    return {
      summary: {
        estimatedMrr,
        estimatedArr: estimatedMrr * 12,
        activeSubscriptions: active.length,
        trialing: subscriptions.filter((item) => item.status === SaasSubscriptionStatus.TRIALING).length,
        suspended: subscriptions.filter((item) => item.status === SaasSubscriptionStatus.SUSPENDED).length,
        cancelled: subscriptions.filter((item) => item.status === SaasSubscriptionStatus.CANCELLED).length,
        trialEndingSoon: subscriptions.filter((item) => item.status === SaasSubscriptionStatus.TRIALING && item.trialEndsAt && item.trialEndsAt <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
        outstandingBalance: Math.round(openInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0)),
        overdueBalance: Math.round(overdueInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0)),
        overdueInvoices: overdueInvoices.length,
        paidThisMonth: Math.round(paidThisMonth.reduce((sum, invoice) => sum + invoice.paidAmount, 0)),
        currency: 'MDL',
        note: 'Venit estimat, nu raport contabil fiscal.',
      },
      byPlan: Array.from(byPlanMap.values()).map((row) => ({ ...row, estimatedMrr: Math.round(row.estimatedMrr) })),
      overdueInvoices: overdueInvoices.slice(0, 100),
      invoicesByStatus: this.countBy(invoices, 'status'),
    };
  }

  async getSaasInvoicesReport(query: ReportFilters = {}) {
    const revenue = await this.getRevenueEstimate(query);
    return { summary: revenue.summary, invoicesByStatus: revenue.invoicesByStatus, overdueInvoices: revenue.overdueInvoices, byPlan: revenue.byPlan };
  }

  async getFollowUpPerformance(query: ReportFilters = {}) {
    const now = new Date();
    const [followUps, tasks] = await Promise.all([
      this.prisma.clientFollowUp.findMany({ include: { clientAccount: { select: { id: true, displayName: true, ownerUserId: true } } }, orderBy: { dueAt: 'desc' }, take: 1000 }),
      this.prisma.clientTask.findMany({ include: { clientAccount: { select: { id: true, displayName: true, ownerUserId: true } } }, orderBy: { dueAt: 'desc' }, take: 1000 }),
    ]);
    const completed = followUps.filter((item) => item.status === ClientFollowUpStatus.DONE);
    const overdue = followUps.filter((item) => item.status === ClientFollowUpStatus.OPEN && item.dueAt < now);
    const byOwner = new Map<string, any>();
    for (const item of followUps) {
      const owner = item.assignedToId || item.clientAccount?.ownerUserId || 'UNASSIGNED';
      const row = byOwner.get(owner) || { ownerUserId: owner, open: 0, completed: 0, overdue: 0, total: 0, completionRate: 0, averageDelayDays: 0 };
      row.total++;
      if (item.status === ClientFollowUpStatus.DONE) row.completed++;
      if (item.status === ClientFollowUpStatus.OPEN) row.open++;
      if (item.status === ClientFollowUpStatus.OPEN && item.dueAt < now) row.overdue++;
      byOwner.set(owner, row);
    }
    const ownerRows = Array.from(byOwner.values()).map((row) => ({ ...row, completionRate: row.total ? Math.round((row.completed / row.total) * 1000) / 10 : 0 }));
    const completedTasks = tasks.filter((item) => item.status === ClientTaskStatus.COMPLETED);
    const openTaskStatuses: ClientTaskStatus[] = [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS];
    const overdueTasks = tasks.filter((item) => openTaskStatuses.includes(item.status) && item.dueAt && item.dueAt < now);
    return {
      summary: {
        totalFollowUps: followUps.length,
        completedFollowUps: completed.length,
        overdueFollowUps: overdue.length,
        missedFollowUps: followUps.filter((item) => item.status === ClientFollowUpStatus.MISSED).length,
        completionRate: followUps.length ? Math.round((completed.length / followUps.length) * 1000) / 10 : 0,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        taskCompletionRate: tasks.length ? Math.round((completedTasks.length / tasks.length) * 1000) / 10 : 0,
      },
      byOwner: ownerRows,
      overdueItems: overdue.slice(0, 50),
      taskSummary: { byCategory: this.countBy(tasks, 'category'), byOwner: this.countBy(tasks.map((task) => ({ owner: task.assignedToId || task.clientAccount?.ownerUserId || 'UNASSIGNED' })), 'owner') },
      overdueTasks: overdueTasks.slice(0, 50),
    };
  }

  async getTaskPerformance(query: ReportFilters = {}) {
    const followUps = await this.getFollowUpPerformance(query);
    return { summary: { totalTasks: followUps.summary.totalTasks, completedTasks: followUps.summary.completedTasks, overdueTasks: followUps.summary.overdueTasks, completionRate: followUps.summary.taskCompletionRate }, byCategory: followUps.taskSummary.byCategory, byOwner: followUps.taskSummary.byOwner, overdueTasks: followUps.overdueTasks };
  }

  async getPlaybookPerformance(query: ReportFilters = {}) {
    const playbooks = await this.prisma.customerSuccessPlaybook.findMany({ include: { interventions: true, steps: true }, orderBy: { updatedAt: 'desc' }, take: 200 });
    const items = playbooks.map((playbook) => {
      const started = playbook.interventions.length;
      const completed = playbook.interventions.filter((item) => item.status === ClientInterventionStatus.COMPLETED).length;
      const cancelled = playbook.interventions.filter((item) => item.status === ClientInterventionStatus.CANCELLED).length;
      const activeInterventionStatuses: ClientInterventionStatus[] = [ClientInterventionStatus.OPEN, ClientInterventionStatus.IN_PROGRESS, ClientInterventionStatus.WAITING_CLIENT, ClientInterventionStatus.WAITING_INTERNAL];
      const active = playbook.interventions.filter((item) => activeInterventionStatuses.includes(item.status)).length;
      const durations = playbook.interventions.filter((item) => item.completedAt).map((item) => this.daysBetween(item.startedAt, item.completedAt!) * 24);
      return {
        playbookId: playbook.id,
        name: playbook.name,
        category: playbook.category,
        status: playbook.status,
        steps: playbook.steps.length,
        started,
        completed,
        cancelled,
        active,
        completionRate: started ? Math.round((completed / started) * 1000) / 10 : 0,
        averageCompletionHours: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
      };
    });
    return {
      summary: {
        activePlaybooks: playbooks.filter((item) => item.status === 'ACTIVE').length,
        interventionsStarted: items.reduce((sum, item) => sum + item.started, 0),
        interventionsCompleted: items.reduce((sum, item) => sum + item.completed, 0),
        interventionsCancelled: items.reduce((sum, item) => sum + item.cancelled, 0),
        activeInterventions: items.reduce((sum, item) => sum + item.active, 0),
        averageCompletionHours: Math.round(items.filter((item) => item.averageCompletionHours).reduce((sum, item) => sum + Number(item.averageCompletionHours), 0) / Math.max(1, items.filter((item) => item.averageCompletionHours).length)),
      },
      items: items.sort((a, b) => b.started - a.started),
    };
  }

  async getUsageByPlan(query: ReportFilters = {}) {
    const subscriptions = await this.prisma.saasSubscription.findMany({ include: { plan: true, association: { select: { id: true, name: true } } }, take: 1000 }) as any[];
    const clients = await this.prisma.clientAccount.findMany({ where: { associationId: { in: subscriptions.map((item) => item.associationId) } }, take: 1000 });
    const clientByAssociation = new Map(clients.map((client) => [client.associationId, client]));
    const map = new Map<string, any>();
    for (const subscription of subscriptions) {
      const key = subscription.plan?.code || subscription.planId;
      const row = map.get(key) || { planCode: subscription.plan?.code || key, planName: subscription.plan?.name || key, subscriptions: 0, active: 0, trialing: 0, suspended: 0, apartments: 0, clients: [] };
      const client = clientByAssociation.get(subscription.associationId);
      row.subscriptions++;
      if (subscription.status === SaasSubscriptionStatus.ACTIVE) row.active++;
      if (subscription.status === SaasSubscriptionStatus.TRIALING) row.trialing++;
      if (subscription.status === SaasSubscriptionStatus.SUSPENDED) row.suspended++;
      row.apartments += client?.apartmentsCount || 0;
      row.clients.push({ associationId: subscription.associationId, associationName: subscription.association.name, associationCode: client?.associationCode || null, status: subscription.status, apartmentsCount: client?.apartmentsCount || 0 });
      map.set(key, row);
    }
    const items = Array.from(map.values()).map((row) => ({ ...row, averageApartments: row.subscriptions ? Math.round(row.apartments / row.subscriptions) : 0 }));
    return { summary: { plans: items.length, subscriptions: subscriptions.length, active: subscriptions.filter((item) => item.status === SaasSubscriptionStatus.ACTIVE).length }, items };
  }

  async getChurnRiskReport(query: ReportFilters = {}) {
    const health = await this.getHealthDistribution(query);
    const followUps = await this.getFollowUpPerformance(query);
    const revenue = await this.getRevenueEstimate(query);
    const items = health.items.filter((item: any) => ['NEEDS_ATTENTION', 'AT_RISK', 'CRITICAL'].includes(item.healthStatus) || !item.ownerUserId).slice(0, Number(query.limit || 100));
    return {
      summary: {
        atRiskClients: health.distribution.find((item: any) => item.status === ClientHealthStatus.AT_RISK)?.count || 0,
        criticalClients: health.distribution.find((item: any) => item.status === ClientHealthStatus.CRITICAL)?.count || 0,
        highChurnRisk: items.filter((item: any) => ['AT_RISK', 'CRITICAL'].includes(item.healthStatus)).length,
        noOwner: items.filter((item: any) => !item.ownerUserId).length,
        overdueInvoices: revenue.summary.overdueInvoices,
        overdueFollowUps: followUps.summary.overdueFollowUps,
      },
      items,
      topRiskReasons: health.topRiskReasons,
      overdueFollowUps: followUps.overdueItems,
      overdueInvoices: revenue.overdueInvoices,
    };
  }

  async getOwnerPerformance(query: ReportFilters = {}) {
    const [clients, followUps, tasks] = await Promise.all([
      this.prisma.clientAccount.findMany({ where: this.clientWhere(query), take: 1000 }),
      this.prisma.clientFollowUp.findMany({ take: 1000 }),
      this.prisma.clientTask.findMany({ take: 1000 }),
    ]);
    const owners = new Map<string, any>();
    for (const client of clients) {
      const key = client.ownerUserId || 'UNASSIGNED';
      const row = owners.get(key) || { ownerUserId: key, clients: 0, activeClients: 0, atRiskClients: 0, overdueFollowUps: 0, completedTasks: 0 };
      row.clients++;
      if (client.lifecycleStage === ClientLifecycleStage.ACTIVE) row.activeClients++;
      owners.set(key, row);
    }
    for (const followUp of followUps) {
      const key = followUp.assignedToId || 'UNASSIGNED';
      const row = owners.get(key) || { ownerUserId: key, clients: 0, activeClients: 0, atRiskClients: 0, overdueFollowUps: 0, completedTasks: 0 };
      if (followUp.status === ClientFollowUpStatus.OPEN && followUp.dueAt < new Date()) row.overdueFollowUps++;
      owners.set(key, row);
    }
    for (const task of tasks) {
      const key = task.assignedToId || 'UNASSIGNED';
      const row = owners.get(key) || { ownerUserId: key, clients: 0, activeClients: 0, atRiskClients: 0, overdueFollowUps: 0, completedTasks: 0 };
      if (task.status === ClientTaskStatus.COMPLETED) row.completedTasks++;
      owners.set(key, row);
    }
    return { items: Array.from(owners.values()).sort((a, b) => b.clients - a.clients) };
  }

  async snapshots(query: ReportFilters) {
    const items = await this.prisma.customerSuccessMetricSnapshot.findMany({ where: { ...(query.reportType ? { reportType: query.reportType as CustomerSuccessReportType } : {}) }, orderBy: { generatedAt: 'desc' }, take: 100 });
    return { items };
  }

  async snapshot(id: string) {
    const item = await this.prisma.customerSuccessMetricSnapshot.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Snapshot not found');
    return item;
  }

  async saveSnapshot(dto: SaveMetricSnapshotDto, actor: any) {
    const filters = this.filtersFromDto(dto.filters || {}, dto.period);
    const metrics = await this.reportByType(dto.reportType, filters);
    const range = this.periodRange(filters);
    return this.prisma.customerSuccessMetricSnapshot.create({
      data: {
        reportType: dto.reportType,
        period: dto.period || CustomerSuccessReportPeriod.CUSTOM,
        periodStart: range.start,
        periodEnd: range.end,
        granularity: dto.granularity || CustomerSuccessMetricGranularity.WEEKLY,
        metrics: metrics as Prisma.InputJsonValue,
        filters: filters as Prisma.InputJsonValue,
        generatedById: actor?.id || null,
      },
    });
  }

  async savedReports(query: ReportFilters) {
    const search = query.search?.trim();
    const items = await this.prisma.savedCustomerSuccessReport.findMany({
      where: {
        status: query.status === 'ARCHIVED' ? SavedCustomerReportStatus.ARCHIVED : SavedCustomerReportStatus.ACTIVE,
        ...(query.reportType ? { reportType: query.reportType as CustomerSuccessReportType } : {}),
        ...(query.favoritesOnly === 'true' ? { isFavorite: true } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
    return { items };
  }

  async createSavedReport(dto: SaveCustomerReportDto, actor: any) {
    return this.prisma.savedCustomerSuccessReport.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        reportType: dto.reportType,
        filters: (dto.filters || {}) as Prisma.InputJsonValue,
        columns: dto.columns as Prisma.InputJsonValue,
        chartConfig: dto.chartConfig as Prisma.InputJsonValue,
        isFavorite: dto.isFavorite || false,
        createdById: actor?.id || 'system',
      },
    });
  }

  async savedReport(id: string) {
    const item = await this.prisma.savedCustomerSuccessReport.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Saved report not found');
    return item;
  }

  async updateSavedReport(id: string, dto: UpdateSavedCustomerReportDto, actor: any) {
    await this.savedReport(id);
    return this.prisma.savedCustomerSuccessReport.update({ where: { id }, data: { ...dto, updatedById: actor?.id || null } as any });
  }

  async archiveSavedReport(id: string, actor: any) {
    await this.savedReport(id);
    return this.prisma.savedCustomerSuccessReport.update({ where: { id }, data: { status: SavedCustomerReportStatus.ARCHIVED, updatedById: actor?.id || null } });
  }

  async favoriteSavedReport(id: string, favorite: boolean, actor: any) {
    await this.savedReport(id);
    return this.prisma.savedCustomerSuccessReport.update({ where: { id }, data: { isFavorite: favorite, updatedById: actor?.id || null } });
  }

  async createExport(dto: ExportCustomerReportDto, actor: any) {
    const format = dto.format || CustomerSuccessReportExportFormat.CSV;
    const data = await this.exportPayload(dto.reportType, dto.filters || {}, format);
    const fileName = `customer-success-${dto.reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
    return this.prisma.customerSuccessReportExport.create({
      data: {
        reportType: dto.reportType,
        format,
        status: CustomerSuccessReportExportStatus.READY,
        fileName,
        fileSize: Buffer.byteLength(data.content),
        filters: (dto.filters || {}) as Prisma.InputJsonValue,
        generatedById: actor?.id || 'system',
        generatedAt: new Date(),
        metadata: { contentType: data.contentType, rows: data.rows } as Prisma.InputJsonValue,
      },
    });
  }

  async exports(query: ReportFilters) {
    const items = await this.prisma.customerSuccessReportExport.findMany({ where: { ...(query.reportType ? { reportType: query.reportType as CustomerSuccessReportType } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { items };
  }

  async exportRecord(id: string) {
    const item = await this.prisma.customerSuccessReportExport.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Export not found');
    return item;
  }

  async downloadExport(id: string) {
    const record = await this.exportRecord(id);
    if (record.status !== CustomerSuccessReportExportStatus.READY) throw new BadRequestException('Exportul nu este pregatit pentru download.');
    const payload = await this.exportPayload(record.reportType, record.filters as Record<string, unknown>, record.format);
    return { ...payload, fileName: record.fileName };
  }

  private async reportByType(type: CustomerSuccessReportType, filters: ReportFilters | Record<string, unknown>) {
    const q = filters as ReportFilters;
    if (type === CustomerSuccessReportType.HEALTH_DISTRIBUTION) return this.getHealthDistribution(q);
    if (type === CustomerSuccessReportType.HEALTH_TRENDS) return this.getHealthTrends(q);
    if (type === CustomerSuccessReportType.ONBOARDING_PIPELINE) return this.getOnboardingReport(q);
    if (type === CustomerSuccessReportType.REVENUE_ESTIMATE) return this.getRevenueEstimate(q);
    if (type === CustomerSuccessReportType.SAAS_INVOICES) return this.getSaasInvoicesReport(q);
    if (type === CustomerSuccessReportType.FOLLOW_UP_PERFORMANCE) return this.getFollowUpPerformance(q);
    if (type === CustomerSuccessReportType.TASK_PERFORMANCE) return this.getTaskPerformance(q);
    if (type === CustomerSuccessReportType.PLAYBOOK_PERFORMANCE) return this.getPlaybookPerformance(q);
    if (type === CustomerSuccessReportType.USAGE_BY_PLAN) return this.getUsageByPlan(q);
    if (type === CustomerSuccessReportType.CHURN_RISK) return this.getChurnRiskReport(q);
    if (type === CustomerSuccessReportType.OWNER_PERFORMANCE) return this.getOwnerPerformance(q);
    return this.getPortfolioOverview(q);
  }

  private async exportPayload(type: CustomerSuccessReportType, filters: Record<string, unknown>, format: CustomerSuccessReportExportFormat) {
    const report = await this.reportByType(type, filters);
    if (format === CustomerSuccessReportExportFormat.JSON) {
      const content = JSON.stringify({ exportedAt: new Date().toISOString(), reportType: type, filters, report }, null, 2);
      return { content, contentType: 'application/json; charset=utf-8', rows: 1 };
    }
    const rows = this.rowsForExport(type, report);
    return { content: this.buildCsv(rows), contentType: 'text/csv; charset=utf-8', rows: rows.length };
  }

  private rowsForExport(type: CustomerSuccessReportType, report: any): Record<string, unknown>[] {
    if (type === CustomerSuccessReportType.HEALTH_DISTRIBUTION) return report.items || [];
    if (type === CustomerSuccessReportType.REVENUE_ESTIMATE) return report.byPlan || [];
    if (type === CustomerSuccessReportType.SAAS_INVOICES) return report.overdueInvoices || [];
    if (type === CustomerSuccessReportType.FOLLOW_UP_PERFORMANCE) return report.byOwner || [];
    if (type === CustomerSuccessReportType.TASK_PERFORMANCE) return report.overdueTasks || [];
    if (type === CustomerSuccessReportType.PLAYBOOK_PERFORMANCE) return report.items || [];
    if (type === CustomerSuccessReportType.USAGE_BY_PLAN) return report.items || [];
    if (type === CustomerSuccessReportType.CHURN_RISK) return report.items || [];
    if (type === CustomerSuccessReportType.ONBOARDING_PIPELINE) return report.stuckClients || [];
    return report.atRiskClients || report.healthDistribution || [];
  }

  private buildCsv(rows: Record<string, unknown>[]) {
    const flatRows = rows.map((row) => this.flatten(row));
    const headers = Array.from(new Set(flatRows.flatMap((row) => Object.keys(row)))).slice(0, 40);
    const lines = [headers.join(';'), ...flatRows.map((row) => headers.map((header) => this.csvValue(row[header])).join(';'))];
    return `\uFEFF${lines.join('\n')}`;
  }

  private flatten(row: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row || {})) {
      if (['password', 'passwordHash', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'accessToken', 'refreshToken'].some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) continue;
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) Object.assign(out, this.flatten(value as Record<string, unknown>, nextKey));
      else out[nextKey] = Array.isArray(value) ? value.map((item) => typeof item === 'object' ? JSON.stringify(item) : item).join(', ') : value instanceof Date ? value.toISOString() : value;
    }
    return out;
  }

  private csvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    let text = String(value).replace(/\r?\n/g, ' ');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    if (text.includes(';') || text.includes('"')) text = `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  private latestSnapshots(snapshots: any[]) {
    const map = new Map<string, any>();
    for (const snapshot of snapshots) if (!map.has(snapshot.clientAccountId)) map.set(snapshot.clientAccountId, snapshot);
    return map;
  }

  private clientWhere(query: ReportFilters): Prisma.ClientAccountWhereInput {
    return {
      ...(query.lifecycleStage ? { lifecycleStage: query.lifecycleStage as ClientLifecycleStage } : {}),
      ...(query.clientStatus ? { status: query.clientStatus as any } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.source ? { source: query.source as any } : {}),
      ...(query.priority ? { priority: query.priority as any } : {}),
      ...(query.associationId ? { associationId: query.associationId } : {}),
      ...(query.clientAccountId ? { id: query.clientAccountId } : {}),
    };
  }

  private overdueInvoiceWhere(): Prisma.SaasInvoiceWhereInput {
    return { balanceAmount: { gt: 0 }, dueDate: { lt: new Date() }, status: { in: [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID, SaasInvoiceStatus.OVERDUE] } };
  }

  private periodRange(query: ReportFilters | Record<string, unknown>) {
    const now = new Date();
    const period = String(query.period || CustomerSuccessReportPeriod.LAST_30_DAYS);
    if (period === CustomerSuccessReportPeriod.CUSTOM && query.dateFrom && query.dateTo) return { start: new Date(String(query.dateFrom)), end: new Date(String(query.dateTo)) };
    if (period === CustomerSuccessReportPeriod.TODAY) return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
    if (period === CustomerSuccessReportPeriod.LAST_7_DAYS) return { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: now };
    if (period === CustomerSuccessReportPeriod.LAST_90_DAYS) return { start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), end: now };
    if (period === CustomerSuccessReportPeriod.MONTH_TO_DATE) return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    if (period === CustomerSuccessReportPeriod.QUARTER_TO_DATE) return { start: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), end: now };
    if (period === CustomerSuccessReportPeriod.YEAR_TO_DATE) return { start: new Date(now.getFullYear(), 0, 1), end: now };
    return { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: now };
  }

  private filtersFromDto(filters: Record<string, unknown>, period?: CustomerSuccessReportPeriod) {
    return { ...filters, ...(period ? { period } : {}) };
  }

  private monthlyEquivalent(price: number, billingCycle: string) {
    if (billingCycle === 'YEARLY' || billingCycle === 'ANNUAL') return Number(price || 0) / 12;
    if (billingCycle === 'QUARTERLY') return Number(price || 0) / 3;
    return Number(price || 0);
  }

  private countBy(items: any[], key: string) {
    const map = new Map<string, number>();
    for (const item of items) map.set(String(item[key] || 'UNKNOWN'), (map.get(String(item[key] || 'UNKNOWN')) || 0) + 1);
    return Array.from(map.entries()).map(([value, count]) => ({ value, count }));
  }

  private daysBetween(start: Date, end: Date) {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }
}
