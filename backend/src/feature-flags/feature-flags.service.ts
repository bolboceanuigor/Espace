import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FeatureFlagEventType,
  FeatureFlagRuleEffect,
  FeatureFlagRuleScope,
  FeatureFlagStatus,
  FeatureFlagType,
  Prisma,
  Role,
  SaasSubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFeatureFlagDto,
  CreateFeatureFlagRuleDto,
  EvaluateFeatureFlagsDto,
  ListFeatureFlagsDto,
  PreviewFeatureFlagsDto,
  UpdateFeatureFlagDto,
  UpdateFeatureFlagRuleDto,
} from './dto/feature-flags.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

type EvaluationContext = {
  organizationId: string | null;
  planId: string | null;
  planCode: string | null;
  role: Role;
  userId: string;
  subscriptionStatus: string | null;
  baseModules: Record<string, boolean>;
  activeCohortIds: string[];
};

const MODULE_CATALOG = [
  { key: 'apartmentsCrm', label: 'Apartamente CRM', group: 'Core' },
  { key: 'residentsCrm', label: 'Locatari CRM', group: 'Core' },
  { key: 'residentAccess', label: 'Acces portal rezidenti', group: 'Core' },
  { key: 'internalInvoices', label: 'Facturi interne', group: 'Billing' },
  { key: 'billingRun', label: 'Calcul facturi', group: 'Billing' },
  { key: 'manualPayments', label: 'Plati manuale', group: 'Billing' },
  { key: 'onlinePayments', label: 'Plati online', group: 'Billing' },
  { key: 'meterReadings', label: 'Indici contoare', group: 'Meters' },
  { key: 'meterBasedTariffs', label: 'Tarife pe consum', group: 'Meters' },
  { key: 'dataQuality', label: 'Calitatea datelor', group: 'Operations' },
  { key: 'announcements', label: 'Avizier', group: 'Comunicare' },
  { key: 'requests', label: 'Solicitari', group: 'Comunicare' },
  { key: 'documents', label: 'Documente', group: 'Comunicare' },
  { key: 'productUpdates', label: 'Noutati produs', group: 'Comunicare' },
  { key: 'betaProgram', label: 'Beta program', group: 'Product' },
  { key: 'basicReports', label: 'Rapoarte de baza', group: 'Reporting' },
  { key: 'financialReports', label: 'Rapoarte financiare', group: 'Reporting' },
  { key: 'consumptionReports', label: 'Rapoarte consum', group: 'Reporting' },
  { key: 'advancedReports', label: 'Rapoarte avansate', group: 'Reporting' },
  { key: 'csvImport', label: 'Import CSV', group: 'Data' },
  { key: 'csvExport', label: 'Export CSV', group: 'Data' },
  { key: 'staffRoles', label: 'Roluri staff', group: 'Security' },
  { key: 'auditLog', label: 'Audit log', group: 'Security' },
  { key: 'supportAccess', label: 'Support access', group: 'Security' },
  { key: 'duplicateDetection', label: 'Detectare duplicate', group: 'Data' },
  { key: 'advancedSecurity', label: 'Securitate avansata', group: 'Security' },
  { key: 'roadmap', label: 'Roadmap', group: 'Product' },
  { key: 'retention', label: 'Retentie', group: 'Product' },
  { key: 'featureFlags', label: 'Feature flags', group: 'Product' },
] as const;

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  moduleCatalog() {
    return MODULE_CATALOG;
  }

  async dashboard() {
    const [total, active, paused, draft, archived, rules, moduleFlags, recent] = await Promise.all([
      this.prisma.featureFlag.count(),
      this.prisma.featureFlag.count({ where: { status: FeatureFlagStatus.ACTIVE } }),
      this.prisma.featureFlag.count({ where: { status: FeatureFlagStatus.PAUSED } }),
      this.prisma.featureFlag.count({ where: { status: FeatureFlagStatus.DRAFT } }),
      this.prisma.featureFlag.count({ where: { status: FeatureFlagStatus.ARCHIVED } }),
      this.prisma.featureFlagRule.count(),
      this.prisma.featureFlag.count({ where: { moduleKey: { not: null } } }),
      this.prisma.featureFlag.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, key: true, name: true, status: true, type: true, moduleKey: true, updatedAt: true },
      }),
    ]);
    return { total, active, paused, draft, archived, rules, moduleFlags, recent };
  }

  async list(query: ListFeatureFlagsDto = {}) {
    return this.prisma.featureFlag.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.moduleKey ? { moduleKey: query.moduleKey } : {}),
        ...(query.q
          ? {
              OR: [
                { key: { contains: query.q, mode: 'insensitive' as const } },
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { description: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
        _count: { select: { rules: true, events: true } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 300,
    });
  }

  async get(idOrKey: string) {
    const flag = await this.prisma.featureFlag.findFirst({
      where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
        rules: {
          include: {
            plan: { select: { id: true, code: true, name: true } },
            organization: { select: { id: true, name: true, status: true } },
            betaCohort: { select: { id: true, key: true, name: true, status: true, betaProgramId: true } },
            createdBy: { select: { id: true, email: true, fullName: true } },
            updatedBy: { select: { id: true, email: true, fullName: true } },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
        events: {
          include: { actorUser: { select: { id: true, email: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }

  async create(actor: AuthUser, dto: CreateFeatureFlagDto) {
    this.assertSuperAdmin(actor);
    const userId = this.userId(actor);
    const flag = await this.prisma.featureFlag.create({
      data: {
        key: this.normalizeKey(dto.key),
        name: dto.name.trim(),
        description: this.optionalText(dto.description),
        type: dto.type || FeatureFlagType.RELEASE_FLAG,
        status: dto.status || FeatureFlagStatus.DRAFT,
        moduleKey: this.optionalText(dto.moduleKey),
        defaultEnabled: dto.defaultEnabled ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 100,
        visibleInNavigation: dto.visibleInNavigation ?? true,
        config: dto.config as Prisma.InputJsonValue | undefined,
        startsAt: this.optionalDate(dto.startsAt),
        endsAt: this.optionalDate(dto.endsAt),
        createdById: userId || undefined,
        updatedById: userId || undefined,
      },
    });
    await this.recordEvent(flag.id, actor, FeatureFlagEventType.CREATED, 'Feature flag created', flag.name);
    return this.get(flag.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateFeatureFlagDto) {
    this.assertSuperAdmin(actor);
    const current = await this.get(id);
    const data: Record<string, unknown> = { updatedById: this.userId(actor) || undefined };
    if (dto.key !== undefined) data.key = this.normalizeKey(dto.key);
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = this.optionalText(dto.description);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.moduleKey !== undefined) data.moduleKey = this.optionalText(dto.moduleKey);
    if (dto.defaultEnabled !== undefined) data.defaultEnabled = dto.defaultEnabled;
    if (dto.rolloutPercentage !== undefined) data.rolloutPercentage = dto.rolloutPercentage;
    if (dto.visibleInNavigation !== undefined) data.visibleInNavigation = dto.visibleInNavigation;
    if (dto.config !== undefined) data.config = dto.config;
    if (dto.startsAt !== undefined) data.startsAt = this.optionalDate(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = this.optionalDate(dto.endsAt);

    const updated = await this.prisma.featureFlag.update({ where: { id: current.id }, data });
    await this.recordEvent(updated.id, actor, FeatureFlagEventType.UPDATED, 'Feature flag updated', updated.name);
    return this.get(updated.id);
  }

  async updateStatus(actor: AuthUser, id: string, status: FeatureFlagStatus) {
    this.assertSuperAdmin(actor);
    const current = await this.get(id);
    const updated = await this.prisma.featureFlag.update({
      where: { id: current.id },
      data: { status, updatedById: this.userId(actor) || undefined },
    });
    await this.recordEvent(
      updated.id,
      actor,
      status === FeatureFlagStatus.ARCHIVED ? FeatureFlagEventType.ARCHIVED : FeatureFlagEventType.STATUS_CHANGED,
      'Feature flag status changed',
      `${current.status} -> ${status}`,
    );
    return this.get(updated.id);
  }

  async createRule(actor: AuthUser, featureFlagId: string, dto: CreateFeatureFlagRuleDto) {
    this.assertSuperAdmin(actor);
    const flag = await this.get(featureFlagId);
    this.assertRuleTarget(dto.scope, dto);
    const rule = await this.prisma.featureFlagRule.create({
      data: {
        featureFlagId: flag.id,
        scope: dto.scope,
        effect: dto.effect || FeatureFlagRuleEffect.ENABLE,
        planId: dto.scope === FeatureFlagRuleScope.PLAN ? dto.planId : null,
        organizationId: dto.scope === FeatureFlagRuleScope.ORGANIZATION ? dto.organizationId : null,
        betaCohortId: dto.scope === FeatureFlagRuleScope.COHORT ? dto.betaCohortId : null,
        role: dto.scope === FeatureFlagRuleScope.ROLE ? dto.role : null,
        rolloutPercentage: dto.rolloutPercentage ?? null,
        priority: dto.priority ?? 100,
        conditions: dto.conditions as Prisma.InputJsonValue | undefined,
        startsAt: this.optionalDate(dto.startsAt),
        endsAt: this.optionalDate(dto.endsAt),
        createdById: this.userId(actor) || undefined,
        updatedById: this.userId(actor) || undefined,
      },
    });
    await this.recordEvent(flag.id, actor, FeatureFlagEventType.RULE_CREATED, 'Rollout rule created', `${rule.scope} ${rule.effect}`, {
      ruleId: rule.id,
    });
    return this.get(flag.id);
  }

  async updateRule(actor: AuthUser, featureFlagId: string, ruleId: string, dto: UpdateFeatureFlagRuleDto) {
    this.assertSuperAdmin(actor);
    const flag = await this.get(featureFlagId);
    const existing = await this.prisma.featureFlagRule.findFirst({ where: { id: ruleId, featureFlagId: flag.id } });
    if (!existing) throw new NotFoundException('Feature flag rule not found');
    const scope = dto.scope || existing.scope;
    this.assertRuleTarget(scope, { ...existing, ...dto });
    const data: Record<string, unknown> = { updatedById: this.userId(actor) || undefined };
    if (dto.scope !== undefined) data.scope = dto.scope;
    if (dto.effect !== undefined) data.effect = dto.effect;
    if (dto.planId !== undefined || dto.scope !== undefined) data.planId = scope === FeatureFlagRuleScope.PLAN ? dto.planId ?? existing.planId : null;
    if (dto.organizationId !== undefined || dto.scope !== undefined) {
      data.organizationId = scope === FeatureFlagRuleScope.ORGANIZATION ? dto.organizationId ?? existing.organizationId : null;
    }
    if (dto.betaCohortId !== undefined || dto.scope !== undefined) {
      data.betaCohortId = scope === FeatureFlagRuleScope.COHORT ? dto.betaCohortId ?? existing.betaCohortId : null;
    }
    if (dto.role !== undefined || dto.scope !== undefined) data.role = scope === FeatureFlagRuleScope.ROLE ? dto.role ?? existing.role : null;
    if (dto.rolloutPercentage !== undefined) data.rolloutPercentage = dto.rolloutPercentage;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.conditions !== undefined) data.conditions = dto.conditions;
    if (dto.startsAt !== undefined) data.startsAt = this.optionalDate(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = this.optionalDate(dto.endsAt);
    await this.prisma.featureFlagRule.update({ where: { id: ruleId }, data });
    await this.recordEvent(flag.id, actor, FeatureFlagEventType.RULE_UPDATED, 'Rollout rule updated', `${scope}`, { ruleId });
    return this.get(flag.id);
  }

  async deleteRule(actor: AuthUser, featureFlagId: string, ruleId: string) {
    this.assertSuperAdmin(actor);
    const flag = await this.get(featureFlagId);
    const existing = await this.prisma.featureFlagRule.findFirst({ where: { id: ruleId, featureFlagId: flag.id } });
    if (!existing) throw new NotFoundException('Feature flag rule not found');
    await this.prisma.featureFlagRule.delete({ where: { id: ruleId } });
    await this.recordEvent(flag.id, actor, FeatureFlagEventType.RULE_DELETED, 'Rollout rule deleted', `${existing.scope}`, { ruleId });
    return { success: true };
  }

  async evaluateForUser(user: AuthUser, query: EvaluateFeatureFlagsDto = {}) {
    const context = await this.resolveContext({
      organizationId: user.organizationId,
      role: this.normalizeRole(user.role),
      userId: this.userId(user),
    });
    return this.evaluate(context, query);
  }

  async preview(actor: AuthUser, dto: PreviewFeatureFlagsDto) {
    this.assertSuperAdmin(actor);
    const context = await this.resolveContext({
      organizationId: dto.organizationId,
      planId: dto.planId,
      role: dto.role || Role.ADMIN,
      userId: dto.userId || this.userId(actor) || 'preview',
    });
    return this.evaluate(context, {});
  }

  async evaluate(context: EvaluationContext, query: EvaluateFeatureFlagsDto = {}) {
    const flags = await this.prisma.featureFlag.findMany({
      where: query.moduleKey ? { moduleKey: query.moduleKey } : {},
      include: { rules: true },
      orderBy: [{ moduleKey: 'asc' }, { key: 'asc' }],
    });
    const now = new Date();
    const modules = { ...context.baseModules };
    const evaluated: Record<string, unknown> = {};
    for (const flag of flags) {
      const result = this.evaluateFlag(flag, context, now);
      evaluated[flag.key] = result;
      if (flag.moduleKey && flag.visibleInNavigation) {
        modules[flag.moduleKey] = result.enabled;
      }
    }
    return {
      flags: evaluated,
      modules,
      catalog: MODULE_CATALOG,
      context: {
        organizationId: context.organizationId,
        role: context.role,
        planId: context.planId,
        planCode: context.planCode,
        subscriptionStatus: context.subscriptionStatus,
        activeCohortIds: context.activeCohortIds,
      },
    };
  }

  private evaluateFlag(flag: any, context: EvaluationContext, now: Date) {
    const bucket = this.rolloutBucket(`${flag.key}:${context.organizationId || 'global'}:${context.userId || context.role}`);
    if (flag.status !== FeatureFlagStatus.ACTIVE) {
      return { enabled: false, reason: `FLAG_${flag.status}`, moduleKey: flag.moduleKey, source: 'status', rolloutBucket: bucket };
    }
    if (!this.isActiveWindow(flag, now)) {
      return { enabled: false, reason: 'OUTSIDE_FLAG_WINDOW', moduleKey: flag.moduleKey, source: 'window', rolloutBucket: bucket };
    }

    let enabled = !!flag.defaultEnabled;
    let reason = enabled ? 'DEFAULT_ENABLED' : 'DEFAULT_DISABLED';
    let source = 'default';

    if (flag.moduleKey && context.baseModules[flag.moduleKey] === false) {
      enabled = false;
      reason = 'DISABLED_BY_PLAN_OR_LIMITS';
      source = 'module';
    }

    if (enabled && !this.passesRollout(flag.rolloutPercentage ?? 100, bucket)) {
      enabled = false;
      reason = 'MISSED_FLAG_ROLLOUT';
      source = 'rollout';
    }

    const rules = [...(flag.rules || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    for (const rule of rules) {
      if (!this.ruleMatches(rule, context)) continue;
      if (!this.isActiveWindow(rule, now)) continue;
      if (!this.passesRollout(rule.rolloutPercentage ?? 100, bucket)) continue;
      enabled = rule.effect === FeatureFlagRuleEffect.ENABLE;
      reason = `${rule.scope}_${rule.effect}`;
      source = 'rule';
    }

    return { enabled, reason, moduleKey: flag.moduleKey, source, rolloutBucket: bucket };
  }

  private async resolveContext(input: { organizationId?: string | null; planId?: string | null; role?: Role; userId?: string }): Promise<EvaluationContext> {
    const organizationId = input.organizationId || null;
    let planId = input.planId || null;
    let planCode: string | null = null;
    let subscriptionStatus: string | null = null;
    let baseModules: Record<string, boolean> = {};
    let activeCohortIds: string[] = [];

    if (organizationId) {
      const [limits, subscription, cohorts] = await Promise.all([
        this.prisma.organizationLimits.findUnique({ where: { organizationId }, select: { modulesJson: true } }),
        this.prisma.saasSubscription.findFirst({
          where: {
            associationId: organizationId,
            status: { in: [SaasSubscriptionStatus.TRIALING, SaasSubscriptionStatus.ACTIVE, SaasSubscriptionStatus.PAST_DUE, SaasSubscriptionStatus.SUSPENDED] },
          },
          include: { plan: { select: { id: true, code: true, features: true } } },
          orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.betaCohortMember.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              { organizationId },
              ...(input.userId ? [{ userId: input.userId }] : []),
            ],
            betaCohort: {
              status: 'ACTIVE',
              betaProgram: { status: 'ACTIVE' },
            },
          },
          select: { betaCohortId: true },
        }),
      ]);
      activeCohortIds = cohorts.map((cohort) => cohort.betaCohortId);
      if (subscription) {
        planId = subscription.planId;
        planCode = subscription.plan?.code || null;
        subscriptionStatus = subscription.status;
        baseModules = {
          ...baseModules,
          ...this.booleanRecord(subscription.plan?.features),
          ...this.booleanRecord(subscription.featuresSnapshot),
        };
      }
      baseModules = { ...baseModules, ...this.booleanRecord(limits?.modulesJson) };
    }

    if (planId && !planCode) {
      const plan = await this.prisma.saasPlan.findUnique({ where: { id: planId }, select: { id: true, code: true, features: true } });
      if (plan) {
        planCode = plan.code;
        baseModules = { ...baseModules, ...this.booleanRecord(plan.features) };
      }
    }

    return {
      organizationId,
      planId,
      planCode,
      role: input.role || Role.ADMIN,
      userId: input.userId || 'anonymous',
      subscriptionStatus,
      baseModules,
      activeCohortIds,
    };
  }

  private ruleMatches(rule: any, context: EvaluationContext) {
    if (rule.scope === FeatureFlagRuleScope.GLOBAL) return true;
    if (rule.scope === FeatureFlagRuleScope.PLAN) return !!rule.planId && rule.planId === context.planId;
    if (rule.scope === FeatureFlagRuleScope.ORGANIZATION) return !!rule.organizationId && rule.organizationId === context.organizationId;
    if (rule.scope === FeatureFlagRuleScope.COHORT) return !!rule.betaCohortId && context.activeCohortIds.includes(rule.betaCohortId);
    if (rule.scope === FeatureFlagRuleScope.ROLE) return !!rule.role && rule.role === context.role;
    return false;
  }

  private isActiveWindow(value: { startsAt?: Date | string | null; endsAt?: Date | string | null }, now: Date) {
    const startsAt = value.startsAt ? new Date(value.startsAt) : null;
    const endsAt = value.endsAt ? new Date(value.endsAt) : null;
    if (startsAt && startsAt > now) return false;
    if (endsAt && endsAt < now) return false;
    return true;
  }

  private rolloutBucket(seed: string) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 100 + 1;
  }

  private passesRollout(percentage: number, bucket: number) {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;
    return bucket <= percentage;
  }

  private assertRuleTarget(scope: FeatureFlagRuleScope, data: { planId?: string | null; organizationId?: string | null; betaCohortId?: string | null; role?: Role | null }) {
    if (scope === FeatureFlagRuleScope.PLAN && !data.planId) throw new BadRequestException('PLAN scope requires planId');
    if (scope === FeatureFlagRuleScope.ORGANIZATION && !data.organizationId) throw new BadRequestException('ORGANIZATION scope requires organizationId');
    if (scope === FeatureFlagRuleScope.COHORT && !data.betaCohortId) throw new BadRequestException('COHORT scope requires betaCohortId');
    if (scope === FeatureFlagRuleScope.ROLE && !data.role) throw new BadRequestException('ROLE scope requires role');
  }

  private booleanRecord(value: unknown) {
    const input = this.asRecord(value);
    const output: Record<string, boolean> = {};
    Object.entries(input).forEach(([key, val]) => {
      if (typeof val === 'boolean') output[key] = val;
    });
    return output;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private async recordEvent(featureFlagId: string, actor: AuthUser, eventType: FeatureFlagEventType, title: string, message?: string, metadata?: Record<string, unknown>) {
    await this.prisma.featureFlagEvent.create({
      data: {
        featureFlagId,
        actorUserId: this.userId(actor) || undefined,
        eventType,
        title,
        message,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private normalizeRole(role?: string | Role | null): Role {
    const value = String(role || '').toUpperCase();
    if (value === 'SUPERADMIN' || value === 'SUPER_ADMIN') return Role.SUPERADMIN;
    if (value === 'RESIDENT' || value === 'TENANT') return Role.RESIDENT;
    return Role.ADMIN;
  }

  private assertSuperAdmin(user: AuthUser) {
    if (this.normalizeRole(user.role) !== Role.SUPERADMIN) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private normalizeKey(value: string) {
    const key = value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!key) throw new BadRequestException('Feature flag key is required');
    return key;
  }

  private optionalText(value?: string | null) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    return value.trim() || null;
  }

  private optionalDate(value?: string | null) {
    if (value === null || value === '') return null;
    if (value === undefined) return undefined;
    return new Date(value);
  }
}
