import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentStatus,
  DataExportStatus,
  DataQualityBillingImpact,
  DataQualityIssueStatus,
  DataQualitySeverity,
  IssuePriority,
  IssueStatus,
  MeterStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ResidentAccountStatus,
  ResidentInvoiceStatus,
  ResidentPortalAccessStatus,
  SavedViewModule,
  SavedViewScope,
  SavedViewStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MvpUser } from '../security/mvp-auth.guard';
import { CreateSavedViewDto, ToggleSavedViewDto, UpdateModulePreferencesDto, UpdateSavedViewDto } from './dto/saved-view.dto';
import { findSmartList, SMART_LIST_DEFINITIONS, SmartListDefinition } from './smart-list.definitions';

const FILTER_ALLOWLIST: Record<SavedViewModule, string[]> = {
  APARTMENTS: ['search', 'apartmentNumber', 'staircase', 'floor', 'status', 'hasPrimaryContact', 'hasArea', 'hasResidents', 'minBalance', 'maxBalance'],
  RESIDENTS: ['search', 'role', 'status', 'hasApartment', 'isPrimaryContact', 'preferredContactMethod', 'portalAccessStatus', 'withoutContact'],
  INVOICES: ['search', 'billingMonth', 'status', 'apartmentId', 'overdueOnly', 'unpaidOnly', 'dateFrom', 'dateTo'],
  PAYMENTS: ['search', 'status', 'method', 'dateFrom', 'dateTo', 'currentMonth', 'withoutReference'],
  METERS: ['search', 'status', 'type', 'withoutReadings', 'withoutUnit', 'withoutNumber'],
  METER_READINGS: ['search', 'status', 'dateFrom', 'dateTo', 'negativeConsumption', 'currentMonthMissing'],
  REQUESTS: ['search', 'status', 'category', 'priority', 'openOnly', 'residentId', 'apartmentId', 'waitingResident'],
  ANNOUNCEMENTS: ['search', 'status', 'category', 'isPinned', 'importance', 'dateFrom', 'dateTo'],
  DATA_QUALITY: ['search', 'status', 'severity', 'category', 'billingImpact', 'entityType', 'quickFixAvailable'],
  AUDIT_LOG: ['action', 'entityType', 'userId', 'from', 'to', 'search'],
  IMPORTS: ['search', 'status', 'type', 'dateFrom', 'dateTo'],
  EXPORTS: ['search', 'status', 'exportType', 'format', 'dateFrom', 'dateTo'],
  FINANCIAL_REPORTS: ['billingMonth', 'dateFrom', 'dateTo', 'apartmentId', 'status'],
  TEAM_ACTIVITY: ['userId', 'action', 'dateFrom', 'dateTo'],
  SAAS_SUBSCRIPTION: ['status', 'planId', 'dateFrom', 'dateTo'],
  OTHER: ['search'],
};

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: MvpUser, query: Record<string, string | undefined>) {
    const where: Prisma.SavedViewWhereInput = {
      associationId: user.organizationId,
      status: (query.status as SavedViewStatus) || SavedViewStatus.ACTIVE,
      ...(query.module ? { module: query.module as SavedViewModule } : {}),
      ...(query.scope ? { scope: query.scope as SavedViewScope } : {}),
      ...(query.favoritesOnly === 'true' ? { isFavorite: true } : {}),
      OR: [
        { scope: SavedViewScope.TEAM },
        { scope: SavedViewScope.SYSTEM },
        { scope: SavedViewScope.PERSONAL, createdById: user.id },
      ],
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    if (query.includeSystem === 'false') {
      where.scope = { not: SavedViewScope.SYSTEM } as any;
    }
    const items = await this.prisma.savedView.findMany({
      where,
      include: this.include(),
      orderBy: [{ isDefault: 'desc' }, { isFavorite: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
    return { items };
  }

  async create(user: MvpUser, dto: CreateSavedViewDto) {
    this.assertScopeAllowed(user, dto.scope);
    const filters = this.validateFilters(dto.module, dto.filters);
    const item = await this.prisma.savedView.create({
      data: {
        associationId: user.organizationId,
        module: dto.module,
        scope: dto.scope,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        filters: filters as Prisma.InputJsonValue,
        sort: (dto.sort || {}) as Prisma.InputJsonValue,
        columns: (dto.columns || []) as Prisma.InputJsonValue,
        density: dto.density,
        searchQuery: dto.searchQuery,
        isDefault: Boolean(dto.isDefault),
        isFavorite: Boolean(dto.isFavorite),
        isSystem: false,
        createdById: user.id,
        updatedById: user.id,
      },
      include: this.include(),
    });
    if (dto.isDefault) await this.setDefault(user, item.id);
    await this.audit(user, 'SAVED_VIEW_CREATED', item, { module: item.module, scope: item.scope });
    return item;
  }

  async get(user: MvpUser, id: string) {
    const item = await this.findAccessible(user, id);
    return { item };
  }

  async update(user: MvpUser, id: string, dto: UpdateSavedViewDto) {
    const existing = await this.findAccessible(user, id);
    this.assertEditable(user, existing);
    const item = await this.prisma.savedView.update({
      where: { id },
      data: {
        name: dto.name?.trim() || existing.name,
        description: dto.description ?? existing.description,
        filters: dto.filters ? (this.validateFilters(existing.module, dto.filters) as Prisma.InputJsonValue) : undefined,
        sort: dto.sort ? (dto.sort as Prisma.InputJsonValue) : undefined,
        columns: dto.columns ? (dto.columns as Prisma.InputJsonValue) : undefined,
        density: dto.density,
        searchQuery: dto.searchQuery,
        status: dto.status,
        updatedById: user.id,
      },
      include: this.include(),
    });
    await this.audit(user, 'SAVED_VIEW_UPDATED', item, { module: item.module });
    return item;
  }

  async archive(user: MvpUser, id: string) {
    const existing = await this.findAccessible(user, id);
    this.assertEditable(user, existing);
    const item = await this.prisma.savedView.update({
      where: { id },
      data: { status: SavedViewStatus.ARCHIVED, archivedAt: new Date(), archivedById: user.id, isDefault: false },
      include: this.include(),
    });
    await this.audit(user, 'SAVED_VIEW_ARCHIVED', item, { module: item.module });
    return item;
  }

  async duplicate(user: MvpUser, id: string) {
    const existing = await this.findAccessible(user, id);
    const item = await this.prisma.savedView.create({
      data: {
        associationId: user.organizationId,
        module: existing.module,
        scope: SavedViewScope.PERSONAL,
        status: SavedViewStatus.ACTIVE,
        name: `${existing.name} copy`,
        description: existing.description,
        filters: existing.filters as Prisma.InputJsonValue,
        sort: existing.sort as Prisma.InputJsonValue,
        columns: existing.columns as Prisma.InputJsonValue,
        density: existing.density,
        searchQuery: existing.searchQuery,
        isFavorite: true,
        isSystem: false,
        smartListKey: existing.smartListKey,
        createdById: user.id,
        updatedById: user.id,
      },
      include: this.include(),
    });
    await this.audit(user, 'SAVED_VIEW_DUPLICATED', item, { sourceId: id });
    return item;
  }

  async favorite(user: MvpUser, id: string, dto: ToggleSavedViewDto) {
    const existing = await this.findAccessible(user, id);
    if (existing.scope === SavedViewScope.SYSTEM) {
      return this.duplicate(user, id);
    }
    this.assertEditable(user, existing);
    const item = await this.prisma.savedView.update({ where: { id }, data: { isFavorite: dto.value, updatedById: user.id }, include: this.include() });
    await this.audit(user, 'SAVED_VIEW_FAVORITED', item, { value: dto.value });
    return item;
  }

  async setDefault(user: MvpUser, id: string) {
    const existing = await this.findAccessible(user, id);
    await this.prisma.userModulePreferences.upsert({
      where: { userId_associationId_module: { userId: user.id, associationId: user.organizationId, module: existing.module } },
      update: { defaultSavedViewId: existing.id },
      create: { userId: user.id, associationId: user.organizationId, module: existing.module, defaultSavedViewId: existing.id },
    });
    await this.prisma.savedView.updateMany({ where: { associationId: user.organizationId, module: existing.module, createdById: user.id }, data: { isDefault: false } });
    const item = await this.prisma.savedView.update({ where: { id }, data: { isDefault: true }, include: this.include() });
    await this.audit(user, 'SAVED_VIEW_SET_DEFAULT', item, { module: item.module });
    return item;
  }

  async markUsed(user: MvpUser, id: string) {
    const existing = await this.findAccessible(user, id);
    return this.prisma.savedView.update({
      where: { id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      include: this.include(),
    });
  }

  async preferences(user: MvpUser, module: SavedViewModule) {
    const item = await this.prisma.userModulePreferences.findUnique({
      where: { userId_associationId_module: { userId: user.id, associationId: user.organizationId, module } },
      include: { defaultSavedView: true },
    });
    return { item: item || null };
  }

  async updatePreferences(user: MvpUser, module: SavedViewModule, dto: UpdateModulePreferencesDto) {
    if (dto.defaultSavedViewId) await this.findAccessible(user, dto.defaultSavedViewId);
    const item = await this.prisma.userModulePreferences.upsert({
      where: { userId_associationId_module: { userId: user.id, associationId: user.organizationId, module } },
      update: {
        defaultSavedViewId: dto.defaultSavedViewId,
        columns: dto.columns as Prisma.InputJsonValue,
        density: dto.density,
        pageSize: dto.pageSize,
        sort: dto.sort as Prisma.InputJsonValue,
      },
      create: {
        userId: user.id,
        associationId: user.organizationId,
        module,
        defaultSavedViewId: dto.defaultSavedViewId,
        columns: (dto.columns || []) as Prisma.InputJsonValue,
        density: dto.density,
        pageSize: dto.pageSize,
        sort: (dto.sort || {}) as Prisma.InputJsonValue,
      },
      include: { defaultSavedView: true },
    });
    return item;
  }

  async smartLists(user: MvpUser, query: Record<string, string | undefined>) {
    const definitions = SMART_LIST_DEFINITIONS.filter((item) => (!query.module || item.module === query.module) && (!query.search || item.name.toLowerCase().includes(query.search.toLowerCase())));
    const items = await Promise.all(definitions.map(async (definition) => ({ ...definition, count: await this.countSmartList(user.organizationId, definition) })));
    return { items };
  }

  async smartList(user: MvpUser, key: string) {
    const definition = findSmartList(key);
    if (!definition) throw new NotFoundException('Lista inteligentă nu a fost găsită.');
    const [count, previewItems] = await Promise.all([
      this.countSmartList(user.organizationId, definition),
      this.previewSmartList(user.organizationId, definition),
    ]);
    return { smartList: definition, count, previewItems };
  }

  async duplicateSmartList(user: MvpUser, key: string) {
    const definition = findSmartList(key);
    if (!definition) throw new NotFoundException('Lista inteligentă nu a fost găsită.');
    const item = await this.prisma.savedView.create({
      data: {
        associationId: user.organizationId,
        module: definition.module,
        scope: SavedViewScope.PERSONAL,
        name: definition.name,
        description: definition.description,
        filters: this.validateFilters(definition.module, definition.filters) as Prisma.InputJsonValue,
        isFavorite: true,
        smartListKey: key,
        createdById: user.id,
        updatedById: user.id,
      },
      include: this.include(),
    });
    await this.audit(user, 'SMART_LIST_DUPLICATED', item, { smartListKey: key });
    return item;
  }

  private async countSmartList(associationId: string, definition: SmartListDefinition) {
    const filters = definition.filters as any;
    switch (definition.key) {
      case 'APARTMENTS_WITHOUT_PRIMARY_CONTACT':
        return this.prisma.apartment.count({ where: { organizationId: associationId, ownerResidentId: null } });
      case 'APARTMENTS_WITHOUT_AREA':
        return this.prisma.apartment.count({ where: { organizationId: associationId, areaM2: null } });
      case 'APARTMENTS_UNKNOWN_STATUS':
        return this.prisma.apartment.count({ where: { organizationId: associationId, status: ApartmentStatus.EMPTY } });
      case 'APARTMENTS_WITHOUT_RESIDENTS':
        return this.prisma.apartment.count({ where: { organizationId: associationId, apartmentResidents: { none: {} } } });
      case 'RESIDENTS_WITHOUT_CONTACT':
        return this.prisma.residentProfile.count({ where: { organizationId: associationId, phone: null, email: null } });
      case 'RESIDENTS_WITHOUT_APARTMENT':
        return this.prisma.residentProfile.count({ where: { organizationId: associationId, apartmentResidents: { none: {} } } });
      case 'RESIDENTS_WITHOUT_PORTAL_ACCESS':
        return this.prisma.residentProfile.count({ where: { organizationId: associationId, OR: [{ portalAccessStatus: null }, { portalAccessStatus: ResidentPortalAccessStatus.NO_ACCESS }] } });
      case 'RESIDENTS_INVITED_NOT_ACTIVE':
        return this.prisma.residentProfile.count({ where: { organizationId: associationId, portalAccessStatus: ResidentPortalAccessStatus.INVITED } });
      case 'INVOICES_OVERDUE':
        return this.prisma.residentInvoice.count({ where: { organizationId: associationId, dueDate: { lt: new Date() }, status: { in: [ResidentInvoiceStatus.ISSUED, ResidentInvoiceStatus.PARTIAL] } } });
      case 'INVOICES_UNPAID':
        return this.prisma.residentInvoice.count({ where: { organizationId: associationId, status: ResidentInvoiceStatus.ISSUED } });
      case 'INVOICES_PARTIALLY_PAID':
        return this.prisma.residentInvoice.count({ where: { organizationId: associationId, status: ResidentInvoiceStatus.PARTIAL } });
      case 'INVOICES_CANCELLED_VOID':
        return this.prisma.residentInvoice.count({ where: { organizationId: associationId, status: ResidentInvoiceStatus.CANCELLED } });
      case 'PAYMENTS_THIS_MONTH':
        return this.prisma.payment.count({ where: { organizationId: associationId, status: PaymentStatus.CONFIRMED, paidAt: this.currentMonthRange() } });
      case 'PAYMENTS_CANCELLED':
        return this.prisma.payment.count({ where: { organizationId: associationId, status: PaymentStatus.CANCELLED } });
      case 'PAYMENTS_MANUAL_BANK_TRANSFER':
        return this.prisma.payment.count({ where: { organizationId: associationId, method: PaymentMethod.BANK_TRANSFER } });
      case 'METERS_INACTIVE':
        return this.prisma.meter.count({ where: { organizationId: associationId, status: MeterStatus.INACTIVE } });
      case 'METERS_WITHOUT_READINGS':
        return this.prisma.meter.count({ where: { organizationId: associationId, readings: { none: {} } } });
      case 'REQUESTS_OPEN':
        return this.prisma.issue.count({ where: { organizationId: associationId, status: { in: [IssueStatus.NEW, IssueStatus.IN_PROGRESS] } } });
      case 'REQUESTS_URGENT':
        return this.prisma.issue.count({ where: { organizationId: associationId, priority: { in: [IssuePriority.URGENT, IssuePriority.HIGH] } } });
      case 'REQUESTS_WAITING_RESIDENT':
        return this.prisma.issue.count({ where: { organizationId: associationId, status: IssueStatus.WAITING } });
      case 'ANNOUNCEMENTS_PINNED':
        return this.prisma.announcement.count({ where: { organizationId: associationId, isPinned: true } });
      case 'ANNOUNCEMENTS_ARCHIVED':
        return this.prisma.announcement.count({ where: { organizationId: associationId, status: 'ARCHIVED' } });
      case 'DQ_CRITICAL_OPEN':
        return this.prisma.dataQualityIssue.count({ where: { associationId, severity: DataQualitySeverity.CRITICAL, status: DataQualityIssueStatus.OPEN } });
      case 'DQ_WARNINGS_OPEN':
        return this.prisma.dataQualityIssue.count({ where: { associationId, severity: DataQualitySeverity.WARNING, status: DataQualityIssueStatus.OPEN } });
      case 'DQ_BLOCKS_BILLING':
        return this.prisma.dataQualityIssue.count({ where: { associationId, billingImpact: DataQualityBillingImpact.BLOCKS_BILLING, status: DataQualityIssueStatus.OPEN } });
      case 'IMPORTS_FAILED':
        return this.prisma.importJob.count({ where: { organizationId: associationId, status: 'FAILED' as any } });
      case 'EXPORTS_FAILED':
        return this.prisma.dataExportJob.count({ where: { associationId, status: DataExportStatus.FAILED } });
      default:
        return 0;
    }
  }

  private async previewSmartList(associationId: string, definition: SmartListDefinition) {
    switch (definition.module) {
      case SavedViewModule.APARTMENTS:
        return this.prisma.apartment.findMany({ where: this.apartmentWhere(associationId, definition.key), take: 10, select: { id: true, number: true, status: true, areaM2: true } });
      case SavedViewModule.RESIDENTS:
        return this.prisma.residentProfile.findMany({ where: this.residentWhere(associationId, definition.key), take: 10, select: { id: true, firstName: true, lastName: true, phone: true, email: true, portalAccessStatus: true } });
      case SavedViewModule.INVOICES:
        return this.prisma.residentInvoice.findMany({ where: this.invoiceWhere(associationId, definition.key), take: 10, select: { id: true, invoiceNumber: true, status: true, totalDue: true, dueDate: true } });
      case SavedViewModule.DATA_QUALITY:
        return this.prisma.dataQualityIssue.findMany({ where: this.dataQualityWhere(associationId, definition.key), take: 10, select: { id: true, title: true, status: true, severity: true, billingImpact: true } });
      default:
        return [];
    }
  }

  private apartmentWhere(associationId: string, key: string): Prisma.ApartmentWhereInput {
    if (key === 'APARTMENTS_WITHOUT_PRIMARY_CONTACT') return { organizationId: associationId, ownerResidentId: null };
    if (key === 'APARTMENTS_WITHOUT_AREA') return { organizationId: associationId, areaM2: null };
    if (key === 'APARTMENTS_UNKNOWN_STATUS') return { organizationId: associationId, status: ApartmentStatus.EMPTY };
    if (key === 'APARTMENTS_WITHOUT_RESIDENTS') return { organizationId: associationId, apartmentResidents: { none: {} } };
    return { organizationId: associationId };
  }

  private residentWhere(associationId: string, key: string): Prisma.ResidentProfileWhereInput {
    if (key === 'RESIDENTS_WITHOUT_CONTACT') return { organizationId: associationId, phone: null, email: null };
    if (key === 'RESIDENTS_WITHOUT_APARTMENT') return { organizationId: associationId, apartmentResidents: { none: {} } };
    if (key === 'RESIDENTS_WITHOUT_PORTAL_ACCESS') return { organizationId: associationId, OR: [{ portalAccessStatus: null }, { portalAccessStatus: ResidentPortalAccessStatus.NO_ACCESS }] };
    if (key === 'RESIDENTS_INVITED_NOT_ACTIVE') return { organizationId: associationId, portalAccessStatus: ResidentPortalAccessStatus.INVITED };
    return { organizationId: associationId };
  }

  private invoiceWhere(associationId: string, key: string): Prisma.ResidentInvoiceWhereInput {
    if (key === 'INVOICES_OVERDUE') return { organizationId: associationId, dueDate: { lt: new Date() }, status: { in: [ResidentInvoiceStatus.ISSUED, ResidentInvoiceStatus.PARTIAL] } };
    if (key === 'INVOICES_UNPAID') return { organizationId: associationId, status: ResidentInvoiceStatus.ISSUED };
    if (key === 'INVOICES_PARTIALLY_PAID') return { organizationId: associationId, status: ResidentInvoiceStatus.PARTIAL };
    if (key === 'INVOICES_CANCELLED_VOID') return { organizationId: associationId, status: ResidentInvoiceStatus.CANCELLED };
    return { organizationId: associationId };
  }

  private dataQualityWhere(associationId: string, key: string): Prisma.DataQualityIssueWhereInput {
    if (key === 'DQ_CRITICAL_OPEN') return { associationId, severity: DataQualitySeverity.CRITICAL, status: DataQualityIssueStatus.OPEN };
    if (key === 'DQ_WARNINGS_OPEN') return { associationId, severity: DataQualitySeverity.WARNING, status: DataQualityIssueStatus.OPEN };
    if (key === 'DQ_BLOCKS_BILLING') return { associationId, billingImpact: DataQualityBillingImpact.BLOCKS_BILLING, status: DataQualityIssueStatus.OPEN };
    return { associationId };
  }

  private currentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start, lt: end };
  }

  private validateFilters(module: SavedViewModule, filters: Record<string, unknown>) {
    const allowed = FILTER_ALLOWLIST[module] || [];
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filters || {})) {
      if (!allowed.includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      sanitized[key] = value;
    }
    return sanitized;
  }

  private assertScopeAllowed(user: MvpUser, scope: SavedViewScope) {
    if (scope === SavedViewScope.SYSTEM) throw new ForbiddenException('View-urile SYSTEM sunt read-only.');
    if (scope === SavedViewScope.TEAM && !['ADMIN', 'SUPERADMIN'].includes(String(user.role))) {
      throw new ForbiddenException('Doar Admin poate crea view-uri de echipă.');
    }
  }

  private assertEditable(user: MvpUser, item: any) {
    if (item.isSystem || item.scope === SavedViewScope.SYSTEM) throw new ForbiddenException('View-urile SYSTEM sunt read-only.');
    if (item.scope === SavedViewScope.PERSONAL && item.createdById !== user.id) throw new ForbiddenException('Nu poți edita view-ul altui utilizator.');
  }

  private async findAccessible(user: MvpUser, id: string) {
    const item = await this.prisma.savedView.findFirst({
      where: {
        id,
        associationId: user.organizationId,
        OR: [
          { scope: SavedViewScope.TEAM },
          { scope: SavedViewScope.SYSTEM },
          { scope: SavedViewScope.PERSONAL, createdById: user.id },
        ],
      },
      include: this.include(),
    });
    if (!item) throw new NotFoundException('View-ul salvat nu a fost găsit.');
    return item;
  }

  private include() {
    return {
      createdBy: { select: { id: true, fullName: true, email: true } },
      updatedBy: { select: { id: true, fullName: true, email: true } },
    };
  }

  private async audit(user: MvpUser, action: string, item: any, metadata?: unknown) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action,
        entityType: 'SavedView',
        entityId: item.id,
        description: `${action}: ${item.name}`,
        newValuesJson: (metadata || {}) as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
  }
}
