import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RequireOrganizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  private requiresOrganizationApproval() {
    return (process.env.AUTH_REQUIRE_ORG_APPROVAL ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler())) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const path = (request.path ?? request.url?.split('?')[0]) ?? '';
    if (path.startsWith('/admin') || path.startsWith('/sales') || path.startsWith('/api/superadmin')) {
      return true;
    }
    const { user } = request;
    if (!user?.organizationId) {
      throw new ForbiddenException(
        'Organization context required. Use Admin or Sales dashboard.',
      );
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { isActive: true, betaAccessEnabled: true, isDemo: true },
    });
    const requireOrgApproval = this.requiresOrganizationApproval();
    if (!org || (requireOrgApproval && !org.isActive)) {
      throw new ForbiddenException('Organization is deactivated.');
    }
    const role = String(user?.role || '').toUpperCase();
    const isSuperadmin = role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
    if (user?.isDemoUser && !org.isDemo) {
      throw new ForbiddenException('Demo users can access only demo organizations.');
    }
    if (requireOrgApproval && !isSuperadmin && !org.betaAccessEnabled) {
      throw new ForbiddenException('Accesul beta nu este activ pentru această organizație.');
    }
    return true;
  }
}
