import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

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
          oldValuesJson: input.oldValuesJson as Prisma.InputJsonValue | undefined,
          newValuesJson: input.newValuesJson as Prisma.InputJsonValue | undefined,
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
