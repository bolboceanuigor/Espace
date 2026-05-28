import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveSuperadminSearchHistoryDto } from './dto/superadmin-search.dto';
import { SUPERADMIN_COMMANDS } from './superadmin-command.definitions';

export enum SuperadminSearchResultType {
  CLIENT_ACCOUNT = 'CLIENT_ACCOUNT',
  ASSOCIATION = 'ASSOCIATION',
  USER = 'USER',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  SAAS_PLAN = 'SAAS_PLAN',
  SAAS_SUBSCRIPTION = 'SAAS_SUBSCRIPTION',
  SAAS_INVOICE = 'SAAS_INVOICE',
  UPGRADE_REQUEST = 'UPGRADE_REQUEST',
  SUPPORT_SESSION = 'SUPPORT_SESSION',
  AUDIT_LOG = 'AUDIT_LOG',
  SECURITY_EVENT = 'SECURITY_EVENT',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  PLATFORM_SERVICE = 'PLATFORM_SERVICE',
  BACKUP_CHECK = 'BACKUP_CHECK',
  RECOVERY_DRILL = 'RECOVERY_DRILL',
  PRODUCTION_INCIDENT = 'PRODUCTION_INCIDENT',
  LEGAL_DOCUMENT = 'LEGAL_DOCUMENT',
  HELP_ARTICLE = 'HELP_ARTICLE',
  DATA_REQUEST = 'DATA_REQUEST',
  DATA_EXPORT = 'DATA_EXPORT',
  COMMAND = 'COMMAND',
}

type Result = {
  id: string;
  type: SuperadminSearchResultType;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  status?: string;
  url: string;
  icon: string;
  score: number;
  metadata?: Record<string, unknown>;
};

const LABELS: Record<SuperadminSearchResultType, string> = {
  CLIENT_ACCOUNT: 'Client pipeline',
  ASSOCIATION: 'Asociatii',
  USER: 'Utilizatori',
  CUSTOMER_REQUEST: 'Cereri clienti',
  SAAS_PLAN: 'Planuri SaaS',
  SAAS_SUBSCRIPTION: 'Abonamente SaaS',
  SAAS_INVOICE: 'Facturi SaaS',
  UPGRADE_REQUEST: 'Upgrade requests',
  SUPPORT_SESSION: 'Support sessions',
  AUDIT_LOG: 'Audit log',
  SECURITY_EVENT: 'Securitate',
  SYSTEM_ERROR: 'Erori sistem',
  PLATFORM_SERVICE: 'Servicii platforma',
  BACKUP_CHECK: 'Backup checks',
  RECOVERY_DRILL: 'Recovery drills',
  PRODUCTION_INCIDENT: 'Incidente productie',
  LEGAL_DOCUMENT: 'Legal',
  HELP_ARTICLE: 'Help',
  DATA_REQUEST: 'Cereri date',
  DATA_EXPORT: 'Exporturi date',
  COMMAND: 'Comenzi rapide',
};

@Injectable()
export class SuperadminSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAll(user: any, query: Record<string, string | undefined>) {
    this.assertSuperadmin(user);
    const q = this.normalize(query.q || '');
    const limit = this.limit(query.limitPerType);
    const requestedTypes = this.parseTypes(query.types);
    if (q.length < 2) {
      const groups = await this.emptyGroups(user, query);
      return { query: q, groups, meta: { total: groups.reduce((sum, group) => sum + group.items.length, 0), limitPerType: limit } };
    }
    const tasks: Array<Promise<{ type: SuperadminSearchResultType; items: Result[] }>> = [];
    const add = (type: SuperadminSearchResultType, fn: () => Promise<Result[]>) => {
      if (requestedTypes.length && !requestedTypes.includes(type)) return;
      tasks.push(fn().then((items) => ({ type, items })));
    };

    add(SuperadminSearchResultType.CLIENT_ACCOUNT, () => this.searchClientAccounts(q, limit));
    add(SuperadminSearchResultType.ASSOCIATION, () => this.searchAssociations(q, limit));
    add(SuperadminSearchResultType.USER, () => this.searchUsers(q, limit));
    add(SuperadminSearchResultType.CUSTOMER_REQUEST, () => this.searchCustomerRequests(q, limit));
    add(SuperadminSearchResultType.SAAS_PLAN, () => this.searchSaasPlans(q, limit));
    add(SuperadminSearchResultType.SAAS_SUBSCRIPTION, () => this.searchSaasSubscriptions(q, limit));
    add(SuperadminSearchResultType.SAAS_INVOICE, () => this.searchSaasInvoices(q, limit));
    add(SuperadminSearchResultType.UPGRADE_REQUEST, () => this.searchUpgradeRequests(q, limit));
    add(SuperadminSearchResultType.SUPPORT_SESSION, () => this.searchSupportSessions(q, limit));
    add(SuperadminSearchResultType.AUDIT_LOG, () => this.searchAuditLogs(q, limit));
    add(SuperadminSearchResultType.SYSTEM_ERROR, () => this.searchSystemErrors(q, limit));
    add(SuperadminSearchResultType.PLATFORM_SERVICE, () => this.searchPlatformServices(q, limit));
    add(SuperadminSearchResultType.BACKUP_CHECK, () => this.searchBackupChecks(q, limit));
    add(SuperadminSearchResultType.RECOVERY_DRILL, () => this.searchRecoveryDrills(q, limit));
    add(SuperadminSearchResultType.PRODUCTION_INCIDENT, () => this.searchIncidents(q, limit));
    add(SuperadminSearchResultType.LEGAL_DOCUMENT, () => this.searchLegalDocuments(q, limit));
    add(SuperadminSearchResultType.HELP_ARTICLE, () => this.searchHelpArticles(q, limit));
    add(SuperadminSearchResultType.DATA_REQUEST, () => this.searchDataRequests(q, limit));
    add(SuperadminSearchResultType.DATA_EXPORT, () => this.searchDataExports(q, limit));
    if (query.includeCommands !== 'false') add(SuperadminSearchResultType.COMMAND, async () => this.commandResults(q, limit));

    const groups = (await Promise.all(tasks))
      .filter((group) => group.items.length)
      .map((group) => ({ ...group, label: LABELS[group.type] }));
    return { query: q, groups, meta: { total: groups.reduce((sum, group) => sum + group.items.length, 0), limitPerType: limit } };
  }

  async recent(user: any) {
    this.assertSuperadmin(user);
    const items = await this.prisma.superadminSearchHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { items };
  }

  async saveRecent(user: any, dto: SaveSuperadminSearchHistoryDto) {
    this.assertSuperadmin(user);
    const query = this.normalize(dto.query || '');
    const selectedUrl = this.safeUrl(dto.selectedUrl);
    if (!query && !selectedUrl) throw new BadRequestException('query or selectedUrl is required');
    const item = await this.prisma.superadminSearchHistory.create({
      data: {
        userId: user.id,
        query: query || null,
        selectedResultType: dto.selectedResultType?.slice(0, 64) || null,
        selectedResultId: dto.selectedResultId?.slice(0, 128) || null,
        selectedResultTitle: dto.selectedResultTitle?.slice(0, 200) || null,
        selectedUrl,
      },
    });
    const extra = await this.prisma.superadminSearchHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, skip: 50, select: { id: true } });
    if (extra.length) await this.prisma.superadminSearchHistory.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });
    return { item };
  }

  async clearRecent(user: any) {
    this.assertSuperadmin(user);
    await this.prisma.superadminSearchHistory.deleteMany({ where: { userId: user.id } });
    return { success: true };
  }

  commands(user: any) {
    this.assertSuperadmin(user);
    const items = SUPERADMIN_COMMANDS.map((item) => ({ ...item, disabled: false, disabledReason: null, danger: Boolean(item.danger) }));
    const groups = Array.from(new Set(items.map((item) => item.category))).map((label) => ({ label, items: items.filter((item) => item.category === label) }));
    return { groups };
  }

  executeCommand(user: any, commandKey: string) {
    this.assertSuperadmin(user);
    const command = SUPERADMIN_COMMANDS.find((item) => item.key === commandKey);
    if (!command) throw new NotFoundException('Command not found');
    return { type: 'NAVIGATE', url: command.url };
  }

  async clientNavigator(user: any, associationId: string) {
    this.assertSuperadmin(user);
    const association = await this.prisma.organization.findUnique({
      where: { id: associationId },
      select: { id: true, name: true, legalName: true, fiscalCode: true, address: true, city: true, status: true, subscriptionStatus: true, subscriptionPlan: true, createdAt: true },
    });
    if (!association) throw new NotFoundException('Association not found');
    const [
      subscription,
      apartments,
      residents,
      staff,
      invoices,
      payments,
      meters,
      requests,
      announcements,
      saasInvoices,
      activeSupportSessions,
      recentSupportSessions,
      auditLogs,
      systemErrors,
      customerRequest,
      clientAccount,
      dataQualityIssues,
    ] = await Promise.all([
      this.prisma.saasSubscription.findFirst({ where: { associationId }, include: { plan: { select: { name: true, code: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.apartment.count({ where: { organizationId: associationId } }),
      this.prisma.residentProfile.count({ where: { organizationId: associationId } }),
      this.prisma.organizationMember.count({ where: { organizationId: associationId } }),
      this.prisma.residentInvoice.count({ where: { organizationId: associationId } }),
      this.prisma.payment.count({ where: { organizationId: associationId } }),
      this.prisma.meter.count({ where: { organizationId: associationId } }),
      this.prisma.issue.count({ where: { organizationId: associationId } }),
      this.prisma.announcement.count({ where: { organizationId: associationId } }),
      this.prisma.saasInvoice.findMany({ where: { associationId }, select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paidAmount: true, balanceAmount: true, dueDate: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.supportSession.count({ where: { organizationId: associationId, isActive: true } }),
      this.prisma.supportSession.findMany({ where: { organizationId: associationId }, select: { id: true, mode: true, status: true, startedAt: true, reason: true }, orderBy: { startedAt: 'desc' }, take: 5 }),
      this.prisma.auditLog.findMany({ where: { OR: [{ organizationId: associationId }, { effectiveAssociationId: associationId }] }, select: { id: true, action: true, entityType: true, description: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.systemErrorEvent.findMany({ where: { associationId }, select: { id: true, severity: true, message: true, route: true, lastSeenAt: true }, orderBy: { lastSeenAt: 'desc' }, take: 5 }),
      this.prisma.customerOnboardingRequest.findFirst({ where: { OR: [{ convertedAssociationId: associationId }, { associationCode: association.fiscalCode || undefined }, { associationName: { contains: association.name, mode: 'insensitive' } }] }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientAccount.findFirst({ where: { associationId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.dataQualityIssue.count({ where: { associationId, status: 'OPEN' as any } }),
    ]);
    const totalIssued = saasInvoices.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalPaid = saasInvoices.reduce((sum, item) => sum + item.paidAmount, 0);
    const outstandingBalance = saasInvoices.reduce((sum, item) => sum + item.balanceAmount, 0);
    const now = new Date();
    return {
      association: {
        id: association.id,
        legalName: association.legalName,
        shortName: association.name,
        associationCode: association.fiscalCode,
        status: association.status,
        address: [association.address, association.city].filter(Boolean).join(', '),
        createdAt: association.createdAt,
      },
      subscription: {
        planName: subscription?.plan?.name || association.subscriptionPlan,
        status: subscription?.status || association.subscriptionStatus,
        billingCycle: subscription?.billingCycle,
        trialEndsAt: subscription?.trialEndsAt,
        currentPeriodEnd: subscription?.currentPeriodEnd,
      },
      usage: { apartments, residents, staff, invoices, payments, meters, requests, announcements, dataQualityOpenIssues: dataQualityIssues },
      saasBilling: { totalIssued, totalPaid, outstandingBalance, overdueInvoices: saasInvoices.filter((item) => item.balanceAmount > 0 && item.dueDate < now).length, recentInvoices: saasInvoices },
      support: { activeSessions: activeSupportSessions, recentSessions: recentSupportSessions },
      security: { recentAuditLogs: auditLogs, recentSystemErrors: systemErrors, criticalErrors: systemErrors.filter((item) => String(item.severity) === 'CRITICAL').length },
      customerLifecycle: customerRequest ? { id: customerRequest.id, status: customerRequest.status, associationName: customerRequest.associationName, createdAt: customerRequest.createdAt } : null,
      clientLifecycle: clientAccount ? { id: clientAccount.id, lifecycleStage: clientAccount.lifecycleStage, status: clientAccount.status, priority: clientAccount.priority, riskLevel: clientAccount.riskLevel, ownerUserId: clientAccount.ownerUserId, nextFollowUpAt: clientAccount.nextFollowUpAt } : null,
      quickLinks: [
        { label: 'Open association', url: `/superadmin/associations/${associationId}` },
        ...(clientAccount ? [{ label: 'Client lifecycle', url: `/superadmin/clients/${clientAccount.id}` }] : []),
        { label: 'Subscription', url: `/superadmin/associations/${associationId}/subscription` },
        { label: 'SaaS invoices', url: `/superadmin/associations/${associationId}/saas-invoices` },
        { label: 'Data export', url: `/superadmin/associations/${associationId}/data-export` },
        { label: 'Monitoring', url: '/superadmin/monitoring' },
      ],
    };
  }

  private searchClientAccounts(q: string, take: number) {
    return this.prisma.clientAccount.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { contactName: { contains: q, mode: 'insensitive' } },
          { contactPhone: { contains: q, mode: 'insensitive' } },
          { contactEmail: { contains: q, mode: 'insensitive' } },
          { associationName: { contains: q, mode: 'insensitive' } },
          { associationCode: { contains: q, mode: 'insensitive' } },
        ],
      },
      take,
      orderBy: { updatedAt: 'desc' },
    }).then((items) => items.map((item) => this.result('CLIENT_ACCOUNT', item.id, item.displayName, [item.associationCode ? `Cod ${item.associationCode}` : null, item.lifecycleStage].filter(Boolean).join(' · '), item.contactName || item.contactPhone || item.contactEmail || undefined, String(item.riskLevel), `/superadmin/clients/${item.id}`, 'kanban', this.score(q, `${item.displayName} ${item.associationCode || ''} ${item.contactName || ''} ${item.contactPhone || ''}`), { associationId: item.associationId, associationCode: item.associationCode })));
  }

  private searchAssociations(q: string, take: number) {
    return this.prisma.organization.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { legalName: { contains: q, mode: 'insensitive' } }, { fiscalCode: { contains: q, mode: 'insensitive' } }, { address: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, name: true, legalName: true, fiscalCode: true, city: true, status: true, subscriptionPlan: true, subscriptionStatus: true },
      take,
      orderBy: { updatedAt: 'desc' },
    }).then((items) => items.map((item) => this.result('ASSOCIATION', item.id, item.name || item.legalName || 'Asociatie', [item.fiscalCode ? `Cod ${item.fiscalCode}` : null, item.city].filter(Boolean).join(' · '), `Plan ${item.subscriptionPlan} · ${item.subscriptionStatus}`, String(item.status), `/superadmin/client-navigator/${item.id}`, 'building', this.score(q, `${item.name} ${item.legalName || ''} ${item.fiscalCode || ''}`), { associationCode: item.fiscalCode })));
  }

  private searchUsers(q: string, take: number) {
    return this.prisma.user.findMany({
      where: { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, fullName: true, firstName: true, lastName: true, email: true, phone: true, role: true, isActive: true, organization: { select: { name: true, fiscalCode: true } } },
      take,
      orderBy: { updatedAt: 'desc' },
    }).then((items) => items.map((item) => this.result('USER', item.id, item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email, `${item.email} · ${item.role}`, item.organization ? `${item.organization.name}${item.organization.fiscalCode ? ` · ${item.organization.fiscalCode}` : ''}` : undefined, item.isActive ? 'ACTIVE' : 'INACTIVE', `/superadmin/admins`, 'user', this.score(q, `${item.fullName || ''} ${item.email} ${item.phone || ''}`))));
  }

  private searchCustomerRequests(q: string, take: number) {
    return this.prisma.customerOnboardingRequest.findMany({
      where: { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { associationName: { contains: q, mode: 'insensitive' } }, { associationCode: { contains: q, mode: 'insensitive' } }] },
      take,
      orderBy: { createdAt: 'desc' },
    }).then((items) => items.map((item) => this.result('CUSTOMER_REQUEST', item.id, item.associationName, `${item.fullName} · ${item.phone}`, item.email || item.message || undefined, String(item.status), `/superadmin/customer-requests/${item.id}`, 'inbox', this.score(q, `${item.associationName} ${item.associationCode || ''} ${item.phone} ${item.email || ''}`))));
  }

  private searchSaasPlans(q: string, take: number) {
    return this.prisma.saasPlan.findMany({ where: { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { updatedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('SAAS_PLAN', item.id, item.name, item.code, `${item.monthlyPrice} ${item.currency}/luna`, String(item.status), `/superadmin/billing/plans/${item.id}`, 'layers', this.score(q, `${item.code} ${item.name}`))));
  }

  private searchSaasSubscriptions(q: string, take: number) {
    return this.prisma.saasSubscription.findMany({ where: { OR: [{ association: { name: { contains: q, mode: 'insensitive' } } }, { association: { fiscalCode: { contains: q, mode: 'insensitive' } } }, { plan: { name: { contains: q, mode: 'insensitive' } } }] }, include: { association: { select: { name: true, fiscalCode: true } }, plan: { select: { name: true } } }, take, orderBy: { updatedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('SAAS_SUBSCRIPTION', item.id, item.association.name, `${item.plan.name} · ${item.billingCycle}`, item.association.fiscalCode || undefined, String(item.status), `/superadmin/billing/subscriptions/${item.id}`, 'repeat', this.score(q, `${item.association.name} ${item.association.fiscalCode || ''} ${item.plan.name}`))));
  }

  private searchSaasInvoices(q: string, take: number) {
    return this.prisma.saasInvoice.findMany({ where: { OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { billingMonth: { contains: q, mode: 'insensitive' } }, { association: { name: { contains: q, mode: 'insensitive' } } }, { association: { fiscalCode: { contains: q, mode: 'insensitive' } } }] }, include: { association: { select: { name: true, fiscalCode: true } } }, take, orderBy: { createdAt: 'desc' } })
      .then((items) => items.map((item) => this.result('SAAS_INVOICE', item.id, item.invoiceNumber, item.association.name, `${item.balanceAmount.toFixed(2)} ${item.currency} sold`, String(item.status), `/superadmin/billing/saas-invoices/${item.id}`, 'file-text', this.score(q, `${item.invoiceNumber} ${item.association.name} ${item.association.fiscalCode || ''}`))));
  }

  private searchUpgradeRequests(q: string, take: number) {
    return this.prisma.saasUpgradeRequest.findMany({ where: { OR: [{ association: { name: { contains: q, mode: 'insensitive' } } }, { association: { fiscalCode: { contains: q, mode: 'insensitive' } } }, { message: { contains: q, mode: 'insensitive' } }] }, include: { association: { select: { name: true, fiscalCode: true } }, currentPlan: { select: { name: true } }, requestedPlan: { select: { name: true } } }, take, orderBy: { createdAt: 'desc' } })
      .then((items) => items.map((item) => this.result('UPGRADE_REQUEST', item.id, item.association.name, `${item.currentPlan?.name || 'Plan curent'} -> ${item.requestedPlan?.name || 'Plan cerut'}`, item.message || undefined, String(item.status), `/superadmin/billing/upgrade-requests/${item.id}`, 'arrow-up-right', this.score(q, `${item.association.name} ${item.association.fiscalCode || ''} ${item.message || ''}`))));
  }

  private searchSupportSessions(q: string, take: number) {
    return this.prisma.supportSession.findMany({ where: { OR: [{ reason: { contains: q, mode: 'insensitive' } }, { internalTicketRef: { contains: q, mode: 'insensitive' } }, { organization: { name: { contains: q, mode: 'insensitive' } } }, { organization: { fiscalCode: { contains: q, mode: 'insensitive' } } }] }, include: { organization: { select: { name: true, fiscalCode: true } } }, take, orderBy: { startedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('SUPPORT_SESSION', item.id, item.organization.name, `${item.mode} · ${item.status}`, item.reason || item.internalTicketRef || undefined, item.isActive ? 'ACTIVE' : String(item.status), `/superadmin/support-mode`, 'life-buoy', this.score(q, `${item.organization.name} ${item.organization.fiscalCode || ''} ${item.reason || ''}`))));
  }

  private searchAuditLogs(q: string, take: number) {
    return this.prisma.auditLog.findMany({ where: { OR: [{ action: { contains: q, mode: 'insensitive' } }, { entityType: { contains: q, mode: 'insensitive' } }, { entityId: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { organization: { name: { contains: q, mode: 'insensitive' } } }] }, include: { organization: { select: { name: true } }, user: { select: { email: true, fullName: true } } }, take, orderBy: { createdAt: 'desc' } })
      .then((items) => items.map((item) => this.result('AUDIT_LOG', item.id, item.action, `${item.entityType}${item.organization?.name ? ` · ${item.organization.name}` : ''}`, item.user?.fullName || item.user?.email || item.description, 'AUDIT', `/superadmin/audit-logs`, 'shield', this.score(q, `${item.action} ${item.description} ${item.entityId || ''}`))));
  }

  private searchSystemErrors(q: string, take: number) {
    return this.prisma.systemErrorEvent.findMany({ where: { OR: [{ message: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }, { route: { contains: q, mode: 'insensitive' } }, { requestId: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { lastSeenAt: 'desc' } })
      .then((items) => items.map((item) => this.result('SYSTEM_ERROR', item.id, item.message.slice(0, 120), item.route || item.code || item.requestId || undefined, `Aparitii: ${item.occurrenceCount}`, String(item.severity), `/superadmin/monitoring/errors/${item.id}`, 'bug', this.score(q, `${item.message} ${item.code || ''} ${item.requestId || ''}`))));
  }

  private searchPlatformServices(q: string, take: number) {
    return this.prisma.platformService.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { providerName: { contains: q, mode: 'insensitive' } }, { purpose: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { updatedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('PLATFORM_SERVICE', item.id, item.name, `${item.providerName} · ${item.type}`, item.purpose, String(item.status), `/superadmin/launch/services/${item.id}`, 'server', this.score(q, `${item.name} ${item.providerName} ${item.purpose}`))));
  }

  private searchBackupChecks(q: string, take: number) {
    return this.prisma.backupCheck.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { providerName: { contains: q, mode: 'insensitive' } }, { backupReference: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { checkedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('BACKUP_CHECK', item.id, item.title, `${item.scope} · ${item.providerName || 'manual'}`, item.notes || undefined, String(item.status), `/superadmin/backup/backup-checks`, 'database-backup', this.score(q, `${item.title} ${item.providerName || ''}`))));
  }

  private searchRecoveryDrills(q: string, take: number) {
    return this.prisma.recoveryDrill.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { createdAt: 'desc' } })
      .then((items) => items.map((item) => this.result('RECOVERY_DRILL', item.id, item.title, `${item.scope} · ${item.scenario || 'drill'}`, item.resultSummary || undefined, String(item.status), `/superadmin/backup/recovery-drills/${item.id}`, 'rotate-ccw', this.score(q, `${item.title} ${item.description}`))));
  }

  private searchIncidents(q: string, take: number) {
    return this.prisma.productionIncident.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { rootCause: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { startedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('PRODUCTION_INCIDENT', item.id, item.title, `${item.severity} · ${item.status}`, item.description, String(item.status), `/superadmin/backup/incidents/${item.id}`, 'triangle-alert', this.score(q, `${item.title} ${item.description}`))));
  }

  private searchLegalDocuments(q: string, take: number) {
    return this.prisma.legalDocument.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { updatedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('LEGAL_DOCUMENT', item.id, item.title, `${item.type} · v${item.version}`, item.description || undefined, String(item.status), `/superadmin/legal/documents/${item.id}`, 'scale', this.score(q, `${item.title} ${item.slug}`))));
  }

  private searchHelpArticles(q: string, take: number) {
    return this.prisma.helpArticle.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }] }, take, orderBy: { updatedAt: 'desc' } })
      .then((items) => items.map((item) => this.result('HELP_ARTICLE', item.id, item.title, `${item.type} · ${item.locale}`, item.excerpt || undefined, String(item.status), `/superadmin/help/articles/${item.id}`, 'help-circle', this.score(q, `${item.title} ${item.slug}`))));
  }

  private searchDataRequests(q: string, take: number) {
    return this.prisma.dataRequest.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { message: { contains: q, mode: 'insensitive' } }, { requesterEmail: { contains: q, mode: 'insensitive' } }, { association: { name: { contains: q, mode: 'insensitive' } } }] }, include: { association: { select: { name: true } } }, take, orderBy: { createdAt: 'desc' } })
      .then((items) => items.map((item) => this.result('DATA_REQUEST', item.id, item.title, `${item.type} · ${item.scope}`, item.association?.name || item.requesterEmail || undefined, String(item.status), `/superadmin/data-requests/${item.id}`, 'file-search', this.score(q, `${item.title} ${item.message} ${item.requesterEmail || ''}`))));
  }

  private searchDataExports(q: string, take: number) {
    return this.prisma.dataExportJob.findMany({ where: { OR: [{ fileName: { contains: q, mode: 'insensitive' } }, { association: { name: { contains: q, mode: 'insensitive' } } }] }, include: { association: { select: { name: true } } }, take, orderBy: { createdAt: 'desc' } })
      .then((items) => items.map((item) => this.result('DATA_EXPORT', item.id, item.fileName, `${item.exportType} · ${item.format}`, item.association?.name || undefined, String(item.status), `/superadmin/data-exports/${item.id}`, 'download', this.score(q, `${item.fileName} ${item.association?.name || ''}`))));
  }

  private async emptyGroups(user: any, query: Record<string, string | undefined>) {
    const groups: Array<{ type: SuperadminSearchResultType; label: string; items: Result[] }> = [];
    if (query.includeRecent !== 'false') {
      const recent = await this.prisma.superadminSearchHistory.findMany({ where: { userId: user.id, selectedUrl: { not: null } }, orderBy: { createdAt: 'desc' }, take: 6 });
      if (recent.length) groups.push({ type: SuperadminSearchResultType.COMMAND, label: 'Recente', items: recent.map((item) => this.result((item.selectedResultType as any) || 'COMMAND', item.id, item.selectedResultTitle || item.query || 'Recent', item.query ? `Cautare: ${item.query}` : undefined, undefined, 'Recent', item.selectedUrl || '/superadmin/search', 'clock', 50)) });
    }
    const [support, requests, dueServices] = await Promise.all([
      this.prisma.supportSession.findMany({ where: { isActive: true }, include: { organization: { select: { name: true } } }, take: 4, orderBy: { startedAt: 'desc' } }),
      this.prisma.customerOnboardingRequest.findMany({ where: { status: 'NEW' as any }, take: 4, orderBy: { createdAt: 'desc' } }),
      this.prisma.platformService.findMany({ where: { nextPaymentDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, take: 4, orderBy: { nextPaymentDate: 'asc' } }),
    ]);
    if (support.length) groups.push({ type: SuperadminSearchResultType.SUPPORT_SESSION, label: 'Support activ', items: support.map((item) => this.result('SUPPORT_SESSION', item.id, item.organization.name, `${item.mode} · ${item.status}`, item.reason || undefined, 'ACTIVE', '/superadmin/support-mode', 'life-buoy', 60)) });
    if (requests.length) groups.push({ type: SuperadminSearchResultType.CUSTOMER_REQUEST, label: 'Cereri clienti noi', items: requests.map((item) => this.result('CUSTOMER_REQUEST', item.id, item.associationName, `${item.fullName} · ${item.phone}`, item.email || undefined, String(item.status), `/superadmin/customer-requests/${item.id}`, 'inbox', 60)) });
    if (dueServices.length) groups.push({ type: SuperadminSearchResultType.PLATFORM_SERVICE, label: 'Servicii de verificat', items: dueServices.map((item) => this.result('PLATFORM_SERVICE', item.id, item.name, item.providerName, item.impactIfDown, String(item.status), `/superadmin/launch/services/${item.id}`, 'server', 60)) });
    groups.push({ type: SuperadminSearchResultType.COMMAND, label: 'Comenzi rapide', items: this.commandResults('', 8) });
    return groups;
  }

  private commandResults(q: string, take: number) {
    return SUPERADMIN_COMMANDS.filter((item) => !q || this.matches(q, `${item.key} ${item.title} ${item.subtitle}`)).slice(0, take).map((item) => this.result('COMMAND', item.key, item.title, item.category, item.subtitle, undefined, item.url, item.icon, 90, { commandKey: item.key }));
  }

  private result(type: keyof typeof SuperadminSearchResultType | SuperadminSearchResultType, id: string, title: string, subtitle: string | undefined, description: string | undefined, badge: string | undefined, url: string, icon: string, score: number, metadata?: Record<string, unknown>): Result {
    const normalizedType = typeof type === 'string' ? type as SuperadminSearchResultType : type;
    return { id, type: normalizedType, title, subtitle, description, badge, status: badge, url, icon, score, metadata };
  }

  private parseTypes(value?: string) {
    if (!value) return [];
    return value.split(',').map((item) => item.trim().toUpperCase()).filter((item): item is SuperadminSearchResultType => item in SuperadminSearchResultType);
  }

  private limit(value?: string) {
    const parsed = Number(value || 8);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 12) : 8;
  }

  private normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().slice(0, 100);
  }

  private matches(q: string, value: string) {
    return this.normalize(value).toLowerCase().includes(q.toLowerCase());
  }

  private score(q: string, value: string) {
    const a = this.normalize(value).toLowerCase();
    const b = q.toLowerCase();
    if (a === b) return 100;
    if (a.startsWith(b)) return 80;
    if (a.includes(b)) return 60;
    return 40;
  }

  private safeUrl(value?: string) {
    if (!value) return null;
    const url = value.trim().slice(0, 300);
    return url.startsWith('/superadmin') ? url : null;
  }

  private assertSuperadmin(user: any) {
    const role = String(user?.role || '').toUpperCase();
    const platformRole = String(user?.platformRole || '').toUpperCase();
    if (role !== Role.SUPERADMIN && platformRole !== 'SUPER_ADMIN') throw new BadRequestException('Superadmin required');
  }
}
