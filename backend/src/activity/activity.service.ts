import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    organizationId: string;
    performedById?: string;
    performedByRole?: Role | string;
    action: string;
    entityType?: string;
    entityId?: string;
    payload?: Prisma.InputJsonValue;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          userId: params.performedById || 'system',
          action: params.action,
          entityType: params.entityType || 'SYSTEM',
          entityId: params.entityId || null,
          description: params.action,
          newValuesJson: params.payload ?? Prisma.JsonNull,
          userAgent: params.performedByRole?.toString() || null,
        },
      });
    } catch {
      // Logging must never block domain actions.
    }
  }

  async list(
    organizationId: string,
    options?: { limit?: number; entityType?: string; userId?: string },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(options?.entityType ? { entityType: options.entityType } : {}),
        ...(options?.userId ? { userId: options.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, options?.limit ?? 200)),
    });
  }
}
