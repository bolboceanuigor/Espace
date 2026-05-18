import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';

type AuthUser = {
  role?: Role | string | null;
  organizationId?: string | null;
};

function normalizeRole(role: AuthUser['role']): string {
  return (role || '').toString().toUpperCase();
}

export function getRequestedOrgId(req: Request): string | undefined {
  const guardOrgScope = (req as any).orgScopeId;
  if (typeof guardOrgScope === 'string' && guardOrgScope.trim()) {
    return guardOrgScope.trim();
  }
  const header = req.headers['x-association-id'] || req.headers['x-org-id'];
  const headerOrgId = Array.isArray(header) ? header[0] : header;
  const queryOrgId = typeof req.query?.orgId === 'string' ? req.query.orgId : undefined;
  return (headerOrgId || queryOrgId || '').toString().trim() || undefined;
}

export function getOrgId(user: AuthUser, req: Request): string {
  return getOrgScope(user, getRequestedOrgId(req));
}

export function getOrgScope(user: AuthUser, requestedOrgId?: string): string {
  const role = normalizeRole(user.role);
  const userOrgId = user.organizationId || undefined;

  if (role === Role.SUPERADMIN || role === 'SUPER_ADMIN') {
    const scopedOrgId = requestedOrgId || userOrgId;
    if (!scopedOrgId) {
      throw new BadRequestException('Organization scope is required');
    }
    return scopedOrgId;
  }

  if (!userOrgId) {
    throw new BadRequestException('Organization context missing');
  }

  return userOrgId;
}
