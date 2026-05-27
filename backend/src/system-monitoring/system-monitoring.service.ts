import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeploymentProvider,
  DeploymentStatus,
  Prisma,
  SystemErrorLevel,
  SystemErrorSource,
  SystemHealthStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientErrorDto, ListSystemErrorsDto } from './dto/system-monitoring.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };
const SystemServiceKey = {
  BACKEND_API: 'BACKEND_API',
  FRONTEND_APP: 'FRONTEND_APP',
  DATABASE: 'DATABASE',
  PRISMA: 'PRISMA',
  AUTH: 'AUTH',
  NOTIFICATIONS: 'NOTIFICATIONS',
  PAYMENTS: 'PAYMENTS',
  FILE_STORAGE: 'FILE_STORAGE',
  JOBS: 'JOBS',
  EXTERNAL_PROVIDERS: 'EXTERNAL_PROVIDERS',
} as const;
type SystemServiceKey = (typeof SystemServiceKey)[keyof typeof SystemServiceKey];
type HealthService = {
  key: SystemServiceKey;
  status: SystemHealthStatus;
  latencyMs: number | null;
  message: string;
  details?: Record<string, unknown>;
};

const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'jwt',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'resetToken',
  'invitationToken',
  'accessToken',
  'refreshToken',
  'cardNumber',
  'cvv',
];

export function sanitizeErrorMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeText(value, 2000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeErrorMetadata(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        output[key] = '[MASKED]';
      } else {
        output[key] = sanitizeErrorMetadata(raw, depth + 1);
      }
    }
    return output;
  }
  return String(value);
}

function sanitizeText(value?: string | null, max = 10000) {
  if (!value) return null;
  let output = String(value);
  output = output.replace(/(authorization|token|password|secret|api[_-]?key|cookie)\s*[:=]\s*['"]?([^'",\s]+)/gi, '$1:[MASKED]');
  output = output.replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, 'Bearer [MASKED]');
  output = output.replace(/\/(invite|reset-password|staff-invite)\/[A-Za-z0-9._~+-]+/g, '/$1/***');
  return output.slice(0, max);
}

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

  async logError(params: {
    source: SystemErrorSource;
    level: SystemErrorLevel;
    message: string;
    stack?: string | null;
    metadataJson?: unknown;
    organizationId?: string | null;
    userId?: string | null;
  }) {
    await this.recordErrorEvent({
      source: params.source,
      severity: params.level,
      message: params.message,
      stack: params.stack,
      metadata: params.metadataJson,
      associationId: params.organizationId,
      userId: params.userId,
    }).catch(() => undefined);

    return this.prisma.systemErrorLog.create({
      data: {
        source: params.source,
        level: params.level,
        message: sanitizeText(params.message) || 'Unknown error',
        stack: sanitizeText(params.stack || null),
        metadataJson: sanitizeErrorMetadata(params.metadataJson || null) as Prisma.InputJsonValue,
        organizationId: params.organizationId || null,
        userId: params.userId || null,
      },
    });
  }

  async logFrontendError(user: AuthUser | null | undefined, dto: CreateClientErrorDto) {
    return this.recordErrorEvent({
      source: SystemErrorSource.FRONTEND,
      severity: this.enumValue(dto.severity, SystemErrorLevel, SystemErrorLevel.ERROR),
      message: dto.message,
      stack: dto.stack || null,
      route: dto.route || null,
      code: dto.code || null,
      metadata: dto.metadata || dto.metadataJson || null,
      associationId: user?.organizationId || null,
      userId: this.userId(user),
    });
  }

  async recordErrorEvent(params: {
    source: SystemErrorSource;
    severity: SystemErrorLevel;
    message: string;
    stack?: string | null;
    code?: string | null;
    route?: string | null;
    method?: string | null;
    statusCode?: number | null;
    userId?: string | null;
    associationId?: string | null;
    requestId?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
    metadata?: unknown;
  }) {
    const source = params.source;
    const severity = params.severity;
    const message = sanitizeText(params.message, 2000) || 'Unknown error';
    const route = sanitizeText(params.route || null, 500);
    const code = sanitizeText(params.code || null, 120);
    const fingerprint = this.fingerprint(source, code || '', message, route || '');
    const existing = await this.prisma.systemErrorEvent.findFirst({
      where: { fingerprint, resolvedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    const data = {
      source,
      severity,
      message,
      stack: sanitizeText(params.stack || null, 10000),
      code,
      route,
      method: sanitizeText(params.method || null, 20),
      statusCode: params.statusCode || null,
      userId: params.userId || null,
      associationId: params.associationId || null,
      requestId: sanitizeText(params.requestId || null, 120),
      userAgent: sanitizeText(params.userAgent || null, 500),
      ipAddress: sanitizeText(params.ipAddress || null, 120),
      metadata: sanitizeErrorMetadata(params.metadata || null) as Prisma.InputJsonValue,
      fingerprint,
      lastSeenAt: new Date(),
    };
    if (existing) {
      return this.prisma.systemErrorEvent.update({
        where: { id: existing.id },
        data: { ...data, occurrenceCount: { increment: 1 } },
      });
    }
    return this.prisma.systemErrorEvent.create({
      data: { ...data, firstSeenAt: new Date() },
    });
  }

  async listSystemErrors(user: AuthUser | null | undefined, query: ListSystemErrorsDto) {
    this.assertSuperAdmin(user);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const where: Prisma.SystemErrorEventWhereInput = {
      ...(query.source ? { source: query.source as SystemErrorSource } : {}),
      ...(query.level || query.severity ? { severity: (query.level || query.severity) as SystemErrorLevel } : {}),
      ...(query.resolved !== undefined ? { resolvedAt: query.resolved ? { not: null } : null } : {}),
      ...(query.organizationId || query.associationId ? { associationId: query.organizationId || query.associationId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.route ? { route: { contains: query.route, mode: 'insensitive' } } : {}),
      ...(query.search ? { message: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.systemErrorEvent.findMany({
        where,
        include: {
          association: { select: { id: true, name: true, fiscalCode: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          resolvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.systemErrorEvent.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getSystemError(user: AuthUser | null | undefined, id: string) {
    this.assertSuperAdmin(user);
    const item = await this.prisma.systemErrorEvent.findUnique({
      where: { id },
      include: {
        association: { select: { id: true, name: true, fiscalCode: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        resolvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!item) throw new NotFoundException('Eroarea nu a fost găsită.');
    return { error: item };
  }

  async resolveSystemError(user: AuthUser | null | undefined, id: string, note?: string) {
    this.assertSuperAdmin(user);
    return this.prisma.systemErrorEvent.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedById: this.userId(user),
        resolutionNote: sanitizeText(note || 'Rezolvat de Superadmin.', 1000),
      },
    });
  }

  async reopenSystemError(user: AuthUser | null | undefined, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.systemErrorEvent.update({
      where: { id },
      data: { resolvedAt: null, resolvedById: null, resolutionNote: null },
    });
  }

  async getSystemStatus(user: AuthUser | null | undefined) {
    this.assertSuperAdmin(user);
    const health = await this.getHealth();
    const errors = await this.errorStats();
    return {
      checkedAt: health.timestamp,
      status: health.status,
      apiStatus: health.status === SystemHealthStatus.DOWN ? 'DOWN' : 'UP',
      databaseStatus: health.services.find((item) => item.key === SystemServiceKey.DATABASE)?.status === SystemHealthStatus.OPERATIONAL ? 'UP' : 'DOWN',
      failedJobsCount: health.services.find((item) => item.key === SystemServiceKey.JOBS)?.details?.failedJobsCount || 0,
      unresolvedErrorsCount: errors.open,
      activeOrganizationsCount: await this.prisma.organization.count({ where: { isActive: true } }),
      lastSuccessfulScheduledJobRun: await this.latestJob(),
      appVersion: this.version(),
      environment: process.env.NODE_ENV || 'development',
      services: health.services,
    };
  }

  async getOverview(user: AuthUser | null | undefined) {
    this.assertSuperAdmin(user);
    const [health, errors, deployments] = await Promise.all([
      this.getHealth(),
      this.errorStats(),
      this.listDeployments(user),
    ]);
    return {
      health,
      errors,
      deployments: deployments.items.slice(0, 5),
      kpis: {
        platformStatus: health.status,
        openErrors: errors.open,
        criticalErrors: errors.criticalOpen,
        errors24h: errors.last24h,
        lastDeploy: deployments.current,
      },
    };
  }

  async getHealth() {
    const timestamp = new Date().toISOString();
    const services: HealthService[] = [];
    services.push({ key: SystemServiceKey.BACKEND_API, status: SystemHealthStatus.OPERATIONAL, latencyMs: 0, message: 'API is healthy' });
    services.push(await this.databaseCheck());
    services.push(await this.prismaCheck());
    services.push(this.authCheck());
    services.push(await this.notificationsCheck());
    services.push(await this.paymentsCheck());
    services.push(await this.jobsCheck());
    services.push(this.fileStorageCheck());
    services.push({ key: SystemServiceKey.FRONTEND_APP, status: SystemHealthStatus.UNKNOWN, latencyMs: null, message: 'Frontend status is checked client-side.' });

    const status = this.aggregateStatus(services);
    return {
      status,
      timestamp,
      version: this.version(),
      environment: process.env.NODE_ENV || 'development',
      services,
      diagnostics: this.environmentDiagnostics(),
    };
  }

  async getReadiness() {
    const health = await this.getHealth();
    const db = health.services.find((item) => item.key === SystemServiceKey.DATABASE);
    const prisma = health.services.find((item) => item.key === SystemServiceKey.PRISMA);
    const ready = db?.status === SystemHealthStatus.OPERATIONAL && prisma?.status === SystemHealthStatus.OPERATIONAL;
    return { ready, status: ready ? SystemHealthStatus.OPERATIONAL : SystemHealthStatus.DOWN, timestamp: health.timestamp, services: [db, prisma].filter(Boolean) };
  }

  getLiveness() {
    return { alive: true, status: SystemHealthStatus.OPERATIONAL, timestamp: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) };
  }

  async saveHealthSnapshot(user: AuthUser | null | undefined) {
    this.assertSuperAdmin(user);
    const health = await this.getHealth();
    const created = await this.prisma.systemHealthSnapshot.create({
      data: {
        status: health.status,
        checkedAt: new Date(health.timestamp),
        services: health.services as unknown as Prisma.InputJsonValue,
        summary: { version: health.version, environment: health.environment } as Prisma.InputJsonObject,
      },
    });
    return { snapshot: created };
  }

  async listDeployments(user: AuthUser | null | undefined) {
    this.assertSuperAdmin(user);
    const [records, current] = await Promise.all([
      this.prisma.deploymentRecord.findMany({ orderBy: { deployedAt: 'desc' }, take: 50 }),
      Promise.resolve(this.currentDeployment()),
    ]);
    return { items: records.length ? records : [current], current, message: records.length ? null : 'Integrarea automată cu Vercel/Render va fi disponibilă ulterior.' };
  }

  currentDeployment() {
    const provider = process.env.VERCEL ? DeploymentProvider.VERCEL : process.env.RENDER ? DeploymentProvider.RENDER : DeploymentProvider.UNKNOWN;
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null;
    return {
      id: 'current',
      provider,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.RENDER_GIT_BRANCH || null,
      commitSha,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      status: DeploymentStatus.READY,
      deployedAt: process.env.VERCEL_DEPLOYMENT_CREATED_AT ? new Date(Number(process.env.VERCEL_DEPLOYMENT_CREATED_AT)).toISOString() : null,
      url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.RENDER_EXTERNAL_URL || null,
      metadata: {
        source: 'environment',
        hasCommitSha: Boolean(commitSha),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async databaseCheck(): Promise<HealthService> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { key: SystemServiceKey.DATABASE, status: SystemHealthStatus.OPERATIONAL, latencyMs: Date.now() - started, message: 'Database connection OK' };
    } catch {
      return { key: SystemServiceKey.DATABASE, status: SystemHealthStatus.DOWN, latencyMs: Date.now() - started, message: 'Database connection failed' };
    }
  }

  private async prismaCheck(): Promise<HealthService> {
    const started = Date.now();
    try {
      await this.prisma.organization.findFirst({ select: { id: true } });
      return { key: SystemServiceKey.PRISMA, status: SystemHealthStatus.OPERATIONAL, latencyMs: Date.now() - started, message: 'Prisma query OK' };
    } catch {
      return { key: SystemServiceKey.PRISMA, status: SystemHealthStatus.DOWN, latencyMs: Date.now() - started, message: 'Prisma query failed' };
    }
  }

  private authCheck(): HealthService {
    return {
      key: SystemServiceKey.AUTH,
      status: process.env.JWT_SECRET ? SystemHealthStatus.OPERATIONAL : SystemHealthStatus.DOWN,
      latencyMs: null,
      message: process.env.JWT_SECRET ? 'JWT secret present' : 'JWT secret missing',
      details: { JWT_SECRET: process.env.JWT_SECRET ? 'PRESENT' : 'MISSING' },
    };
  }

  private async notificationsCheck(): Promise<HealthService> {
    const emailProvider = process.env.EMAIL_PROVIDER || 'CONSOLE';
    const smsProvider = process.env.SMS_PROVIDER || 'CONSOLE';
    const failedDeliveries = await this.prisma.notificationDelivery.count({
      where: { status: 'FAILED' as any, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }).catch(() => 0);
    return {
      key: SystemServiceKey.NOTIFICATIONS,
      status: failedDeliveries > 20 ? SystemHealthStatus.DEGRADED : SystemHealthStatus.OPERATIONAL,
      latencyMs: null,
      message: failedDeliveries > 20 ? 'Many notification deliveries failed in the last 24h.' : 'Notification providers are available or safely disabled.',
      details: { emailProvider, smsProvider, failedDeliveries24h: failedDeliveries },
    };
  }

  private async paymentsCheck(): Promise<HealthService> {
    const externalEnabled = String(process.env.PAYMENTS_EXTERNAL_ENABLED || 'false').toLowerCase() === 'true';
    const failedWebhooks = await this.prisma.paymentWebhookEvent.count({
      where: { status: 'FAILED' as any, receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }).catch(() => 0);
    return {
      key: SystemServiceKey.PAYMENTS,
      status: failedWebhooks > 0 ? SystemHealthStatus.DEGRADED : externalEnabled ? SystemHealthStatus.OPERATIONAL : SystemHealthStatus.UNKNOWN,
      latencyMs: null,
      message: externalEnabled ? 'Payment external mode configured.' : 'Payments not enabled; ES-139 skeleton only.',
      details: { externalEnabled, failedWebhooks24h: failedWebhooks },
    };
  }

  private async jobsCheck(): Promise<HealthService> {
    const failedJobsCount = await this.prisma.systemErrorLog.count({ where: { source: SystemErrorSource.JOB, resolved: false } }).catch(() => 0);
    return {
      key: SystemServiceKey.JOBS,
      status: failedJobsCount ? SystemHealthStatus.DEGRADED : SystemHealthStatus.UNKNOWN,
      latencyMs: null,
      message: failedJobsCount ? 'Some job errors are unresolved.' : 'No active scheduler health check configured.',
      details: { failedJobsCount },
    };
  }

  private fileStorageCheck(): HealthService {
    return {
      key: SystemServiceKey.FILE_STORAGE,
      status: process.env.FILE_STORAGE_PROVIDER ? SystemHealthStatus.OPERATIONAL : SystemHealthStatus.UNKNOWN,
      latencyMs: null,
      message: process.env.FILE_STORAGE_PROVIDER ? 'File storage provider configured.' : 'File storage provider not configured.',
      details: { provider: process.env.FILE_STORAGE_PROVIDER ? 'PRESENT' : 'MISSING' },
    };
  }

  private environmentDiagnostics() {
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      DATABASE_URL: process.env.DATABASE_URL ? 'PRESENT' : 'MISSING',
      JWT_SECRET: process.env.JWT_SECRET ? 'PRESENT' : 'MISSING',
      CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.FRONTEND_URL ? 'PRESENT' : process.env.NODE_ENV === 'production' ? 'MISSING' : 'OPTIONAL',
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'CONSOLE',
      SMS_PROVIDER: process.env.SMS_PROVIDER || 'CONSOLE',
      PAYMENTS_EXTERNAL_ENABLED: process.env.PAYMENTS_EXTERNAL_ENABLED || 'false',
      BPAY_CONFIG: process.env.BPAY_MERCHANT_ID && process.env.BPAY_API_KEY && process.env.BPAY_SECRET ? 'CONFIGURED' : 'NOT_CONFIGURED',
    };
  }

  private aggregateStatus(services: HealthService[]) {
    const criticalServices: SystemServiceKey[] = [SystemServiceKey.DATABASE, SystemServiceKey.PRISMA, SystemServiceKey.AUTH];
    if (services.some((item) => item.status === SystemHealthStatus.DOWN && criticalServices.includes(item.key))) {
      return SystemHealthStatus.DOWN;
    }
    if (services.some((item) => item.status === SystemHealthStatus.DEGRADED || item.status === SystemHealthStatus.DOWN)) {
      return SystemHealthStatus.DEGRADED;
    }
    return SystemHealthStatus.OPERATIONAL;
  }

  private async errorStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [open, criticalOpen, last24h] = await Promise.all([
      this.prisma.systemErrorEvent.count({ where: { resolvedAt: null } }),
      this.prisma.systemErrorEvent.count({ where: { resolvedAt: null, severity: SystemErrorLevel.CRITICAL } }),
      this.prisma.systemErrorEvent.count({ where: { lastSeenAt: { gte: since } } }),
    ]);
    return { open, criticalOpen, last24h };
  }

  private async latestJob() {
    const latestJob = await this.prisma.scheduledJob.findFirst({
      where: { lastRunAt: { not: null } },
      orderBy: { lastRunAt: 'desc' },
      select: { name: true, lastRunAt: true },
    }).catch(() => null);
    return latestJob ? { jobName: latestJob.name, lastRunAt: latestJob.lastRunAt } : null;
  }

  private fingerprint(source: SystemErrorSource, code: string, message: string, route: string) {
    const normalized = [source, code, message.replace(/[0-9a-f-]{8,}/gi, ':id').slice(0, 300), route].join('|');
    return createHash('sha256').update(normalized).digest('hex');
  }

  private enumValue<T extends Record<string, string>>(value: unknown, enumeration: T, fallback: T[keyof T]) {
    const normalized = String(value || '').toUpperCase();
    return (Object.values(enumeration) as string[]).includes(normalized) ? normalized as T[keyof T] : fallback;
  }

  private version() {
    return process.env.APP_VERSION || process.env.npm_package_version || '0.1.0-beta';
  }
}
