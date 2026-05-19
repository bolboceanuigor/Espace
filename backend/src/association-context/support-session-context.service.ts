import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SuperadminSupportAccessMode, SuperadminSupportSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AssociationContextUser, RequestWithTenantContext } from './association-context.types';

function userIdOf(user: AssociationContextUser | null | undefined) {
  return user?.id || user?.sub || '';
}

function roleOf(user: AssociationContextUser | null | undefined) {
  return String(user?.role || user?.platformRole || '').toUpperCase();
}

function headerValue(value: unknown): string | null {
  if (Array.isArray(value)) return String(value[0] || '').trim() || null;
  if (typeof value === 'string') return value.trim() || null;
  return null;
}

function cookieValue(cookieHeader: unknown, key: string) {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join(';') : String(cookieHeader || '');
  const match = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));
  return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

const READ_ONLY_PERMISSIONS = [
  'dashboard.view',
  'apartments.view',
  'residents.view',
  'tariffs.view',
  'meters.view',
  'meter_readings.view',
  'billing.view',
  'invoices.view',
  'payments.view',
  'reconciliation.view',
  'reports.view',
  'announcements.view',
  'requests.view',
  'imports.view',
  'exports.view',
  'data_quality.view',
  'notifications.view',
  'audit_log.view',
];

const SUPPORT_WRITE_PERMISSIONS = [
  ...READ_ONLY_PERMISSIONS,
  'announcements.create',
  'announcements.update',
  'requests.update',
  'data_quality.manage',
];

const CRITICAL_MUTATION_PATTERNS = [
  /\/finalize/i,
  /\/cancel/i,
  /\/void/i,
  /\/lock/i,
  /\/permissions/i,
  /\/role/i,
  /\/revoke/i,
  /\/imports\/.+\/confirm/i,
  /\/fixes\/bulk/i,
];

@Injectable()
export class SupportSessionContextService {
  constructor(private readonly prisma: PrismaService) {}

  resolveSupportSessionId(request?: RequestWithTenantContext) {
    const headers = request?.headers || {};
    const query = request?.query || {};
    return (
      headerValue(headers['x-support-session-id']) ||
      headerValue((query as any).supportSessionId) ||
      cookieValue(headers.cookie, 'supportSessionId')
    );
  }

  supportPermissions(mode: SuperadminSupportAccessMode | string) {
    return mode === SuperadminSupportAccessMode.SUPPORT_WRITE ? SUPPORT_WRITE_PERMISSIONS : READ_ONLY_PERMISSIONS;
  }

  async getSupportSessionContext(user: AssociationContextUser, request?: RequestWithTenantContext) {
    const userId = userIdOf(user);
    if (!userId || !['SUPERADMIN', 'SUPER_ADMIN'].includes(roleOf(user))) {
      throw new ForbiddenException({
        code: 'SUPERADMIN_SUPPORT_REQUIRED',
        message: 'Doar Superadmin poate folosi sesiuni de suport.',
      });
    }
    const supportSessionId = this.resolveSupportSessionId(request);
    if (!supportSessionId) {
      throw new ForbiddenException({
        code: 'SUPPORT_SESSION_REQUIRED',
        message: 'Sesiunea de suport este obligatorie pentru acces Admin ca Superadmin.',
      });
    }
    return this.validateSupportSession(userId, supportSessionId, request);
  }

  async validateSupportSession(superAdminUserId: string, supportSessionId: string, request?: RequestWithTenantContext) {
    const session = await this.prisma.supportSession.findFirst({
      where: { id: supportSessionId, superAdminUserId },
      include: { organization: true },
    });
    if (!session) {
      throw new NotFoundException({
        code: 'SUPPORT_SESSION_NOT_FOUND',
        message: 'Sesiunea de suport nu există sau nu îți aparține.',
      });
    }
    const now = new Date();
    const expiresAt = session.expiresAt || new Date(session.startedAt.getTime() + 30 * 60 * 1000);
    if (
      session.status !== SuperadminSupportSessionStatus.ACTIVE ||
      !session.isActive ||
      expiresAt.getTime() <= now.getTime()
    ) {
      if (session.status === SuperadminSupportSessionStatus.ACTIVE || session.isActive) {
        await this.expireSession(session.id, superAdminUserId, session.organizationId, request);
      }
      throw new ForbiddenException({
        code: 'SUPPORT_SESSION_EXPIRED',
        message: 'Sesiunea de suport a expirat.',
      });
    }

    const requestedAssociationId = headerValue(request?.headers?.['x-association-id']) || headerValue(request?.headers?.['x-org-id']);
    if (requestedAssociationId && requestedAssociationId !== session.organizationId) {
      await this.logSupportAudit({
        associationId: session.organizationId,
        userId: superAdminUserId,
        supportSessionId: session.id,
        action: 'SUPPORT_SESSION_ACCESS_DENIED',
        description: 'Support session attempted to access another association.',
        metadata: { requestedAssociationId, sessionAssociationId: session.organizationId },
        request,
      });
      throw new ForbiddenException({
        code: 'SUPPORT_SESSION_TENANT_MISMATCH',
        message: 'Sesiunea de suport nu permite acces la această asociație.',
      });
    }

    await this.prisma.supportSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    }).catch(() => undefined);

    return {
      id: session.id,
      associationId: session.organizationId,
      startedById: session.superAdminUserId,
      mode: session.mode,
      status: session.status,
      reason: session.reason || '',
      internalTicketRef: session.internalTicketRef || null,
      startedAt: session.startedAt,
      expiresAt,
      organization: session.organization,
      isReadOnly: session.mode === SuperadminSupportAccessMode.READ_ONLY,
    };
  }

  async enforceMutationPolicy(request: RequestWithTenantContext) {
    const context = request.supportSessionContext;
    if (!context) return;
    const method = String(request.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
    const path = String((request as any).originalUrl || request.url || '');
    const userId = userIdOf(request.user);

    if (context.mode === SuperadminSupportAccessMode.READ_ONLY) {
      await this.logSupportAudit({
        associationId: context.associationId,
        userId,
        supportSessionId: context.id,
        action: 'SUPPORT_SESSION_CRITICAL_ACTION_BLOCKED',
        description: 'Read-only support session blocked a mutating request.',
        metadata: { method, path, mode: context.mode },
        request,
      });
      throw new ForbiddenException({
        code: 'SUPPORT_SESSION_READ_ONLY',
        message: 'Sesiunea de suport este read-only.',
      });
    }

    if (CRITICAL_MUTATION_PATTERNS.some((pattern) => pattern.test(path))) {
      await this.logSupportAudit({
        associationId: context.associationId,
        userId,
        supportSessionId: context.id,
        action: 'SUPPORT_SESSION_CRITICAL_ACTION_BLOCKED',
        description: 'Support write blocked a critical admin action.',
        metadata: { method, path, mode: context.mode },
        request,
      });
      throw new ForbiddenException({
        code: 'SUPPORT_SESSION_CRITICAL_ACTION_BLOCKED',
        message: 'Această acțiune critică este blocată în modul suport.',
      });
    }

    await this.logSupportAudit({
      associationId: context.associationId,
      userId,
      supportSessionId: context.id,
      action: 'SUPPORT_SESSION_WRITE_ACTION',
      description: 'Support write action executed.',
      metadata: { method, path, mode: context.mode },
      request,
    });
  }

  async expireSession(sessionId: string, userId: string, associationId: string, request?: RequestWithTenantContext) {
    await this.prisma.supportSession.update({
      where: { id: sessionId },
      data: { status: SuperadminSupportSessionStatus.EXPIRED, isActive: false, endedAt: new Date() },
    });
    await this.logSupportAudit({
      associationId,
      userId,
      supportSessionId: sessionId,
      action: 'SUPPORT_SESSION_EXPIRED',
      description: 'Support session expired.',
      request,
    });
  }

  async logSupportAudit(input: {
    associationId: string;
    userId: string;
    supportSessionId: string;
    action: string;
    description: string;
    metadata?: Record<string, unknown>;
    request?: RequestWithTenantContext;
  }) {
    if (!input.userId) return null;
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.associationId,
        effectiveAssociationId: input.associationId,
        userId: input.userId,
        supportSessionId: input.supportSessionId,
        actorType: 'SUPERADMIN_SUPPORT',
        isImpersonatedAction: true,
        action: input.action,
        entityType: 'SUPPORT_SESSION',
        entityId: input.supportSessionId,
        description: input.description,
        newValuesJson: input.metadata || {},
        ipAddress: headerValue(input.request?.headers?.['x-forwarded-for']) || null,
        userAgent: headerValue(input.request?.headers?.['user-agent']) || null,
      },
    }).catch(() => null);
  }
}
