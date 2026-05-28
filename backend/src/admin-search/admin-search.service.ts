import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssociationRoleType,
  OrganizationMemberStatus,
  PlatformRole,
  Prisma,
  Role,
  SavedViewScope,
  SavedViewStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MvpUser } from '../security/mvp-auth.guard';
import { permissionKey, resolvePermissions, type PermissionActionKey, type PermissionModuleKey, type TeamPermissionKey } from '../team/team-permissions';
import { ADMIN_COMMANDS, AdminCommandDefinition } from './admin-command.definitions';
import { SaveAdminSearchHistoryDto } from './dto/admin-search.dto';
import { SMART_LIST_DEFINITIONS } from '../saved-views/smart-list.definitions';

export enum AdminSearchResultType {
  APARTMENT = 'APARTMENT',
  RESIDENT = 'RESIDENT',
  INTERNAL_INVOICE = 'INTERNAL_INVOICE',
  PAYMENT = 'PAYMENT',
  METER = 'METER',
  METER_READING = 'METER_READING',
  REQUEST = 'REQUEST',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  DATA_QUALITY_ISSUE = 'DATA_QUALITY_ISSUE',
  IMPORT_JOB = 'IMPORT_JOB',
  EXPORT_LOG = 'EXPORT_LOG',
  SAVED_VIEW = 'SAVED_VIEW',
  SMART_LIST = 'SMART_LIST',
  BILLING_RUN = 'BILLING_RUN',
  REPORT = 'REPORT',
  TEAM_MEMBER = 'TEAM_MEMBER',
  HELP_ARTICLE = 'HELP_ARTICLE',
  COMMAND = 'COMMAND',
}

type SearchResult = {
  id: string;
  type: AdminSearchResultType;
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

type PermissionContext = {
  isSuperadmin: boolean;
  permissions: Record<string, boolean>;
};

const GROUP_LABELS: Record<AdminSearchResultType, string> = {
  APARTMENT: 'Apartamente',
  RESIDENT: 'Locatari',
  INTERNAL_INVOICE: 'Facturi',
  PAYMENT: 'Plati',
  METER: 'Contoare',
  METER_READING: 'Indici',
  REQUEST: 'Solicitari',
  ANNOUNCEMENT: 'Anunturi',
  DATA_QUALITY_ISSUE: 'Data Quality',
  IMPORT_JOB: 'Importuri',
  EXPORT_LOG: 'Exporturi',
  SAVED_VIEW: 'View-uri salvate',
  SMART_LIST: 'Liste inteligente',
  BILLING_RUN: 'Facturare',
  REPORT: 'Rapoarte',
  TEAM_MEMBER: 'Echipa',
  HELP_ARTICLE: 'Ajutor',
  COMMAND: 'Comenzi rapide',
};

const TYPE_PERMISSIONS: Partial<Record<AdminSearchResultType, { module: PermissionModuleKey; action: PermissionActionKey }>> = {
  APARTMENT: { module: 'APARTMENTS', action: 'VIEW' },
  RESIDENT: { module: 'RESIDENTS', action: 'VIEW' },
  INTERNAL_INVOICE: { module: 'INVOICES', action: 'VIEW' },
  PAYMENT: { module: 'PAYMENTS', action: 'VIEW' },
  METER: { module: 'METERS', action: 'VIEW' },
  METER_READING: { module: 'METER_READINGS', action: 'VIEW' },
  REQUEST: { module: 'REQUESTS', action: 'VIEW' },
  ANNOUNCEMENT: { module: 'ANNOUNCEMENTS', action: 'VIEW' },
  DATA_QUALITY_ISSUE: { module: 'DATA_QUALITY', action: 'VIEW' },
  IMPORT_JOB: { module: 'IMPORTS', action: 'VIEW' },
  EXPORT_LOG: { module: 'EXPORTS', action: 'VIEW' },
  SAVED_VIEW: { module: 'EXPORTS', action: 'VIEW' },
  SMART_LIST: { module: 'EXPORTS', action: 'VIEW' },
  BILLING_RUN: { module: 'BILLING', action: 'VIEW' },
  REPORT: { module: 'REPORTS', action: 'VIEW' },
  TEAM_MEMBER: { module: 'TEAM', action: 'VIEW' },
};

@Injectable()
export class AdminSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchAll(user: MvpUser, query: Record<string, string | undefined>) {
    const q = this.normalizeQuery(query.q || '');
    const limitPerType = this.limit(query.limitPerType);
    const requestedTypes = this.parseTypes(query.types);
    const permissions = await this.permissionsFor(user);
    const groups: Array<{ type: AdminSearchResultType; label: string; items: SearchResult[] }> = [];

    if (q.length < 2) {
      const emptyGroups = await this.emptySearchGroups(user, permissions, query);
      return { query: q, groups: emptyGroups, meta: { total: emptyGroups.reduce((sum, group) => sum + group.items.length, 0), limitPerType } };
    }

    const tasks: Array<Promise<{ type: AdminSearchResultType; items: SearchResult[] }>> = [];
    const add = (type: AdminSearchResultType, fn: () => Promise<SearchResult[]>) => {
      if (requestedTypes.length && !requestedTypes.includes(type)) return;
      if (!this.canSeeType(permissions, type)) return;
      tasks.push(fn().then((items) => ({ type, items })));
    };

    add(AdminSearchResultType.APARTMENT, () => this.searchApartments(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.RESIDENT, () => this.searchResidents(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.INTERNAL_INVOICE, () => this.searchInvoices(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.PAYMENT, () => this.searchPayments(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.METER, () => this.searchMeters(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.METER_READING, () => this.searchMeterReadings(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.REQUEST, () => this.searchRequests(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.ANNOUNCEMENT, () => this.searchAnnouncements(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.DATA_QUALITY_ISSUE, () => this.searchDataQualityIssues(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.IMPORT_JOB, () => this.searchImports(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.EXPORT_LOG, () => this.searchExports(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.SAVED_VIEW, () => this.searchSavedViews(user, q, limitPerType));
    add(AdminSearchResultType.SMART_LIST, () => this.searchSmartLists(q, limitPerType));
    add(AdminSearchResultType.TEAM_MEMBER, () => this.searchTeamMembers(user.organizationId, q, limitPerType));
    add(AdminSearchResultType.HELP_ARTICLE, () => this.searchHelpArticles(q, limitPerType));
    if (query.includeCommands !== 'false') add(AdminSearchResultType.COMMAND, async () => this.commandResults(await this.commands(user), q, limitPerType));

    for (const group of await Promise.all(tasks)) {
      if (group.items.length) groups.push({ type: group.type, label: GROUP_LABELS[group.type], items: group.items });
    }
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    return { query: q, groups, meta: { total, limitPerType } };
  }

  async recent(user: MvpUser) {
    const items = await this.prisma.adminSearchHistory.findMany({
      where: { associationId: user.organizationId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { items };
  }

  async saveRecent(user: MvpUser, dto: SaveAdminSearchHistoryDto) {
    const query = this.normalizeQuery(dto.query || '');
    const selectedUrl = this.safeUrl(dto.selectedUrl);
    if (!query && !selectedUrl) throw new BadRequestException('query or selectedUrl is required');
    const item = await this.prisma.adminSearchHistory.create({
      data: {
        associationId: user.organizationId,
        userId: user.id,
        query: query || null,
        selectedResultType: dto.selectedResultType?.slice(0, 64) || null,
        selectedResultId: dto.selectedResultId?.slice(0, 128) || null,
        selectedResultTitle: dto.selectedResultTitle?.slice(0, 200) || null,
        selectedUrl,
      },
    });
    const extra = await this.prisma.adminSearchHistory.findMany({
      where: { associationId: user.organizationId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: 50,
      select: { id: true },
    });
    if (extra.length) await this.prisma.adminSearchHistory.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });
    return { item };
  }

  async clearRecent(user: MvpUser) {
    await this.prisma.adminSearchHistory.deleteMany({ where: { associationId: user.organizationId, userId: user.id } });
    return { success: true };
  }

  async commands(user: MvpUser) {
    const permissions = await this.permissionsFor(user);
    const items = ADMIN_COMMANDS.map((command) => this.serializeCommand(command, permissions));
    const groups = Array.from(new Set(items.map((item) => item.category))).map((label) => ({
      label,
      items: items.filter((item) => item.category === label),
    }));
    return { groups };
  }

  async executeCommand(user: MvpUser, commandKey: string) {
    const command = ADMIN_COMMANDS.find((item) => item.key === commandKey);
    if (!command) throw new NotFoundException('Command not found');
    const permissions = await this.permissionsFor(user);
    const serialized = this.serializeCommand(command, permissions);
    if (serialized.disabled) throw new ForbiddenException(serialized.disabledReason || 'Command disabled');
    return { type: 'NAVIGATE', url: command.url };
  }

  private async searchApartments(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.apartment.findMany({
      where: {
        organizationId,
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { ownerResident: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] } },
          { apartmentResidents: { some: { resident: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] } } } },
        ],
      },
      select: { id: true, number: true, floor: true, status: true, ownerResident: { select: { firstName: true, lastName: true, phone: true } }, staircase: { select: { name: true } } },
      take,
      orderBy: { number: 'asc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.APARTMENT, item.id, `Apartament ${item.number}`, `Scara ${item.staircase?.name || '-'}${item.floor !== null && item.floor !== undefined ? ` · Etaj ${item.floor}` : ''}`, this.personName(item.ownerResident) ? `Contact principal: ${this.personName(item.ownerResident)}` : undefined, String(item.status), `/admin/apartments/${item.id}`, 'home', this.score(q, item.number), { apartmentNumber: item.number }));
  }

  private async searchResidents(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.residentProfile.findMany({
      where: { organizationId, OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { apartment: { number: { contains: q, mode: 'insensitive' } } }] },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true, apartment: { select: { id: true, number: true } } },
      take,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return items.map((item) => this.result(AdminSearchResultType.RESIDENT, item.id, this.personName(item) || item.email || item.phone || 'Locatar', item.apartment ? `Apartament ${item.apartment.number}` : 'Fara apartament', [item.phone, item.email].filter(Boolean).join(' · ') || undefined, String(item.accountStatus), `/admin/residents/${item.id}`, 'user', this.score(q, `${item.firstName} ${item.lastName} ${item.phone} ${item.email}`), { apartmentNumber: item.apartment?.number }));
  }

  private async searchInvoices(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.residentInvoice.findMany({
      where: { organizationId, OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { apartment: { number: { contains: q, mode: 'insensitive' } } }] },
      select: { id: true, invoiceNumber: true, month: true, year: true, totalDue: true, paymentsAmount: true, status: true, dueDate: true, apartment: { select: { number: true } } },
      take,
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.INTERNAL_INVOICE, item.id, item.invoiceNumber, `Apartament ${item.apartment.number} · ${String(item.month).padStart(2, '0')}.${item.year}`, `Sold estimat: ${Math.max(item.totalDue - item.paymentsAmount, 0).toFixed(2)} MDL`, String(item.status), `/admin/invoices/${item.id}`, 'file-text', this.score(q, item.invoiceNumber), { apartmentNumber: item.apartment.number }));
  }

  private async searchPayments(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const amount = Number(q.replace(',', '.'));
    const items = await this.prisma.payment.findMany({
      where: { organizationId, OR: [{ note: { contains: q, mode: 'insensitive' } }, { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } }, { apartment: { number: { contains: q, mode: 'insensitive' } } }, ...(Number.isFinite(amount) ? [{ amount }] : [])] },
      select: { id: true, amount: true, currency: true, method: true, status: true, paidAt: true, createdAt: true, note: true, apartment: { select: { number: true } }, invoice: { select: { invoiceNumber: true } } },
      take,
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.PAYMENT, item.id, `${item.amount.toFixed(2)} ${item.currency}`, `Apartament ${item.apartment.number}${item.invoice?.invoiceNumber ? ` · ${item.invoice.invoiceNumber}` : ''}`, item.note || `Metoda: ${item.method}`, String(item.status), `/admin/payments/${item.id}`, 'receipt', this.score(q, `${item.amount} ${item.note || ''} ${item.invoice?.invoiceNumber || ''}`)));
  }

  private async searchMeters(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.meter.findMany({
      where: { organizationId, OR: [{ serialNumber: { contains: q, mode: 'insensitive' } }, { apartment: { number: { contains: q, mode: 'insensitive' } } }] },
      select: { id: true, serialNumber: true, type: true, status: true, apartment: { select: { number: true } } },
      take,
      orderBy: { updatedAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.METER, item.id, item.serialNumber || `Contor ${item.type}`, `Apartament ${item.apartment.number}`, `Tip: ${item.type}`, String(item.status), `/admin/meters/${item.id}`, 'gauge', this.score(q, `${item.serialNumber || ''} ${item.apartment.number}`)));
  }

  private async searchMeterReadings(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.meterReading.findMany({
      where: { organizationId, OR: [{ meter: { serialNumber: { contains: q, mode: 'insensitive' } } }, { apartment: { number: { contains: q, mode: 'insensitive' } } }] },
      select: { id: true, value: true, readingDate: true, source: true, apartment: { select: { number: true } }, meter: { select: { serialNumber: true, type: true } } },
      take,
      orderBy: { readingDate: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.METER_READING, item.id, `${item.value} · ${item.meter.serialNumber || item.meter.type}`, `Apartament ${item.apartment.number}`, this.formatDate(item.readingDate), String(item.source), `/admin/meter-readings/${item.id}`, 'activity', this.score(q, `${item.meter.serialNumber || ''} ${item.apartment.number}`)));
  }

  private async searchRequests(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.issue.findMany({
      where: { organizationId, OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { apartment: { number: { contains: q, mode: 'insensitive' } } }, { resident: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] } }] },
      select: { id: true, title: true, category: true, status: true, priority: true, apartment: { select: { number: true } }, resident: { select: { firstName: true, lastName: true } } },
      take,
      orderBy: { updatedAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.REQUEST, item.id, item.title, [item.apartment ? `Apartament ${item.apartment.number}` : null, this.personName(item.resident)].filter(Boolean).join(' · '), `Categorie: ${item.category}`, String(item.status), `/admin/requests/${item.id}`, 'message-square', this.score(q, item.title), { priority: item.priority }));
  }

  private async searchAnnouncements(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.announcement.findMany({
      where: { organizationId, OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, title: true, category: true, status: true, importance: true, isPinned: true },
      take,
      orderBy: { updatedAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.ANNOUNCEMENT, item.id, item.title, `Categorie: ${item.category}`, item.isPinned ? 'Pinned' : undefined, String(item.status), `/admin/announcements/${item.id}`, 'megaphone', this.score(q, item.title), { importance: item.importance }));
  }

  private async searchDataQualityIssues(associationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.dataQualityIssue.findMany({
      where: { associationId, OR: [{ title: { contains: q, mode: 'insensitive' } }, { key: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, title: true, key: true, severity: true, status: true, category: true, actionUrl: true },
      take,
      orderBy: { detectedAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.DATA_QUALITY_ISSUE, item.id, item.title, item.key, `Categorie: ${item.category}`, String(item.severity), item.actionUrl || `/admin/data-quality/issues/${item.id}`, 'shield-alert', this.score(q, `${item.title} ${item.key}`), { status: item.status }));
  }

  private async searchImports(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.importJob.findMany({
      where: { organizationId, OR: [{ fileName: { contains: q, mode: 'insensitive' } }, { type: { equals: q.toUpperCase() as any } }] },
      select: { id: true, fileName: true, type: true, status: true, totalRows: true },
      take,
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.IMPORT_JOB, item.id, item.fileName, `Import ${item.type}`, `${item.totalRows} randuri`, String(item.status), `/admin/imports/${item.id}`, 'upload', this.score(q, item.fileName)));
  }

  private async searchExports(associationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.dataExportJob.findMany({
      where: { associationId, OR: [{ fileName: { contains: q, mode: 'insensitive' } }, { exportType: { equals: q.toUpperCase() as any } }] },
      select: { id: true, fileName: true, exportType: true, status: true, format: true },
      take,
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.EXPORT_LOG, item.id, item.fileName, `${item.exportType} · ${item.format}`, undefined, String(item.status), `/admin/data-exports/${item.id}`, 'download', this.score(q, item.fileName)));
  }

  private async searchSavedViews(user: MvpUser, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.savedView.findMany({
      where: { associationId: user.organizationId, status: SavedViewStatus.ACTIVE, OR: [{ scope: SavedViewScope.TEAM }, { scope: SavedViewScope.SYSTEM }, { scope: SavedViewScope.PERSONAL, createdById: user.id }], AND: [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }] },
      select: { id: true, name: true, description: true, module: true, filters: true, scope: true, isFavorite: true },
      take,
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    });
    return items.map((item) => this.result(AdminSearchResultType.SAVED_VIEW, item.id, item.name, `${item.module} · ${item.scope}`, item.description || undefined, item.isFavorite ? 'Favorit' : undefined, this.moduleUrl(item.module, item.filters as Record<string, unknown>), 'bookmark', this.score(q, item.name) + (item.isFavorite ? 10 : 0)));
  }

  private async searchSmartLists(q: string, take: number): Promise<SearchResult[]> {
    return SMART_LIST_DEFINITIONS.filter((item) => this.matches(q, `${item.key} ${item.name} ${item.description} ${item.module}`)).slice(0, take).map((item) => this.result(AdminSearchResultType.SMART_LIST, item.key, item.name, item.module, item.description, item.severity, this.moduleUrl(item.module, item.filters), 'sparkles', this.score(q, item.name)));
  }

  private async searchTeamMembers(organizationId: string, q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.organizationMember.findMany({
      where: { organizationId, OR: [{ user: { fullName: { contains: q, mode: 'insensitive' } } }, { user: { email: { contains: q, mode: 'insensitive' } } }] },
      select: { id: true, role: true, status: true, user: { select: { id: true, fullName: true, email: true } }, associationRole: { select: { name: true } } },
      take,
      orderBy: { updatedAt: 'desc' },
    });
    return items.map((item) => this.result(AdminSearchResultType.TEAM_MEMBER, item.id, item.user.fullName || item.user.email, item.user.email, item.associationRole?.name || item.role, String(item.status), `/admin/team/${item.id}`, 'users', this.score(q, `${item.user.fullName || ''} ${item.user.email}`)));
  }

  private async searchHelpArticles(q: string, take: number): Promise<SearchResult[]> {
    const items = await this.prisma.helpArticle.findMany({
      where: { isPublished: true, status: 'PUBLISHED' as any, OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, title: true, slug: true, excerpt: true, type: true },
      take,
      orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
    });
    return items.map((item) => this.result(AdminSearchResultType.HELP_ARTICLE, item.id, item.title, String(item.type), item.excerpt || undefined, 'Ajutor', `/admin/help/${item.slug}`, 'help-circle', this.score(q, item.title)));
  }

  private async emptySearchGroups(user: MvpUser, permissions: PermissionContext, query: Record<string, string | undefined>) {
    const groups: Array<{ type: AdminSearchResultType; label: string; items: SearchResult[] }> = [];
    if (query.includeRecent !== 'false') {
      const recent = await this.prisma.adminSearchHistory.findMany({ where: { associationId: user.organizationId, userId: user.id, selectedUrl: { not: null } }, orderBy: { createdAt: 'desc' }, take: 6 });
      const items = recent.map((item) => this.result((item.selectedResultType as AdminSearchResultType) || AdminSearchResultType.COMMAND, item.id, item.selectedResultTitle || item.query || 'Recent', item.query ? `Cautare: ${item.query}` : undefined, undefined, 'Recent', item.selectedUrl || '/admin/search', 'clock', 50));
      if (items.length) groups.push({ type: AdminSearchResultType.COMMAND, label: 'Recente', items });
    }
    if (this.canSeeType(permissions, AdminSearchResultType.SAVED_VIEW)) {
      const favorites = await this.prisma.savedView.findMany({ where: { associationId: user.organizationId, status: SavedViewStatus.ACTIVE, isFavorite: true, OR: [{ scope: SavedViewScope.TEAM }, { scope: SavedViewScope.SYSTEM }, { scope: SavedViewScope.PERSONAL, createdById: user.id }] }, take: 6, orderBy: { lastUsedAt: 'desc' } });
      const items = favorites.map((item) => this.result(AdminSearchResultType.SAVED_VIEW, item.id, item.name, item.module, item.description || undefined, 'Favorit', this.moduleUrl(item.module, item.filters as Record<string, unknown>), 'bookmark', 70));
      if (items.length) groups.push({ type: AdminSearchResultType.SAVED_VIEW, label: 'View-uri favorite', items });
    }
    const commandItems = this.commandResults(await this.commandsFromPermissions(permissions), '', 8);
    if (commandItems.length) groups.push({ type: AdminSearchResultType.COMMAND, label: 'Comenzi rapide', items: commandItems });
    return groups;
  }

  private async permissionsFor(user: MvpUser): Promise<PermissionContext> {
    const role = String(user.role || '').toUpperCase();
    const platformRole = String((user as any).platformRole || '').toUpperCase();
    if (role === Role.SUPERADMIN || platformRole === PlatformRole.SUPER_ADMIN) return { isSuperadmin: true, permissions: {} };
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId: user.organizationId, userId: user.id },
      include: { associationRole: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!member && role === Role.ADMIN) return { isSuperadmin: true, permissions: {} };
    if (!member || member.status !== OrganizationMemberStatus.ACTIVE) return { isSuperadmin: false, permissions: {} };
    if (member.associationRole?.type === AssociationRoleType.ASSOCIATION_OWNER || member.associationRole?.type === AssociationRoleType.ASSOCIATION_ADMIN) return { isSuperadmin: true, permissions: {} };
    if (!member.associationRole && member.role === 'ORG_ADMIN') return { isSuperadmin: true, permissions: {} };
    if (member.associationRole) {
      return {
        isSuperadmin: false,
        permissions: member.associationRole.rolePermissions.reduce<Record<string, boolean>>((acc, item) => {
          acc[permissionKey(item.permission.module as PermissionModuleKey, item.permission.action as PermissionActionKey)] = item.allowed;
          return acc;
        }, {}),
      };
    }
    return { isSuperadmin: false, permissions: resolvePermissions(member.role, member.permissionsJson) };
  }

  private can(permissions: PermissionContext, permission?: { module: PermissionModuleKey; action: PermissionActionKey }) {
    if (!permission) return true;
    if (permissions.isSuperadmin) return true;
    return permissions.permissions[permissionKey(permission.module, permission.action)] === true;
  }

  private canSeeType(permissions: PermissionContext, type: AdminSearchResultType) {
    return this.can(permissions, TYPE_PERMISSIONS[type]);
  }

  private serializeCommand(command: AdminCommandDefinition, permissions: PermissionContext) {
    const allowed = this.can(permissions, command.requiredPermission) && this.can(permissions, command.extraPermission);
    return { ...command, danger: Boolean(command.danger), disabled: !allowed, disabledReason: allowed ? null : 'Nu ai permisiunea necesara pentru aceasta comanda.' };
  }

  private async commandsFromPermissions(permissions: PermissionContext) {
    const items = ADMIN_COMMANDS.map((command) => this.serializeCommand(command, permissions));
    const groups = Array.from(new Set(items.map((item) => item.category))).map((label) => ({ label, items: items.filter((item) => item.category === label) }));
    return { groups };
  }

  private commandResults(commands: { groups: Array<{ items: any[] }> }, q: string, take: number): SearchResult[] {
    return commands.groups.flatMap((group) => group.items).filter((item) => !q || this.matches(q, `${item.key} ${item.title} ${item.subtitle}`)).slice(0, take).map((item) => this.result(AdminSearchResultType.COMMAND, item.key, item.title, item.category, item.subtitle, item.disabled ? 'Fara permisiune' : undefined, item.url, item.icon || 'command', item.disabled ? 10 : 90, { commandKey: item.key, disabled: item.disabled, disabledReason: item.disabledReason }));
  }

  private result(type: AdminSearchResultType, id: string, title: string, subtitle: string | undefined, description: string | undefined, badge: string | undefined, url: string, icon: string, score: number, metadata?: Record<string, unknown>): SearchResult {
    return { id, type, title, subtitle, description, badge, status: badge, url, icon, score, metadata };
  }

  private moduleUrl(module: string, filters: Record<string, unknown> = {}) {
    const base: Record<string, string> = {
      APARTMENTS: '/admin/apartments',
      RESIDENTS: '/admin/residents',
      INVOICES: '/admin/invoices',
      PAYMENTS: '/admin/payments',
      METERS: '/admin/meters',
      METER_READINGS: '/admin/meter-readings',
      REQUESTS: '/admin/requests',
      ANNOUNCEMENTS: '/admin/announcements',
      DATA_QUALITY: '/admin/data-quality/issues',
      IMPORTS: '/admin/imports',
      EXPORTS: '/admin/data-exports',
      FINANCIAL_REPORTS: '/admin/reports/financial',
    };
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    const qs = params.toString();
    return `${base[module] || '/admin'}${qs ? `?${qs}` : ''}`;
  }

  private parseTypes(value?: string) {
    if (!value) return [];
    return value.split(',').map((item) => item.trim().toUpperCase()).filter((item): item is AdminSearchResultType => item in AdminSearchResultType);
  }

  private limit(value?: string) {
    const parsed = Number(value || 8);
    return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 12) : 8;
  }

  private normalizeQuery(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().slice(0, 100);
  }

  private matches(q: string, value: string) {
    return this.normalizeQuery(value).toLowerCase().includes(q.toLowerCase());
  }

  private score(q: string, value: string) {
    const a = this.normalizeQuery(value).toLowerCase();
    const b = q.toLowerCase();
    if (a === b) return 100;
    if (a.startsWith(b)) return 80;
    if (a.includes(b)) return 60;
    return 40;
  }

  private personName(person?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null) {
    if (!person) return '';
    return person.fullName || [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
  }

  private safeUrl(value?: string) {
    if (!value) return null;
    const url = value.trim().slice(0, 300);
    return url.startsWith('/admin') ? url : null;
  }
}
