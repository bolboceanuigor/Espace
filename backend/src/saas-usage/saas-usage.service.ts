import { Injectable } from '@nestjs/common';
import { OrganizationMemberStatus, Prisma, SaasSubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  SAAS_FEATURE_KEYS,
  SAAS_LIMIT_KEYS,
  SaasFeatureKey,
  SaasLimitKey,
  SaasLimitStatus,
  SaasUsageCounts,
  SaasUsageStatus,
} from './saas-usage.types';

const LIMIT_TO_USAGE: Record<SaasLimitKey, keyof SaasUsageCounts> = {
  maxApartments: 'apartmentsCount',
  maxResidents: 'residentsCount',
  maxStaffMembers: 'staffMembersCount',
  maxMeters: 'metersCount',
  maxInvoicesPerMonth: 'invoicesThisMonth',
  maxAnnouncementsPerMonth: 'announcementsThisMonth',
  maxRequestsPerMonth: 'requestsThisMonth',
  maxStorageMB: 'storageUsedMB',
};

const LIMIT_LABELS: Record<SaasLimitKey, string> = {
  maxApartments: 'Apartamente',
  maxResidents: 'Locatari',
  maxStaffMembers: 'Staff',
  maxMeters: 'Contoare',
  maxInvoicesPerMonth: 'Facturi luna curentă',
  maxAnnouncementsPerMonth: 'Anunțuri luna curentă',
  maxRequestsPerMonth: 'Solicitări luna curentă',
  maxStorageMB: 'Storage',
};

const USAGE_KEYS: Record<SaasLimitKey, string> = {
  maxApartments: 'apartments',
  maxResidents: 'residents',
  maxStaffMembers: 'staffMembers',
  maxMeters: 'meters',
  maxInvoicesPerMonth: 'invoicesThisMonth',
  maxAnnouncementsPerMonth: 'announcementsThisMonth',
  maxRequestsPerMonth: 'requestsThisMonth',
  maxStorageMB: 'storage',
};

@Injectable()
export class SaasUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssociationUsage(associationId: string, billingMonth?: string) {
    const month = this.resolveMonth(billingMonth);
    const subscription = await this.getCurrentSubscription(associationId);
    const usage = await this.getMonthlyUsage(associationId, month.key);
    const limits = this.buildLimitStatuses(usage, this.extractLimits(subscription));
    const features = this.extractFeatures(subscription);
    return {
      associationId,
      billingMonth: month.key,
      subscription: subscription ? this.serializeSubscription(subscription) : null,
      usage,
      limits,
      features,
      usageSummary: this.usageSummary(limits, subscription?.status || null),
      warnings: this.buildWarnings(limits, subscription),
    };
  }

  async getUsageForSubscription(subscriptionId: string) {
    const subscription = await this.prisma.saasSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, association: { select: { id: true, name: true, legalName: true, fiscalCode: true } } },
    });
    if (!subscription) return null;
    return this.getAssociationUsage(subscription.associationId);
  }

  calculateUsageLimitStatus(used: number | null, limit: number | null): SaasUsageStatus {
    if (limit === null || limit === undefined || used === null || used === undefined) return 'OK';
    if (limit <= 0) return used > 0 ? 'OVER_LIMIT' : 'OK';
    const percent = (used / limit) * 100;
    if (percent >= 100) return 'OVER_LIMIT';
    if (percent >= 90) return 'NEAR_LIMIT';
    if (percent >= 80) return 'WARNING';
    return 'OK';
  }

  async getFeatureAvailability(associationId: string) {
    const subscription = await this.getCurrentSubscription(associationId);
    return this.extractFeatures(subscription);
  }

  async getPlanLimitSummary(associationId: string) {
    const data = await this.getAssociationUsage(associationId);
    return { limits: data.limits, usageSummary: data.usageSummary, warnings: data.warnings };
  }

  async getMonthlyUsage(associationId: string, month?: string): Promise<SaasUsageCounts> {
    const range = this.monthRange(month);
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
      this.prisma.organizationMember.count({
        where: { organizationId: associationId, status: { in: [OrganizationMemberStatus.ACTIVE, OrganizationMemberStatus.INVITED] } },
      }),
      this.prisma.meter.count({ where: { organizationId: associationId } }),
      this.prisma.invoice.count({ where: { organizationId: associationId, createdAt: { gte: range.start, lt: range.end } } }),
      this.prisma.announcement.count({ where: { organizationId: associationId, createdAt: { gte: range.start, lt: range.end } } }),
      this.prisma.issue.count({ where: { organizationId: associationId, createdAt: { gte: range.start, lt: range.end } } }),
    ]);
    return {
      apartmentsCount,
      residentsCount,
      staffMembersCount,
      metersCount,
      invoicesThisMonth,
      announcementsThisMonth,
      requestsThisMonth,
      storageUsedMB: null,
    };
  }

  async adminSubscriptionSummary(associationId: string) {
    const data = await this.getAssociationUsage(associationId);
    return {
      subscription: data.subscription,
      usageSummary: data.usageSummary,
      limits: data.limits,
      features: data.features,
      warnings: data.warnings,
    };
  }

  async residentSubscriptionWarning(associationId: string) {
    const subscription = await this.getCurrentSubscription(associationId);
    if (!subscription) return null;
    if (!BLOCKING_SUBSCRIPTION_STATUSES.includes(subscription.status)) return null;
    return {
      status: subscription.status,
      message: 'Accesul portalului este limitat temporar.',
    };
  }

  async superadminUsageOverview(query: Record<string, unknown> = {}) {
    const associations = await this.superadminAssociationUsageRows(query);
    const rows = associations.items;
    const planCounts = rows.reduce<Record<string, number>>((acc, row: any) => {
      const key = row.subscription?.planName || 'Fără abonament';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      kpis: {
        overLimit: rows.filter((row: any) => row.usageSummary.overLimitCount > 0).length,
        nearLimit: rows.filter((row: any) => row.usageSummary.overallStatus === 'NEAR_LIMIT').length,
        trialEndingSoon: rows.filter((row: any) => row.subscription?.status === SaasSubscriptionStatus.TRIALING && row.subscription?.trialEndingSoon).length,
        suspended: rows.filter((row: any) => row.subscription?.status === SaasSubscriptionStatus.SUSPENDED).length,
        withoutSubscription: rows.filter((row: any) => !row.subscription).length,
        mostUsedPlans: Object.entries(planCounts).map(([planName, count]) => ({ planName, count })).sort((a, b) => b.count - a.count),
      },
      ...associations,
    };
  }

  async superadminAssociationUsageRows(query: Record<string, unknown> = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = String(query.search || '').trim();
    const planId = String(query.planId || '').trim();
    const subscriptionStatus = String(query.subscriptionStatus || '').trim();
    const overLimitOnly = this.booleanFilter(query.overLimitOnly);
    const nearLimitOnly = this.booleanFilter(query.nearLimitOnly);
    const trialEndingSoon = this.booleanFilter(query.trialEndingSoon);
    const current = await this.prisma.saasSubscription.findMany({
      where: {
        ...(planId ? { planId } : {}),
        ...(subscriptionStatus ? { status: subscriptionStatus as SaasSubscriptionStatus } : {}),
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const currentByAssociation = new Map<string, (typeof current)[number]>();
    for (const subscription of current) {
      if (!currentByAssociation.has(subscription.associationId)) currentByAssociation.set(subscription.associationId, subscription);
    }
    const associations = await this.prisma.organization.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { fiscalCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, legalName: true, fiscalCode: true, status: true },
    });
    const rows = [];
    for (const association of associations) {
      const subscription = currentByAssociation.get(association.id);
      if (planId && !subscription) continue;
      if (subscriptionStatus && !subscription) continue;
      const usage = await this.getAssociationUsage(association.id);
      const row = {
        association,
        subscription: usage.subscription,
        usage: usage.usage,
        limits: usage.limits,
        warnings: usage.warnings,
        usageSummary: usage.usageSummary,
      };
      if (overLimitOnly && row.usageSummary.overLimitCount === 0) continue;
      if (nearLimitOnly && !['WARNING', 'NEAR_LIMIT'].includes(row.usageSummary.overallStatus)) continue;
      if (trialEndingSoon && !row.subscription?.trialEndingSoon) continue;
      rows.push(row);
    }
    return {
      items: rows.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
    };
  }

  async getCurrentSubscription(associationId: string) {
    return this.prisma.saasSubscription.findFirst({
      where: { associationId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  extractLimits(subscription: Awaited<ReturnType<SaasUsageService['getCurrentSubscription']>> | null) {
    if (!subscription) return {};
    const snapshot = this.asRecord(subscription.limitsSnapshot);
    return SAAS_LIMIT_KEYS.reduce<Record<string, number | null>>((acc, key) => {
      const value = snapshot[key] ?? (subscription as any)[key];
      acc[key] = value === null || value === undefined || value === '' ? null : Number(value);
      return acc;
    }, {});
  }

  extractFeatures(subscription: Awaited<ReturnType<SaasUsageService['getCurrentSubscription']>> | null) {
    const snapshot = this.asRecord(subscription?.featuresSnapshot);
    return SAAS_FEATURE_KEYS.reduce<Record<SaasFeatureKey, boolean>>((acc, key) => {
      acc[key] = snapshot[key] === true;
      return acc;
    }, {} as Record<SaasFeatureKey, boolean>);
  }

  private buildLimitStatuses(usage: SaasUsageCounts, limits: Record<string, number | null>): SaasLimitStatus[] {
    return SAAS_LIMIT_KEYS.map((limitKey) => {
      const used = usage[LIMIT_TO_USAGE[limitKey]];
      const limit = limits[limitKey] ?? null;
      const percent = limit === null || used === null ? null : limit <= 0 ? (used > 0 ? 100 : 0) : Math.round((Number(used) / limit) * 100);
      const status = this.calculateUsageLimitStatus(used, limit);
      return {
        key: USAGE_KEYS[limitKey],
        limitKey,
        label: LIMIT_LABELS[limitKey],
        used,
        limit,
        percent,
        status,
        message: this.limitMessage(LIMIT_LABELS[limitKey], Number(used ?? 0), limit, status),
        actionLabel: status === 'OK' ? 'Monitorizează utilizarea' : 'Contactează Superadmin pentru upgrade',
      };
    });
  }

  private buildWarnings(limits: SaasLimitStatus[], subscription: Awaited<ReturnType<SaasUsageService['getCurrentSubscription']>> | null) {
    const warnings = limits.filter((item) => item.status !== 'OK').map(({ key, status, message, actionLabel, used, limit, percent }) => ({
      key,
      status,
      message,
      actionLabel,
      used,
      limit,
      percent,
    }));
    if (!subscription) {
      warnings.unshift({
        key: 'subscription',
        status: 'OVER_LIMIT',
        message: 'Asociația nu are încă un abonament configurat. Contactează Superadmin.',
        actionLabel: 'Contactează Superadmin',
        used: null,
        limit: null,
        percent: null,
      });
      return warnings;
    }
    if (subscription.status === SaasSubscriptionStatus.TRIALING) {
      const days = subscription.trialEndsAt ? this.daysUntil(subscription.trialEndsAt) : null;
      warnings.unshift({
        key: 'trial',
        status: days !== null && days <= 3 ? 'NEAR_LIMIT' : 'WARNING',
        message: days !== null ? `Trial-ul expiră în ${Math.max(0, days)} zile.` : 'Trial activ.',
        actionLabel: 'Contactează Superadmin',
        used: null,
        limit: null,
        percent: null,
      });
    }
    if (subscription.status === SaasSubscriptionStatus.PAST_DUE) {
      warnings.unshift({
        key: 'subscription',
        status: 'WARNING',
        message: 'Abonamentul are status PAST_DUE. Funcțiile rămân disponibile temporar.',
        actionLabel: 'Contactează Superadmin',
        used: null,
        limit: null,
        percent: null,
      });
    }
    if (BLOCKING_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      warnings.unshift({
        key: 'subscription',
        status: 'OVER_LIMIT',
        message: `Abonamentul este ${subscription.status}. Acțiunile de modificare sunt blocate.`,
        actionLabel: 'Contactează Superadmin',
        used: null,
        limit: null,
        percent: null,
      });
    }
    return warnings;
  }

  private usageSummary(limits: SaasLimitStatus[], status: SaasSubscriptionStatus | null) {
    const warningsCount = limits.filter((item) => item.status === 'WARNING' || item.status === 'NEAR_LIMIT').length;
    const overLimitCount = limits.filter((item) => item.status === 'OVER_LIMIT').length;
    const order: SaasUsageStatus[] = ['OK', 'WARNING', 'NEAR_LIMIT', 'OVER_LIMIT'];
    const overallStatus = limits.reduce<SaasUsageStatus>((highest, item) => (order.indexOf(item.status) > order.indexOf(highest) ? item.status : highest), 'OK');
    return {
      overallStatus: status && BLOCKING_SUBSCRIPTION_STATUSES.includes(status) ? 'OVER_LIMIT' : overallStatus,
      warningsCount,
      overLimitCount,
    };
  }

  private serializeSubscription(subscription: NonNullable<Awaited<ReturnType<SaasUsageService['getCurrentSubscription']>>>) {
    const planSnapshot = this.asRecord(subscription.planSnapshot);
    const trialEndingSoon = subscription.status === SaasSubscriptionStatus.TRIALING && subscription.trialEndsAt ? this.daysUntil(subscription.trialEndsAt) <= 7 : false;
    return {
      id: subscription.id,
      status: subscription.status,
      planCode: String(planSnapshot.code || subscription.plan.code),
      planName: String(planSnapshot.name || subscription.plan.name),
      planId: subscription.planId,
      billingCycle: subscription.billingCycle,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndingSoon,
    };
  }

  private limitMessage(label: string, used: number, limit: number | null, status: SaasUsageStatus) {
    if (limit === null) return `${label}: utilizare nelimitată în planul curent.`;
    if (status === 'OVER_LIMIT') return `Ai folosit ${used} din ${limit} ${label.toLowerCase()} disponibile în plan. Limita este atinsă.`;
    return `Ai folosit ${used} din ${limit} ${label.toLowerCase()} disponibile în plan.`;
  }

  private resolveMonth(month?: string) {
    return { key: this.monthRange(month).key };
  }

  private monthRange(month?: string) {
    const raw = String(month || '').match(/^\d{4}-\d{2}$/) ? String(month) : new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = raw.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));
    return { key: raw, start, end };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private booleanFilter(value: unknown) {
    return value === true || value === 'true' || value === '1';
  }

  private daysUntil(date: Date) {
    return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }
}
