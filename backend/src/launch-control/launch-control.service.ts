import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  LaunchChecklistCategory,
  LaunchChecklistSeverity,
  LaunchChecklistStatus,
  LaunchEventType,
  LaunchStateStatus,
  LegalDocumentStatus,
  LegalDocumentType,
  PlatformServiceBillingCycle,
  PlatformServiceCriticality,
  PlatformServicePaymentEventType,
  PlatformServiceStatus,
  PlatformServiceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MarkGoLiveDto,
  PlatformServicePaymentEventDto,
  UpdateLaunchChecklistItemDto,
  UpsertPlatformServiceDto,
} from './dto/launch-control.dto';
import { LAUNCH_CHECKLIST_SEEDS, PLATFORM_SERVICE_SEEDS } from './launch-control.seed';

type Actor = { id?: string; sub?: string; role?: string; organizationId?: string };

const REQUIRED_ENV = [
  { key: 'DATABASE_URL', service: 'Supabase/Render', required: true },
  { key: 'JWT_SECRET', service: 'Render', required: true },
  { key: 'CORS_ORIGIN', service: 'Render', required: true },
  { key: 'PORT', service: 'Render', required: true },
  { key: 'NEXT_PUBLIC_API_URL', service: 'Vercel', required: true },
  { key: 'NEXT_PUBLIC_SOCKET_URL', service: 'Vercel', required: false },
  { key: 'EMAIL_PROVIDER', service: 'Email Provider', required: false },
  { key: 'RESEND_API_KEY', service: 'Email Provider', required: false },
  { key: 'SMTP_HOST', service: 'Email Provider', required: false },
  { key: 'SMS_PROVIDER', service: 'SMS Provider', required: false },
  { key: 'BPAY_ENABLED', service: 'Payment Provider', required: false },
  { key: 'BPAY_MERCHANT_ID', service: 'Payment Provider', required: false },
  { key: 'BPAY_API_KEY', service: 'Payment Provider', required: false },
  { key: 'SENTRY_DSN', service: 'Monitoring', required: false },
] as const;

@Injectable()
export class LaunchControlService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialData();
  }

  private actorId(actor?: Actor | null) {
    return actor?.id || actor?.sub || null;
  }

  async seedInitialData() {
    for (const [key, category, title, description, severity, isRequired, actionUrl] of LAUNCH_CHECKLIST_SEEDS) {
      await this.prisma.launchChecklistItem.upsert({
        where: { key },
        update: {
          category: category as LaunchChecklistCategory,
          title,
          description,
          severity: severity as LaunchChecklistSeverity,
          isRequired,
          actionUrl,
        },
        create: {
          key,
          category: category as LaunchChecklistCategory,
          title,
          description,
          severity: severity as LaunchChecklistSeverity,
          isRequired,
          actionUrl,
        },
      });
    }

    for (const service of PLATFORM_SERVICE_SEEDS) {
      const existing = await this.prisma.platformService.findFirst({
        where: { name: service.name, providerName: service.providerName },
        select: { id: true },
      });
      const data = {
        name: service.name,
        type: service.type,
        providerName: service.providerName,
        purpose: service.purpose,
        criticality: service.criticality,
        status: service.status,
        billingCycle: service.billingCycle,
        environmentKeys: service.environmentKeys as unknown as Prisma.InputJsonValue,
        impactIfDown: service.impactIfDown,
        isRequiredForLaunch: service.isRequiredForLaunch,
      };
      if (existing) await this.prisma.platformService.update({ where: { id: existing.id }, data });
      else await this.prisma.platformService.create({ data });
    }
  }

  async overview() {
    await this.seedInitialData();
    const [checklist, services, state, events] = await Promise.all([
      this.prisma.launchChecklistItem.findMany(),
      this.prisma.platformService.findMany({ include: { owner: { select: { id: true, email: true, fullName: true } } } }),
      this.getOrCreateState(),
      this.prisma.launchEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    const env = await this.envDiagnostics();
    const readiness = this.calculateReadiness(checklist, services, env.items, state.status);
    const costs = this.costSummary(services);
    const due = this.dueServices(services);
    const criticalItems = checklist.filter((item) => item.severity === LaunchChecklistSeverity.CRITICAL && item.status !== LaunchChecklistStatus.PASSED && item.status !== LaunchChecklistStatus.NOT_APPLICABLE);
    return {
      status: readiness.status,
      readinessScore: readiness.score,
      summary: {
        criticalBlockers: readiness.criticalBlockers,
        warnings: readiness.warnings,
        requiredServices: services.filter((item) => item.isRequiredForLaunch).length,
        requiredServicesActive: services.filter((item) => item.isRequiredForLaunch && item.status === PlatformServiceStatus.ACTIVE).length,
        monthlyEstimatedCost: costs.monthlyEstimatedCost,
        yearlyEstimatedCost: costs.yearlyEstimatedCost,
        currency: costs.currency,
        servicesDueSoon: due.dueSoon.length,
        missingEnvVars: env.items.filter((item) => item.required && item.status === 'MISSING').length,
      },
      checklistSummary: this.groupChecklistSummary(checklist),
      criticalItems,
      servicesDueSoon: due.dueSoon,
      servicesOverdue: due.overdue,
      costs,
      env,
      state,
      recentEvents: events,
    };
  }

  async checklist() {
    await this.seedInitialData();
    const items = await this.prisma.launchChecklistItem.findMany({
      include: { checkedBy: { select: { id: true, email: true, fullName: true } } },
      orderBy: [{ category: 'asc' }, { severity: 'desc' }, { title: 'asc' }],
    });
    return { items, grouped: this.groupChecklist(items) };
  }

  async runChecklist(actor?: Actor) {
    await this.seedInitialData();
    const env = await this.envDiagnostics();
    const legal = await this.legalReadiness();
    const healthOk = await this.checkDb();

    const updates: Record<string, LaunchChecklistStatus> = {
      env_database_url: env.items.find((item) => item.key === 'DATABASE_URL')?.status === 'PRESENT' ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      env_jwt_secret: env.items.find((item) => item.key === 'JWT_SECRET')?.status === 'PRESENT' ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      env_cors_origin: env.items.find((item) => item.key === 'CORS_ORIGIN')?.status === 'PRESENT' ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      env_next_public_api_url: env.items.find((item) => item.key === 'NEXT_PUBLIC_API_URL')?.status === 'PRESENT' ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.WARNING,
      legal_privacy: legal.privacy ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      legal_terms: legal.terms ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      legal_cookies: legal.cookies ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.WARNING,
      legal_security: legal.security ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.WARNING,
      monitoring_health: healthOk ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      monitoring_readiness: healthOk ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
      db_reachable: healthOk ? LaunchChecklistStatus.PASSED : LaunchChecklistStatus.BLOCKED,
    };

    await Promise.all(
      Object.entries(updates).map(([key, status]) =>
        this.prisma.launchChecklistItem.updateMany({
          where: { key },
          data: {
            status,
            checkedAt: new Date(),
            checkedById: this.actorId(actor),
            evidence: 'Auto-check rulat din Go-Live Control Center.',
          },
        }),
      ),
    );
    await this.addEvent(LaunchEventType.CHECKLIST_UPDATED, 'Checklist rulat', 'Verificarile automate au actualizat itemurile cunoscute.', actor);
    return this.checklist();
  }

  async updateChecklistItem(id: string, dto: UpdateLaunchChecklistItemDto, actor?: Actor) {
    const item = await this.prisma.launchChecklistItem.update({
      where: { id },
      data: {
        status: dto.status,
        severity: dto.severity,
        evidence: dto.evidence,
        owner: dto.owner,
        checkedAt: new Date(),
        checkedById: this.actorId(actor),
      },
    });
    await this.addEvent(LaunchEventType.CHECKLIST_UPDATED, 'Checklist actualizat', item.title, actor, { checklistKey: item.key, status: item.status });
    return item;
  }

  async services(filters: Record<string, string | undefined>) {
    await this.seedInitialData();
    const search = filters.search?.trim();
    const where: Prisma.PlatformServiceWhereInput = {
      ...(filters.type ? { type: filters.type as PlatformServiceType } : {}),
      ...(filters.status ? { status: filters.status as PlatformServiceStatus } : {}),
      ...(filters.criticality ? { criticality: filters.criticality as PlatformServiceCriticality } : {}),
      ...(filters.billingCycle ? { billingCycle: filters.billingCycle as PlatformServiceBillingCycle } : {}),
      ...(filters.isRequiredForLaunch === 'true' ? { isRequiredForLaunch: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { providerName: { contains: search, mode: 'insensitive' } },
              { purpose: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const all = await this.prisma.platformService.findMany({
      where,
      include: { owner: { select: { id: true, email: true, fullName: true } }, paymentEvents: { orderBy: { createdAt: 'desc' }, take: 3 } },
      orderBy: [{ criticality: 'asc' }, { name: 'asc' }],
    });
    const due = this.dueServices(all);
    const filtered = filters.dueSoon === 'true' ? due.dueSoon : all;
    return { items: filtered, stats: this.serviceStats(all), due };
  }

  async createService(dto: UpsertPlatformServiceDto, actor?: Actor) {
    const service = await this.prisma.platformService.create({ data: this.mapServiceDto(dto, actor, true) as Prisma.PlatformServiceUncheckedCreateInput });
    await this.addEvent(LaunchEventType.SERVICE_ADDED, 'Serviciu adaugat', service.name, actor, { serviceId: service.id });
    return service;
  }

  async getService(id: string) {
    const service = await this.prisma.platformService.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, fullName: true } },
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
        paymentEvents: { include: { actor: { select: { id: true, email: true, fullName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!service) throw new NotFoundException('Serviciul nu a fost gasit.');
    return service;
  }

  async updateService(id: string, dto: UpsertPlatformServiceDto, actor?: Actor) {
    await this.getService(id);
    const service = await this.prisma.platformService.update({ where: { id }, data: this.mapServiceDto(dto, actor, false) });
    await this.addEvent(LaunchEventType.SERVICE_UPDATED, 'Serviciu actualizat', service.name, actor, { serviceId: service.id, status: service.status });
    return service;
  }

  async recordPayment(id: string, dto: PlatformServicePaymentEventDto, actor?: Actor) {
    const service = await this.getService(id);
    const event = await this.prisma.platformServicePaymentEvent.create({
      data: {
        serviceId: id,
        eventType: PlatformServicePaymentEventType.PAYMENT_RECORDED,
        amount: dto.amount ?? null,
        currency: dto.currency || service.currency,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        nextPaymentDate: dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : null,
        note: dto.note || null,
        actorUserId: this.actorId(actor),
      },
    });
    await this.prisma.platformService.update({
      where: { id },
      data: {
        nextPaymentDate: dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : service.nextPaymentDate,
        status:
          service.status === PlatformServiceStatus.PAYMENT_DUE || service.status === PlatformServiceStatus.PAST_DUE
            ? PlatformServiceStatus.ACTIVE
            : service.status,
      },
    });
    await this.addEvent(LaunchEventType.SERVICE_PAYMENT_RECORDED, 'Plata serviciu inregistrata', service.name, actor, {
      serviceId: id,
      amount: dto.amount,
      nextPaymentDate: dto.nextPaymentDate,
    });
    return event;
  }

  async costs() {
    const services = await this.prisma.platformService.findMany({ orderBy: [{ nextPaymentDate: 'asc' }, { name: 'asc' }] });
    const due = this.dueServices(services);
    return {
      ...this.costSummary(services),
      dueSoon: due.dueSoon,
      upcoming: due.upcoming,
      overdue: due.overdue,
      withoutCost: services.filter((item) => !item.estimatedMonthlyCost && !item.estimatedYearlyCost),
      withoutNextPaymentDate: services.filter((item) => item.billingCycle !== PlatformServiceBillingCycle.FREE && !item.nextPaymentDate),
      byCategory: Object.entries(
        services.reduce<Record<string, number>>((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + (item.estimatedMonthlyCost || 0);
          return acc;
        }, {}),
      ).map(([type, monthly]) => ({ type, monthly })),
      services,
    };
  }

  async envDiagnostics() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const items = REQUIRED_ENV.map((item) => ({
      ...item,
      status: process.env[item.key] ? 'PRESENT' : item.required ? 'MISSING' : 'OPTIONAL_MISSING',
    }));
    return { environment: nodeEnv, items, missingRequired: items.filter((item) => item.required && item.status === 'MISSING') };
  }

  async deployments() {
    const services = await this.prisma.platformService.findMany({
      where: { type: { in: [PlatformServiceType.HOSTING_FRONTEND, PlatformServiceType.HOSTING_BACKEND, PlatformServiceType.DATABASE, PlatformServiceType.SOURCE_CONTROL] } },
    });
    return {
      expected: {
        branch: 'main',
        packageManager: 'npm',
        frontendProvider: 'Vercel',
        backendProvider: 'Render',
        databaseProvider: 'Supabase',
      },
      current: {
        nodeEnv: process.env.NODE_ENV || 'development',
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || null,
        commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
      },
      checklist: [
        'Vercel production branch = main',
        'Vercel root directory = frontend',
        'Render branch = main',
        'Render root directory = backend',
        'Render build command documented',
        'Supabase DATABASE_URL configured',
      ],
      services,
    };
  }

  async goLive() {
    const overview = await this.overview();
    return {
      ...overview,
      blockers: overview.criticalItems,
      canMarkReady: overview.readinessScore >= 90 && overview.summary.criticalBlockers === 0,
    };
  }

  async markReady(dto: MarkGoLiveDto, actor?: Actor) {
    if (!dto.confirmed) throw new BadRequestException('Confirmarea este obligatorie.');
    const overview = await this.overview();
    const state = await this.getOrCreateState();
    const updated = await this.prisma.launchState.update({
      where: { id: state.id },
      data: {
        status: LaunchStateStatus.READY,
        readinessScore: overview.readinessScore,
        markedReadyAt: new Date(),
        markedReadyById: this.actorId(actor),
        notes: dto.notes || state.notes,
        metadata: { summary: overview.summary } as Prisma.InputJsonValue,
      },
    });
    await this.addEvent(LaunchEventType.GO_LIVE_READY_MARKED, 'Platforma marcata gata de lansare', 'Nu porneste deploy, plati sau servicii externe.', actor, { readinessScore: overview.readinessScore });
    return updated;
  }

  async markLive(dto: MarkGoLiveDto, actor?: Actor) {
    if (!dto.confirmed) throw new BadRequestException('Confirmarea este obligatorie.');
    const overview = await this.overview();
    const state = await this.getOrCreateState();
    const updated = await this.prisma.launchState.update({
      where: { id: state.id },
      data: {
        status: LaunchStateStatus.LIVE,
        readinessScore: overview.readinessScore,
        wentLiveAt: new Date(),
        wentLiveById: this.actorId(actor),
        notes: dto.notes || state.notes,
        metadata: { summary: overview.summary } as Prisma.InputJsonValue,
      },
    });
    await this.addEvent(LaunchEventType.LIVE_MARKED, 'Platforma marcata LIVE', 'Status intern administrativ actualizat.', actor, { readinessScore: overview.readinessScore });
    return updated;
  }

  events() {
    return this.prisma.launchEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  private calculateReadiness(checklist: any[], services: any[], env: any[], currentStatus?: LaunchStateStatus) {
    if (currentStatus === LaunchStateStatus.LIVE) {
      return { score: 100, status: LaunchStateStatus.LIVE, criticalBlockers: 0, warnings: 0 };
    }
    let score = 100;
    const criticalBlockers =
      checklist.filter((item) => item.isRequired && item.severity === LaunchChecklistSeverity.CRITICAL && [LaunchChecklistStatus.BLOCKED, LaunchChecklistStatus.NOT_STARTED].includes(item.status)).length +
      services.filter((item) => item.isRequiredForLaunch && item.criticality === PlatformServiceCriticality.CRITICAL && ![PlatformServiceStatus.ACTIVE, PlatformServiceStatus.TRIAL].includes(item.status)).length +
      env.filter((item) => item.required && item.status === 'MISSING').length;
    const warnings =
      checklist.filter((item) => item.status === LaunchChecklistStatus.WARNING || (item.isRequired && item.status === LaunchChecklistStatus.IN_PROGRESS)).length +
      services.filter((item) => item.status === PlatformServiceStatus.PAYMENT_DUE || item.status === PlatformServiceStatus.PAST_DUE).length;
    score -= criticalBlockers * 15;
    score -= warnings * 5;
    score = Math.max(0, Math.min(100, score));
    const status = score >= 90 && criticalBlockers === 0 ? LaunchStateStatus.READY : score >= 70 ? LaunchStateStatus.NEEDS_ATTENTION : LaunchStateStatus.NOT_READY;
    return { score, status, criticalBlockers, warnings };
  }

  private costSummary(services: any[]) {
    const monthlyEstimatedCost = services.reduce((sum, item) => sum + (item.estimatedMonthlyCost || (item.estimatedYearlyCost ? item.estimatedYearlyCost / 12 : 0)), 0);
    const yearlyEstimatedCost = services.reduce((sum, item) => sum + (item.estimatedYearlyCost || (item.estimatedMonthlyCost ? item.estimatedMonthlyCost * 12 : 0)), 0);
    return {
      monthlyEstimatedCost: Math.round(monthlyEstimatedCost * 100) / 100,
      yearlyEstimatedCost: Math.round(yearlyEstimatedCost * 100) / 100,
      currency: services.find((item) => item.currency)?.currency || 'USD',
      criticalServices: services.filter((item) => item.criticality === PlatformServiceCriticality.CRITICAL).length,
      paymentDue7Days: this.dueServices(services).dueSoon.length,
      overdueServices: this.dueServices(services).overdue.length,
      servicesWithoutCost: services.filter((item) => !item.estimatedMonthlyCost && !item.estimatedYearlyCost).length,
      servicesWithoutNextPayment: services.filter((item) => item.billingCycle !== PlatformServiceBillingCycle.FREE && !item.nextPaymentDate).length,
    };
  }

  private dueServices(services: any[]) {
    const now = new Date();
    const seven = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const thirty = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const withDate = services.filter((item) => item.nextPaymentDate);
    return {
      dueSoon: withDate.filter((item) => item.nextPaymentDate <= seven && item.nextPaymentDate >= now),
      upcoming: withDate.filter((item) => item.nextPaymentDate <= thirty && item.nextPaymentDate >= now),
      overdue: withDate.filter((item) => item.nextPaymentDate < now || item.status === PlatformServiceStatus.PAST_DUE),
    };
  }

  private serviceStats(services: any[]) {
    return {
      total: services.length,
      critical: services.filter((item) => item.criticality === PlatformServiceCriticality.CRITICAL).length,
      activeCritical: services.filter((item) => item.criticality === PlatformServiceCriticality.CRITICAL && item.status === PlatformServiceStatus.ACTIVE).length,
      ...this.costSummary(services),
    };
  }

  private groupChecklist(items: any[]) {
    return Object.values(LaunchChecklistCategory).map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }));
  }

  private groupChecklistSummary(items: any[]) {
    return Object.values(LaunchChecklistCategory).map((category) => {
      const categoryItems = items.filter((item) => item.category === category);
      const passed = categoryItems.filter((item) => item.status === LaunchChecklistStatus.PASSED || item.status === LaunchChecklistStatus.NOT_APPLICABLE).length;
      return { category, total: categoryItems.length, passed, blockers: categoryItems.filter((item) => item.status === LaunchChecklistStatus.BLOCKED).length };
    });
  }

  private async legalReadiness() {
    const docs = await this.prisma.legalDocument.findMany({
      where: { status: LegalDocumentStatus.PUBLISHED, isActive: true },
      select: { type: true },
    });
    const has = (type: LegalDocumentType) => docs.some((doc) => doc.type === type);
    return {
      privacy: has(LegalDocumentType.PRIVACY_POLICY),
      terms: has(LegalDocumentType.TERMS_OF_USE),
      cookies: has(LegalDocumentType.COOKIE_POLICY),
      security: has(LegalDocumentType.SECURITY),
    };
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async getOrCreateState() {
    const existing = await this.prisma.launchState.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    return this.prisma.launchState.create({ data: { status: LaunchStateStatus.NOT_READY, readinessScore: 0 } });
  }

  private async addEvent(eventType: LaunchEventType, title: string, message: string, actor?: Actor, metadata?: unknown) {
    return this.prisma.launchEvent.create({
      data: {
        eventType,
        title,
        message,
        actorUserId: this.actorId(actor),
        metadata: (metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  private mapServiceDto(dto: UpsertPlatformServiceDto, actor: Actor | undefined, create: boolean): Prisma.PlatformServiceUncheckedCreateInput | Prisma.PlatformServiceUncheckedUpdateInput {
    const envKeys = Array.isArray(dto.environmentKeys) ? dto.environmentKeys.map((item) => this.cleanEnvKey(item)).filter(Boolean) : [];
    const dependsOn = Array.isArray(dto.dependsOn) ? dto.dependsOn.map((item) => String(item).slice(0, 160)).filter(Boolean) : [];
    return {
      name: dto.name.trim(),
      type: dto.type,
      providerName: dto.providerName.trim(),
      description: dto.description?.trim() || null,
      purpose: dto.purpose.trim(),
      criticality: dto.criticality,
      status: dto.status,
      billingCycle: dto.billingCycle,
      currency: dto.currency || 'USD',
      estimatedMonthlyCost: dto.estimatedMonthlyCost ?? null,
      estimatedYearlyCost: dto.estimatedYearlyCost ?? null,
      nextPaymentDate: dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : null,
      renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
      accountEmail: dto.accountEmail?.trim() || null,
      dashboardUrl: dto.dashboardUrl || null,
      documentationUrl: dto.documentationUrl || null,
      ownerUserId: dto.ownerUserId || null,
      managedBy: dto.managedBy?.trim() || null,
      environmentKeys: envKeys as Prisma.InputJsonValue,
      dependsOn: dependsOn as Prisma.InputJsonValue,
      impactIfDown: dto.impactIfDown.trim(),
      notes: dto.notes?.trim() || null,
      isRequiredForLaunch: Boolean(dto.isRequiredForLaunch),
      ...(create ? { createdById: this.actorId(actor) } : {}),
      updatedById: this.actorId(actor),
    };
  }

  private cleanEnvKey(value: string) {
    const key = String(value).split('=')[0]?.trim().replace(/[^A-Z0-9_]/gi, '').toUpperCase();
    return key ? key.slice(0, 80) : '';
  }
}
