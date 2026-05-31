import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContractPricingModel,
  CustomerOnboardingRequestStatus,
  OnboardingStatus,
  OrganizationContractStatus,
  OrganizationLaunchStatus,
  OrganizationSubscriptionStatus,
  Prisma,
  SuperadminBillingTaskPriority,
  SuperadminBillingTaskStatus,
  SuperadminNotificationSeverity,
  SuperadminNotificationStatus,
  SuperadminNotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

type NotificationCandidate = {
  title: string;
  message?: string | null;
  type: SuperadminNotificationType;
  severity: SuperadminNotificationSeverity;
  organizationId?: string | null;
  accessRequestId?: string | null;
  billingTaskId?: string | null;
  contractId?: string | null;
  subscriptionId?: string | null;
  actionUrl?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_NOTIFICATION_STATUSES = [SuperadminNotificationStatus.UNREAD, SuperadminNotificationStatus.READ] as const;
const UNSIGNED_CONTRACT_STATUSES: OrganizationContractStatus[] = [OrganizationContractStatus.DRAFT, OrganizationContractStatus.SENT];
const INACTIVE_SUBSCRIPTION_STATUSES: OrganizationSubscriptionStatus[] = [
  OrganizationSubscriptionStatus.PAUSED,
  OrganizationSubscriptionStatus.SUSPENDED,
  OrganizationSubscriptionStatus.CANCELLED,
];

@Injectable()
export class SuperadminNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: Record<string, string | undefined>) {
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 30), 100);
    const where = this.listWhere(user, query);

    const [items, total, unreadCount, criticalCount, warningCount] = await Promise.all([
      this.prisma.superadminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: this.notificationInclude(),
      }),
      this.prisma.superadminNotification.count({ where }),
      this.prisma.superadminNotification.count({ where: { ...where, status: SuperadminNotificationStatus.UNREAD } }),
      this.prisma.superadminNotification.count({ where: { ...where, severity: SuperadminNotificationSeverity.CRITICAL, status: { not: SuperadminNotificationStatus.ARCHIVED } } }),
      this.prisma.superadminNotification.count({ where: { ...where, severity: SuperadminNotificationSeverity.WARNING, status: { not: SuperadminNotificationStatus.ARCHIVED } } }),
    ]);

    return {
      notifications: items.map((item) => this.toNotification(item)),
      items: items.map((item) => this.toNotification(item)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unreadCount,
      criticalCount,
      warningCount,
    };
  }

  async summary(user: AuthUser) {
    const visible = this.visibleWhere(user);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const activeWhere = { ...visible, status: { not: SuperadminNotificationStatus.ARCHIVED } };

    const [unreadCount, criticalCount, warningCount, latestNotifications, todayCount, thisWeekCount] = await Promise.all([
      this.prisma.superadminNotification.count({ where: { ...visible, status: SuperadminNotificationStatus.UNREAD } }),
      this.prisma.superadminNotification.count({ where: { ...activeWhere, severity: SuperadminNotificationSeverity.CRITICAL } }),
      this.prisma.superadminNotification.count({ where: { ...activeWhere, severity: SuperadminNotificationSeverity.WARNING } }),
      this.prisma.superadminNotification.findMany({
        where: activeWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: this.notificationInclude(),
      }),
      this.prisma.superadminNotification.count({ where: { ...activeWhere, createdAt: { gte: todayStart } } }),
      this.prisma.superadminNotification.count({ where: { ...activeWhere, createdAt: { gte: weekStart } } }),
    ]);

    return {
      unreadCount,
      criticalCount,
      warningCount,
      latestNotifications: latestNotifications.map((item) => this.toNotification(item)),
      todayCount,
      thisWeekCount,
    };
  }

  async markRead(user: AuthUser, id: string) {
    await this.ensureVisible(user, id);
    const notification = await this.prisma.superadminNotification.update({
      where: { id },
      data: {
        status: SuperadminNotificationStatus.READ,
        readAt: new Date(),
      },
      include: this.notificationInclude(),
    });
    await this.logNotificationActivity(user, notification, 'NOTIFICATION_READ');
    return this.toNotification(notification);
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.superadminNotification.updateMany({
      where: { ...this.visibleWhere(user), status: SuperadminNotificationStatus.UNREAD },
      data: { status: SuperadminNotificationStatus.READ, readAt: new Date() },
    });
    await this.audit.record({
      actorId: this.userId(user) || null,
      actorRole: user.role || null,
      action: 'NOTIFICATION_READ',
      entityType: 'NOTIFICATION',
      title: 'Toate notificările marcate citite',
      description: `${result.count} notificări Superadmin au fost marcate ca citite.`,
      severity: 'INFO',
      after: { updated: result.count },
      actionUrl: '/ro/superadmin/notifications',
    }).catch(() => null);
    return { updated: result.count };
  }

  async archive(user: AuthUser, id: string) {
    await this.ensureVisible(user, id);
    const notification = await this.prisma.superadminNotification.update({
      where: { id },
      data: {
        status: SuperadminNotificationStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: this.notificationInclude(),
    });
    await this.logNotificationActivity(user, notification, 'NOTIFICATION_ARCHIVED');
    return this.toNotification(notification);
  }

  async generate(user?: AuthUser) {
    const candidates = await this.generateCandidates();
    const created: any[] = [];
    let kept = 0;

    for (const candidate of candidates) {
      const existing = await this.prisma.superadminNotification.findFirst({
        where: {
          type: candidate.type,
          status: { in: [...ACTIVE_NOTIFICATION_STATUSES] },
          organizationId: candidate.organizationId || null,
          accessRequestId: candidate.accessRequestId || null,
          billingTaskId: candidate.billingTaskId || null,
          contractId: candidate.contractId || null,
          subscriptionId: candidate.subscriptionId || null,
        },
        select: { id: true },
      });
      if (existing) {
        kept += 1;
        continue;
      }

      const notification = await this.prisma.superadminNotification.create({
        data: {
          title: candidate.title,
          message: candidate.message || null,
          type: candidate.type,
          severity: candidate.severity,
          organizationId: candidate.organizationId || null,
          accessRequestId: candidate.accessRequestId || null,
          billingTaskId: candidate.billingTaskId || null,
          contractId: candidate.contractId || null,
          subscriptionId: candidate.subscriptionId || null,
          actionUrl: candidate.actionUrl || null,
          metadataJson: candidate.metadataJson || Prisma.JsonNull,
        },
        include: this.notificationInclude(),
      });
      await this.logNotificationActivity(user || {}, notification, 'NOTIFICATION_CREATED');
      created.push(this.toNotification(notification));
    }

    return {
      created: created.length,
      kept,
      candidates: candidates.length,
      notifications: created,
      message: `Au fost generate ${created.length} notificări noi. ${kept} notificări existente au fost păstrate.`,
    };
  }

  private async generateCandidates(): Promise<NotificationCandidate[]> {
    const [accessRequests, organizations, urgentTasks] = await Promise.all([
      this.prisma.customerOnboardingRequest.findMany({
        where: { status: { in: [CustomerOnboardingRequestStatus.NEW, CustomerOnboardingRequestStatus.QUALIFIED] } },
        select: {
          id: true,
          status: true,
          fullName: true,
          phone: true,
          associationName: true,
          city: true,
          createdAt: true,
        },
      }),
      this.prisma.organization.findMany({
        where: { isDemo: false },
        select: {
          id: true,
          name: true,
          legalName: true,
          fiscalCode: true,
          city: true,
          onboardingStatus: true,
          launchStatus: true,
          createdAt: true,
          launchedAt: true,
          commercialContracts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              endDate: true,
              pricingModel: true,
              pricePerApartment: true,
              fixedMonthlyPrice: true,
            },
          },
          subscriptionContracts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              planName: true,
              price: true,
              trialEndDate: true,
              nextBillingDate: true,
            },
          },
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.superadminBillingTask.findMany({
        where: {
          priority: SuperadminBillingTaskPriority.URGENT,
          status: { in: [SuperadminBillingTaskStatus.OPEN, SuperadminBillingTaskStatus.IN_PROGRESS] },
        },
        include: {
          organization: { select: { id: true, name: true, city: true } },
          relatedContract: { select: { id: true } },
          relatedSubscription: { select: { id: true } },
        },
      }),
    ]);

    const candidates: NotificationCandidate[] = [];
    for (const request of accessRequests) {
      if (request.status === CustomerOnboardingRequestStatus.NEW) {
        candidates.push({
          type: SuperadminNotificationType.ACCESS_REQUEST_NEW,
          severity: SuperadminNotificationSeverity.INFO,
          title: `Cerere nouă de acces: ${request.associationName || request.fullName}`,
          message: `${request.fullName} · ${request.phone} · ${request.city || 'Oraș lipsă'}`,
          accessRequestId: request.id,
          actionUrl: `/ro/superadmin/access-requests/${request.id}`,
          metadataJson: { createdAt: request.createdAt },
        });
      }
      if (request.status === CustomerOnboardingRequestStatus.QUALIFIED) {
        candidates.push({
          type: SuperadminNotificationType.ACCESS_REQUEST_UPDATED,
          severity: SuperadminNotificationSeverity.SUCCESS,
          title: `Lead calificat: ${request.associationName || request.fullName}`,
          message: 'Cererea de acces este calificată și poate continua spre onboarding.',
          accessRequestId: request.id,
          actionUrl: `/ro/superadmin/access-requests/${request.id}`,
        });
      }
    }

    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * DAY_MS);
    const thirtyDays = new Date(now.getTime() + 30 * DAY_MS);
    for (const organization of organizations) {
      const contract = organization.commercialContracts[0] || null;
      const subscription = organization.subscriptionContracts[0] || null;
      const name = organization.name || organization.legalName || 'Organizație fără nume';

      if (organization.onboardingStatus === OnboardingStatus.BLOCKED) {
        candidates.push({
          type: SuperadminNotificationType.ONBOARDING_BLOCKED,
          severity: SuperadminNotificationSeverity.CRITICAL,
          title: `Onboarding blocat: ${name}`,
          message: 'Organizația are onboarding blocat și are nevoie de intervenție.',
          organizationId: organization.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}/onboarding`,
        });
      }
      if (organization.onboardingStatus === OnboardingStatus.READY_FOR_LAUNCH) {
        candidates.push({
          type: SuperadminNotificationType.ONBOARDING_READY,
          severity: SuperadminNotificationSeverity.SUCCESS,
          title: `Organizație gata de lansare: ${name}`,
          message: 'Checklist-ul de onboarding indică pregătire pentru lansare.',
          organizationId: organization.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}/onboarding`,
        });
      }
      if (organization.launchStatus === OrganizationLaunchStatus.LIVE) {
        candidates.push({
          type: SuperadminNotificationType.ORGANIZATION_LAUNCHED,
          severity: SuperadminNotificationSeverity.SUCCESS,
          title: `Organizație live: ${name}`,
          message: 'Organizația este marcată LIVE.',
          organizationId: organization.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}`,
          metadataJson: { launchedAt: organization.launchedAt },
        });
      }
      if (organization.launchStatus === OrganizationLaunchStatus.LIVE && !this.isContractActive(contract?.status || null)) {
        candidates.push({
          type: SuperadminNotificationType.LIVE_WITHOUT_CONTRACT,
          severity: SuperadminNotificationSeverity.CRITICAL,
          title: `LIVE fără contract activ: ${name}`,
          message: 'Organizația este live, dar contractul comercial nu este activ sau semnat.',
          organizationId: organization.id,
          contractId: contract?.id || null,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (!contract) {
        candidates.push({
          type: SuperadminNotificationType.CONTRACT_MISSING,
          severity: SuperadminNotificationSeverity.WARNING,
          title: `Contract lipsă: ${name}`,
          message: 'Nu există contract comercial pentru această organizație.',
          organizationId: organization.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (contract && UNSIGNED_CONTRACT_STATUSES.includes(contract.status)) {
        candidates.push({
          type: SuperadminNotificationType.CONTRACT_UNSIGNED,
          severity: SuperadminNotificationSeverity.WARNING,
          title: `Contract nesemnat: ${name}`,
          message: `Contractul este ${contract.status}, dar nu este semnat/activ.`,
          organizationId: organization.id,
          contractId: contract.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (contract?.endDate && new Date(contract.endDate) < now) {
        candidates.push({
          type: SuperadminNotificationType.CONTRACT_EXPIRED,
          severity: SuperadminNotificationSeverity.ERROR,
          title: `Contract expirat: ${name}`,
          message: 'Contractul comercial are data de expirare depășită.',
          organizationId: organization.id,
          contractId: contract.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      } else if (contract?.endDate && this.isBetween(contract.endDate, now, thirtyDays)) {
        candidates.push({
          type: SuperadminNotificationType.CONTRACT_EXPIRING,
          severity: SuperadminNotificationSeverity.WARNING,
          title: `Contractul expiră curând: ${name}`,
          message: 'Contractul expiră în următoarele 30 de zile.',
          organizationId: organization.id,
          contractId: contract.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (subscription?.status === OrganizationSubscriptionStatus.PAST_DUE) {
        candidates.push({
          type: SuperadminNotificationType.SUBSCRIPTION_PAST_DUE,
          severity: SuperadminNotificationSeverity.CRITICAL,
          title: `Abonament past due: ${name}`,
          message: 'Abonamentul are status PAST_DUE.',
          organizationId: organization.id,
          subscriptionId: subscription.id,
          contractId: contract?.id || null,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (subscription && INACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
        candidates.push({
          type: SuperadminNotificationType.SUBSCRIPTION_INACTIVE,
          severity: SuperadminNotificationSeverity.ERROR,
          title: `Abonament inactiv: ${name}`,
          message: `Abonamentul are status ${subscription.status}.`,
          organizationId: organization.id,
          subscriptionId: subscription.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (subscription?.status === OrganizationSubscriptionStatus.TRIAL && subscription.trialEndDate && this.isBetween(subscription.trialEndDate, now, sevenDays)) {
        candidates.push({
          type: SuperadminNotificationType.TRIAL_ENDING,
          severity: SuperadminNotificationSeverity.WARNING,
          title: `Trial se termină curând: ${name}`,
          message: 'Trialul expiră în următoarele 7 zile.',
          organizationId: organization.id,
          subscriptionId: subscription.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
        });
      }
      if (organization.launchStatus !== OrganizationLaunchStatus.LIVE && organization._count.documents === 0) {
        candidates.push({
          type: SuperadminNotificationType.DOCUMENTS_MISSING,
          severity: SuperadminNotificationSeverity.WARNING,
          title: `Documente lipsă pentru lansare: ${name}`,
          message: 'Nu există documente încărcate pentru pregătirea lansării.',
          organizationId: organization.id,
          actionUrl: `/ro/superadmin/organizations/${organization.id}/onboarding`,
        });
      }
      if (contract && !this.hasPricing(contract, subscription)) {
        candidates.push({
          type: SuperadminNotificationType.CONTRACT_MISSING,
          severity: SuperadminNotificationSeverity.WARNING,
          title: `Tarif comercial incomplet: ${name}`,
          message: 'Contractul nu are tarif suficient pentru calculul lunar.',
          organizationId: organization.id,
          contractId: contract.id,
          subscriptionId: subscription?.id || null,
          actionUrl: `/ro/superadmin/organizations/${organization.id}?tab=contract`,
          metadataJson: { reason: 'PRICING_MISSING' },
        });
      }
    }

    for (const task of urgentTasks) {
      const organizationName = task.organization?.name || 'organizație neatribuită';
      candidates.push({
        type: SuperadminNotificationType.BILLING_TASK_URGENT,
        severity: SuperadminNotificationSeverity.CRITICAL,
        title: `Task urgent de facturare: ${task.title}`,
        message: `Task urgent pentru ${organizationName}.`,
        organizationId: task.organizationId || null,
        billingTaskId: task.id,
        contractId: task.relatedContractId || null,
        subscriptionId: task.relatedSubscriptionId || null,
        actionUrl: '/ro/superadmin/billing-tasks',
      });
    }

    return candidates;
  }

  private listWhere(user: AuthUser, query: Record<string, string | undefined>): Prisma.SuperadminNotificationWhereInput {
    const where: Prisma.SuperadminNotificationWhereInput = {
      ...this.visibleWhere(user),
    };
    const status = this.enumFilter(query.status, SuperadminNotificationStatus);
    const type = this.enumFilter(query.type, SuperadminNotificationType);
    const severity = this.enumFilter(query.severity, SuperadminNotificationSeverity);
    const search = this.stringValue(query.search);

    if (status) where.status = status;
    else where.status = { not: SuperadminNotificationStatus.ARCHIVED };
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { message: { contains: search, mode: 'insensitive' } },
            { organization: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { organization: { is: { legalName: { contains: search, mode: 'insensitive' } } } },
            { organization: { is: { fiscalCode: { contains: search, mode: 'insensitive' } } } },
            { accessRequest: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
            { accessRequest: { is: { associationName: { contains: search, mode: 'insensitive' } } } },
          ],
        },
      ];
    }
    return where;
  }

  private visibleWhere(user: AuthUser): Prisma.SuperadminNotificationWhereInput {
    const userId = this.userId(user);
    return {
      OR: [
        { createdForId: null },
        ...(userId ? [{ createdForId: userId }] : []),
      ],
    };
  }

  private notificationInclude() {
    return {
      organization: { select: { id: true, name: true, legalName: true, fiscalCode: true, city: true } },
      accessRequest: { select: { id: true, fullName: true, associationName: true, phone: true, city: true } },
      billingTask: { select: { id: true, title: true, status: true, priority: true } },
      contract: { select: { id: true, status: true, contractNumber: true } },
      subscription: { select: { id: true, status: true, planName: true } },
    } satisfies Prisma.SuperadminNotificationInclude;
  }

  private toNotification(notification: any) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      severity: notification.severity,
      status: notification.status,
      isRead: notification.status !== SuperadminNotificationStatus.UNREAD,
      organizationId: notification.organizationId,
      accessRequestId: notification.accessRequestId,
      billingTaskId: notification.billingTaskId,
      contractId: notification.contractId,
      subscriptionId: notification.subscriptionId,
      actionUrl: notification.actionUrl,
      metadataJson: notification.metadataJson,
      createdForId: notification.createdForId,
      readAt: notification.readAt,
      archivedAt: notification.archivedAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      organization: notification.organization ? {
        id: notification.organization.id,
        name: notification.organization.name,
        legalName: notification.organization.legalName,
        apcCode: notification.organization.fiscalCode,
        city: notification.organization.city,
      } : null,
      accessRequest: notification.accessRequest || null,
      billingTask: notification.billingTask || null,
      contract: notification.contract || null,
      subscription: notification.subscription || null,
    };
  }

  private async logNotificationActivity(user: AuthUser, notification: any, action: 'NOTIFICATION_CREATED' | 'NOTIFICATION_READ' | 'NOTIFICATION_ARCHIVED') {
    await this.audit.record({
      actorId: action === 'NOTIFICATION_CREATED' ? this.userId(user) || null : this.userId(user) || null,
      actorRole: user.role || (action === 'NOTIFICATION_CREATED' ? 'SYSTEM' : null),
      organizationId: notification.organizationId || null,
      accessRequestId: notification.accessRequestId || null,
      billingTaskId: notification.billingTaskId || null,
      contractId: notification.contractId || null,
      subscriptionId: notification.subscriptionId || null,
      notificationId: notification.id,
      action,
      entityType: 'NOTIFICATION',
      entityId: notification.id,
      title: action === 'NOTIFICATION_CREATED'
        ? 'Notificare creată'
        : action === 'NOTIFICATION_READ'
          ? 'Notificare marcată citită'
          : 'Notificare arhivată',
      description: notification.title,
      severity: action === 'NOTIFICATION_ARCHIVED' ? 'INFO' : notification.severity || 'INFO',
      after: {
        id: notification.id,
        type: notification.type,
        severity: notification.severity,
        status: notification.status,
        actionUrl: notification.actionUrl,
      },
      actionUrl: notification.actionUrl || '/ro/superadmin/notifications',
    }).catch(() => null);
  }

  private async ensureVisible(user: AuthUser, id: string) {
    const notification = await this.prisma.superadminNotification.findFirst({
      where: { id, ...this.visibleWhere(user) },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Notificarea nu a fost găsită.');
  }

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private isContractActive(status: OrganizationContractStatus | null) {
    return status === OrganizationContractStatus.SIGNED || status === OrganizationContractStatus.ACTIVE;
  }

  private hasPricing(contract: any, subscription: any) {
    if (contract.pricingModel === ContractPricingModel.PER_APARTMENT) return this.decimalToNumber(contract.pricePerApartment) > 0;
    if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY) return this.decimalToNumber(contract.fixedMonthlyPrice) > 0;
    if (contract.pricingModel === ContractPricingModel.CUSTOM) return Number(subscription?.price || 0) > 0;
    return false;
  }

  private isBetween(value: Date | string, from: Date, to: Date) {
    const date = new Date(value);
    return date >= from && date <= to;
  }

  private stringValue(value: unknown) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  private enumFilter<T extends Record<string, string>>(value: unknown, source: T): T[keyof T] | null {
    const normalized = this.stringValue(value).toUpperCase();
    if (!normalized) return null;
    return (Object.values(source) as string[]).includes(normalized) ? normalized as T[keyof T] : null;
  }

  private positiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : 0;
  }
}
