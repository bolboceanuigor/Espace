import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { getRequestedOrgId } from '../../common/org-scope';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler())) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; sub?: string; role?: string; organizationId?: string | null; isDemoUser?: boolean } | undefined;
    if (!user) {
      return true;
    }

    const role = String(user.role || '').toUpperCase();
    const requestedOrgId = getRequestedOrgId(request);
    const userOrgId = user.organizationId || undefined;
    if (user.isDemoUser) {
      if (!userOrgId) {
        throw new ForbiddenException('Demo organization context missing');
      }
      if (requestedOrgId && requestedOrgId !== userOrgId) {
        throw new ForbiddenException('Demo users cannot access other organizations');
      }
      request.orgScopeId = userOrgId;
      return true;
    }

    if (role === 'SUPERADMIN' || role === 'SUPER_ADMIN') {
      const currentUserId = user.id || user.sub;
      let supportOrgId: string | null = null;
      let supportSessionId: string | null = null;
      if (currentUserId) {
        const activeSupportSession = await this.prisma.supportSession.findFirst({
          where: { superAdminUserId: currentUserId, isActive: true },
          orderBy: { startedAt: 'desc' },
          select: { id: true, organizationId: true },
        });
        supportOrgId = activeSupportSession?.organizationId || null;
        supportSessionId = activeSupportSession?.id || null;
      }
      request.supportSessionId = supportSessionId;
      request.orgScopeId = requestedOrgId || supportOrgId || userOrgId || null;
      return true;
    }

    if (!userOrgId) {
      throw new ForbiddenException('Organization context missing');
    }

    if (requestedOrgId && requestedOrgId !== userOrgId) {
      throw new ForbiddenException('Cross-organization access is forbidden');
    }

    request.orgScopeId = userOrgId;
    return true;
  }
}
