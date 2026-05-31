import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformRole, Role } from '@prisma/client';
import { AssociationContextService } from './association-context.service';
import { SupportSessionContextService } from './support-session-context.service';
import type { AssociationContextUser, RequestWithTenantContext } from './association-context.types';

const TENANT_REQUEST_KEYS = ['organizationId', 'associationId', 'orgId'] as const;

function normalizeRole(value?: string | null) {
  return String(value || '').toUpperCase();
}

function isSuperAdmin(user: AssociationContextUser) {
  return (
    normalizeRole(user.role) === Role.SUPERADMIN ||
    normalizeRole(user.role) === 'SUPER_ADMIN' ||
    normalizeRole(user.platformRole) === PlatformRole.SUPER_ADMIN
  );
}

function stringValue(value: unknown): string | null {
  if (Array.isArray(value)) return stringValue(value[0]);
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function findRequestedTenantId(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of TENANT_REQUEST_KEYS) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return null;
}

function requestedTenantIdFromRequest(request: RequestWithTenantContext): string | null {
  const headers = request.headers || {};
  return (
    findRequestedTenantId(request.params) ||
    findRequestedTenantId(request.body) ||
    findRequestedTenantId(request.query) ||
    stringValue(headers['x-association-id']) ||
    stringValue(headers['x-org-id'])
  );
}

@Injectable()
export class AdminAssociationGuard implements CanActivate {
  constructor(
    private readonly associationContext: AssociationContextService,
    private readonly supportSessions: SupportSessionContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Autentificare necesară.',
      });
    }

    this.assertRequestedTenantMatchesUser(user, request);

    const activeContext = await this.associationContext.getAdminAssociationContext(user, request);
    request.associationContext = activeContext;
    if (activeContext.isSupportMode && activeContext.supportSession) {
      request.supportSessionContext = {
        ...activeContext.supportSession,
        associationId: activeContext.associationId,
        startedById: user.id || user.sub || '',
        isReadOnly: activeContext.supportSession.mode === 'READ_ONLY',
      };
      await this.supportSessions.enforceMutationPolicy(request);
    }
    request.user = {
      ...user,
      organizationId: activeContext.associationId,
    };
    return true;
  }

  private assertRequestedTenantMatchesUser(user: AssociationContextUser, request: RequestWithTenantContext) {
    if (isSuperAdmin(user)) return;

    const requestedTenantId = requestedTenantIdFromRequest(request);
    if (!requestedTenantId) return;

    if (!user.organizationId || user.organizationId !== requestedTenantId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_MISMATCH',
        statusCode: 403,
        message: 'Nu ai acces la această asociație.',
      });
    }
  }
}
