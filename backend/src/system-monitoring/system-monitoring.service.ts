import { ForbiddenException, Injectable } from '@nestjs/common';
import { SystemErrorLevel, SystemErrorSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientErrorDto, ListSystemErrorsDto } from './dto/system-monitoring.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class SystemMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user?: AuthUser | null) {
    return user?.id || user?.sub || null;
  }

  private isSuperAdmin(user?: AuthUser | null) {
    const role = String(user?.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private assertSuperAdmin(user?: AuthUser | null) {
    if (!this.isSuperAdmin(user)) throw new ForbiddenException('Super admin access required');
  }

  private sanitizeText(value?: string | null) {
    if (!value) return null;
    let output = String(value);
    output = output.replace(/(authorization|token|password|secret|api[_-]?key)\s*[:=]\s*['"]?([^'",\s]+)/gi, '$1:[MASKED]');
    output = output.replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, 'Bearer [MASKED]');
    return output.slice(0, 10000);
  }

  private sanitizeUnknown(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return this.sanitizeText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitizeUnknown(item));
    if (typeof value === 'object') {
      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const [key, raw] of Object.entries(input)) {
        if (/(password|token|secret|authorization|cookie|api[_-]?key)/i.test(key)) {
          output[key] = '[MASKED]';
        } else {
          output[key] = this.sanitizeUnknown(raw);
        }
      }
      return output;
    }
    return String(value);
  }

  async logError(params: {
    source: SystemErrorSource;
    level: SystemErrorLevel;
    message: string;
    stack?: string | null;
    metadataJson?: unknown;
    organizationId?: string | null;
    userId?: string | null;
  }) {
    return this.prisma.systemErrorLog.create({
      data: {
        source: params.source,
        level: params.level,
        message: this.sanitizeText(params.message) || 'Unknown error',
        stack: this.sanitizeText(params.stack || null),
        metadataJson: this.sanitizeUnknown(params.metadataJson || null) as any,
        organizationId: params.organizationId || null,
        userId: params.userId || null,
      },
    });
  }

  async logFrontendError(user: AuthUser | null | undefined, dto: CreateClientErrorDto) {
    return this.logError({
      source: SystemErrorSource.FRONTEND,
      level: SystemErrorLevel.ERROR,
      message: dto.message,
      stack: dto.stack || null,
      metadataJson: dto.metadataJson || null,
      organizationId: user?.organizationId || null,
      userId: this.userId(user),
    });
  }

  async listSystemErrors(user: AuthUser | null | undefined, query: ListSystemErrorsDto) {
    this.assertSuperAdmin(user);
    return this.prisma.systemErrorLog.findMany({
      where: {
        ...(query.source ? { source: query.source as SystemErrorSource } : {}),
        ...(query.level ? { level: query.level as SystemErrorLevel } : {}),
        ...(query.resolved !== undefined ? { resolved: query.resolved } : {}),
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async resolveSystemError(user: AuthUser | null | undefined, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.systemErrorLog.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date() },
    });
  }

  async getSystemStatus(user: AuthUser | null | undefined) {
    this.assertSuperAdmin(user);
    let databaseStatus: 'UP' | 'DOWN' = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'DOWN';
    }

    const [failedJobsCount, unresolvedErrorsCount, activeOrganizationsCount, latestJob, storageAgg, orgStorageAgg] =
      await Promise.all([
        this.prisma.systemErrorLog.count({
          where: { source: SystemErrorSource.JOB, resolved: false },
        }),
        this.prisma.systemErrorLog.count({ where: { resolved: false } }),
        this.prisma.organization.count({ where: { isActive: true } }),
        this.prisma.scheduledJob.findFirst({
          where: { lastRunAt: { not: null } },
          orderBy: { lastRunAt: 'desc' },
          select: { name: true, lastRunAt: true },
        }),
        this.prisma.fileAsset.aggregate({
          _sum: { sizeBytes: true },
          _count: { _all: true },
        }),
        this.prisma.fileAsset.groupBy({
          by: ['organizationId'],
          _sum: { sizeBytes: true },
        }),
      ]);

    const totalBytes = Number(storageAgg._sum.sizeBytes || 0);
    return {
      checkedAt: new Date().toISOString(),
      apiStatus: 'UP',
      databaseStatus,
      failedJobsCount,
      unresolvedErrorsCount,
      storageSummary: {
        totalFiles: storageAgg._count._all,
        totalUsedBytes: totalBytes,
        totalUsedMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
        organizationsWithFiles: orgStorageAgg.filter((item) => Boolean(item.organizationId)).length,
      },
      activeOrganizationsCount,
      lastSuccessfulScheduledJobRun: latestJob
        ? { jobName: latestJob.name, lastRunAt: latestJob.lastRunAt }
        : null,
      appVersion: process.env.APP_VERSION || process.env.npm_package_version || '0.1.0-beta',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
