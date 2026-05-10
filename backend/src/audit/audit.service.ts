import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

type AuditActor = {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type LogActionInput = AuditActor & {
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  oldValuesJson?: unknown;
  newValuesJson?: unknown;
};

type AuditSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

type AuditLogCreateInput = {
  associationId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  billingRunId?: string | null;
  invoiceDraftId?: string | null;
  invoiceId?: string | null;
  apartmentId?: string | null;
  residentId?: string | null;
  title: string;
  message: string;
  metadata?: unknown;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  severity?: AuditSeverity;
  actionUrl?: string | null;
};

type AuditQuery = {
  action?: string;
  entityType?: string;
  severity?: string;
  actorUserId?: string;
  userId?: string;
  billingRunId?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortDirection?: string;
};

type AuditRow = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { id: true; firstName: true; lastName: true; email: true; role: true } };
    organization: { select: { id: true; name: true } };
  };
}>;

const SENSITIVE_KEY_PATTERN = /(password|token|jwt|secret|resettoken)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item));
  if (!isRecord(value)) return value;
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[masked]' : sanitizeAuditValue(entry);
    return acc;
  }, {});
}

function asJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return sanitizeAuditValue(value) as Prisma.InputJsonValue;
}

function payloadObject(value: unknown): Record<string, any> {
  return isRecord(value) ? value : {};
}

function actorName(user?: AuditRow['user'] | null) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'Administrator';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private auditPayload(input: AuditLogCreateInput) {
    return {
      title: input.title,
      message: input.message,
      severity: input.severity || 'INFO',
      actionUrl: input.actionUrl || null,
      billingRunId: input.billingRunId || null,
      invoiceDraftId: input.invoiceDraftId || null,
      invoiceId: input.invoiceId || null,
      apartmentId: input.apartmentId || null,
      residentId: input.residentId || null,
      actorRole: input.actorRole || null,
      metadata: sanitizeAuditValue(input.metadata || {}),
      afterSnapshot: input.afterSnapshot === undefined ? null : sanitizeAuditValue(input.afterSnapshot),
    };
  }

  async createLog(input: AuditLogCreateInput, tx?: Prisma.TransactionClient | PrismaService) {
    if (!input.actorUserId) return null;
    return this.logAction(
      {
        userId: input.actorUserId,
        organizationId: input.associationId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        description: input.message || input.title,
        oldValuesJson:
          input.beforeSnapshot === undefined
            ? undefined
            : {
                beforeSnapshot: sanitizeAuditValue(input.beforeSnapshot),
              },
        newValuesJson: this.auditPayload(input),
      },
      tx,
    );
  }

  logBillingRunCreated(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title' | 'severity'>) {
    return this.createLog({
      ...input,
      action: 'BILLING_RUN_CREATED',
      entityType: 'BILLING_RUN',
      title: 'Proces lunar pornit',
      severity: 'SUCCESS',
    });
  }

  logBillingRunPrecheckRun(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title'>) {
    return this.createLog({
      ...input,
      action: 'BILLING_RUN_PRECHECK_RUN',
      entityType: 'BILLING_RUN',
      title: 'Verificări inițiale rulate',
    });
  }

  logBillingRunStatusChanged(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title'>) {
    return this.createLog({
      ...input,
      action: 'BILLING_RUN_STATUS_CHANGED',
      entityType: 'BILLING_RUN',
      title: 'Status proces actualizat',
    });
  }

  logDraftCalculated(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title' | 'severity'>, recalculated = false) {
    return this.createLog({
      ...input,
      action: recalculated ? 'DRAFT_RECALCULATED' : 'DRAFT_CALCULATED',
      entityType: 'INVOICE_DRAFT',
      title: recalculated ? 'Draft recalculat' : 'Draft calculat',
      severity: 'SUCCESS',
    });
  }

  logDraftLocked(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title' | 'severity'>) {
    return this.createLog({
      ...input,
      action: 'DRAFT_LOCKED',
      entityType: 'INVOICE_DRAFT',
      title: 'Draft blocat',
      severity: 'SUCCESS',
    });
  }

  logInvoicesFinalized(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title' | 'severity'>, tx?: Prisma.TransactionClient | PrismaService) {
    return this.createLog(
      {
        ...input,
        action: 'INVOICES_FINALIZED',
        entityType: 'INVOICE_DRAFT',
        title: 'Facturi finale generate',
        severity: 'SUCCESS',
      },
      tx,
    );
  }

  logPaymentRecorded(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title' | 'severity'>, tx?: Prisma.TransactionClient | PrismaService) {
    return this.createLog(
      {
        ...input,
        action: 'PAYMENT_RECORDED',
        entityType: 'PAYMENT',
        title: 'Plată înregistrată',
        severity: 'SUCCESS',
      },
      tx,
    );
  }

  logPaymentCancelled(input: Omit<AuditLogCreateInput, 'action' | 'entityType' | 'title' | 'severity'>, tx?: Prisma.TransactionClient | PrismaService) {
    return this.createLog(
      {
        ...input,
        action: 'PAYMENT_CANCELLED',
        entityType: 'PAYMENT',
        title: 'Plată anulată',
        severity: 'WARNING',
      },
      tx,
    );
  }

  logTariffChanged(input: Omit<AuditLogCreateInput, 'entityType' | 'title' | 'severity'>, tx?: Prisma.TransactionClient | PrismaService) {
    return this.createLog(
      {
        ...input,
        entityType: 'TARIFF',
        title:
          input.action === 'TARIFF_CREATED'
            ? 'Tarif creat'
            : input.action === 'TARIFF_STATUS_CHANGED'
              ? 'Status tarif actualizat'
              : 'Tarif actualizat',
        severity: input.action === 'TARIFF_CREATED' ? 'SUCCESS' : 'INFO',
      },
      tx,
    );
  }

  logMeterReadingReviewed(input: Omit<AuditLogCreateInput, 'entityType' | 'title'>, tx?: Prisma.TransactionClient | PrismaService) {
    return this.createLog(
      {
        ...input,
        entityType: 'METER_READING',
        title:
          input.action === 'METER_READING_REJECTED'
            ? 'Indice respins'
            : input.action === 'METER_READING_APPROVED'
              ? 'Indice aprobat'
              : 'Indice marcat pentru verificare',
      },
      tx,
    );
  }

  async logAction(input: LogActionInput, tx?: Prisma.TransactionClient | PrismaService) {
    const db = tx || this.prisma;
    try {
      return await db.auditLog.create({
        data: {
          organizationId: input.organizationId || null,
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId || null,
          description: input.description,
          oldValuesJson: asJsonValue(input.oldValuesJson),
          newValuesJson: asJsonValue(input.newValuesJson),
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log for action ${input.action}`, error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  async logCreate(
    actor: AuditActor,
    entityType: string,
    entityId: string | null | undefined,
    newValues: unknown,
    description?: string,
    tx?: Prisma.TransactionClient | PrismaService,
  ) {
    return this.logAction(
      {
        ...actor,
        action: 'CREATE',
        entityType,
        entityId,
        description: description || `Created ${entityType}`,
        newValuesJson: newValues,
      },
      tx,
    );
  }

  async logUpdate(
    actor: AuditActor,
    entityType: string,
    entityId: string | null | undefined,
    oldValues: unknown,
    newValues: unknown,
    description?: string,
    tx?: Prisma.TransactionClient | PrismaService,
  ) {
    return this.logAction(
      {
        ...actor,
        action: 'UPDATE',
        entityType,
        entityId,
        description: description || `Updated ${entityType}`,
        oldValuesJson: oldValues,
        newValuesJson: newValues,
      },
      tx,
    );
  }

  async logDelete(
    actor: AuditActor,
    entityType: string,
    entityId: string | null | undefined,
    oldValues: unknown,
    description?: string,
    tx?: Prisma.TransactionClient | PrismaService,
  ) {
    return this.logAction(
      {
        ...actor,
        action: 'DELETE',
        entityType,
        entityId,
        description: description || `Deleted ${entityType}`,
        oldValuesJson: oldValues,
      },
      tx,
    );
  }

  private toAuditLogItem(row: AuditRow) {
    const next = payloadObject(row.newValuesJson);
    const old = payloadObject(row.oldValuesJson);
    const metadata = payloadObject(next.metadata);
    const severity = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(String(next.severity)) ? String(next.severity) : 'INFO';
    const billingRunId = next.billingRunId || metadata.billingRunId || null;
    return {
      id: row.id,
      associationId: row.organizationId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      billingRunId,
      invoiceDraftId: next.invoiceDraftId || metadata.invoiceDraftId || null,
      invoiceId: next.invoiceId || metadata.invoiceId || null,
      apartmentId: next.apartmentId || metadata.apartmentId || null,
      residentId: next.residentId || metadata.residentId || null,
      severity,
      title: String(next.title || row.description || row.action),
      message: String(next.message || row.description || ''),
      metadata: sanitizeAuditValue(metadata),
      beforeSnapshot: old.beforeSnapshot === undefined ? sanitizeAuditValue(row.oldValuesJson) || null : sanitizeAuditValue(old.beforeSnapshot),
      afterSnapshot: next.afterSnapshot === undefined ? null : sanitizeAuditValue(next.afterSnapshot),
      actionUrl: next.actionUrl || next.link || metadata.actionUrl || null,
      actor: row.user
        ? {
            id: row.user.id,
            fullName: actorName(row.user),
            email: row.user.email,
            role: row.user.role,
          }
        : null,
      createdAt: row.createdAt,
    };
  }

  private auditWhere(organizationId: string, query: AuditQuery): Prisma.AuditLogWhereInput {
    const from = query.dateFrom || query.from;
    const to = query.dateTo || query.to;
    return {
      organizationId,
      ...(query.action ? { action: String(query.action) } : {}),
      ...(query.entityType ? { entityType: String(query.entityType) } : {}),
      ...(query.entityId ? { entityId: String(query.entityId) } : {}),
      ...(query.actorUserId || query.userId ? { userId: String(query.actorUserId || query.userId) } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(String(from)) } : {}),
              ...(to ? { lte: new Date(String(to)) } : {}),
            },
          }
        : {}),
    };
  }

  private async findAuditRows(organizationId: string, query: AuditQuery) {
    const sortDirection = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    return this.prisma.auditLog.findMany({
      where: this.auditWhere(organizationId, query),
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: sortDirection },
      take: 1000,
    });
  }

  private filterAuditItems(items: ReturnType<AuditService['toAuditLogItem']>[], query: AuditQuery) {
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const severity = typeof query.severity === 'string' ? query.severity.trim().toUpperCase() : '';
    const billingRunId = typeof query.billingRunId === 'string' ? query.billingRunId.trim() : '';
    return items.filter((item) => {
      if (severity && item.severity !== severity) return false;
      if (billingRunId && item.billingRunId !== billingRunId) return false;
      if (!search) return true;
      const haystack = [
        item.id,
        item.action,
        item.entityType,
        item.entityId,
        item.title,
        item.message,
        item.actor?.fullName,
        item.actor?.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  private auditStats(items: ReturnType<AuditService['toAuditLogItem']>[]) {
    const todayKey = new Date().toISOString().slice(0, 10);
    return {
      total: items.length,
      today: items.filter((item) => new Date(item.createdAt).toISOString().slice(0, 10) === todayKey).length,
      warnings: items.filter((item) => item.severity === 'WARNING').length,
      errors: items.filter((item) => item.severity === 'ERROR').length,
      billingActions: items.filter((item) => item.action.startsWith('BILLING_RUN') || item.action.startsWith('DRAFT_') || item.action === 'INVOICES_FINALIZED').length,
      lastActivityAt: items[0]?.createdAt || null,
    };
  }

  async listAdminAuditLog(organizationId: string, query: AuditQuery) {
    const { page, limit } = resolvePagination({ page: Number(query.page) || undefined, limit: Number(query.limit) || undefined }, 20, 100);
    const rows = await this.findAuditRows(organizationId, query);
    const filtered = this.filterAuditItems(rows.map((row) => this.toAuditLogItem(row)), query);
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      meta: { page, limit, total: filtered.length },
      stats: this.auditStats(filtered),
    };
  }

  async getAdminAuditLog(organizationId: string, id: string) {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Logul de activitate nu a fost găsit.');
    const item = this.toAuditLogItem(row);
    return { log: item, actor: item.actor };
  }

  async getAdminAuditLogStats(organizationId: string, query: AuditQuery = {}) {
    const rows = await this.findAuditRows(organizationId, query);
    return this.auditStats(this.filterAuditItems(rows.map((row) => this.toAuditLogItem(row)), query));
  }

  async listBillingRunActivity(organizationId: string, billingRunId: string, query: AuditQuery, recentLimit?: number) {
    const rows = await this.findAuditRows(organizationId, { ...query, billingRunId });
    const filtered = this.filterAuditItems(rows.map((row) => this.toAuditLogItem(row)), { ...query, billingRunId });
    if (recentLimit) {
      return {
        items: filtered.slice(0, recentLimit),
        meta: { page: 1, limit: recentLimit, total: filtered.length },
        stats: this.auditStats(filtered),
      };
    }
    const { page, limit } = resolvePagination({ page: Number(query.page) || undefined, limit: Number(query.limit) || undefined }, 20, 100);
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      meta: { page, limit, total: filtered.length },
      stats: this.auditStats(filtered),
    };
  }

  async listForAdmin(
    organizationId: string,
    filters: { action?: string; entityType?: string; userId?: string; from?: string; to?: string; page?: number; limit?: number },
  ) {
    const where = {
        organizationId,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      };
    const { page, limit, skip } = resolvePagination(filters, 50, 200);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async listForSuperadmin(filters: {
    organizationId?: string;
    action?: string;
    entityType?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const where = {
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      };
    const { page, limit, skip } = resolvePagination(filters, 50, 200);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }
}
