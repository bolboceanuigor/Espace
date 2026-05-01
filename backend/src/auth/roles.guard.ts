import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationMemberStatus, Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { isSuperAdmin } from './rbac';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; sub?: string; role?: Role | string; organizationId?: string | null } | undefined;
    if (!user?.role) {
      throw new ForbiddenException('Missing user role');
    }

    if (isSuperAdmin(user)) {
      return true;
    }
    const currentRole = String(user.role).toUpperCase();
    if (requiredRoles.some((role) => String(role).toUpperCase() === currentRole)) return true;

    // Backwards-compatible organization-team access: ADMIN routes can be opened for active org members.
    if (
      requiredRoles.some((role) => String(role).toUpperCase() === Role.ADMIN) &&
      user.organizationId &&
      (user.id || user.sub)
    ) {
      const hasActiveMembership = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: user.organizationId,
          userId: user.id || user.sub,
          status: OrganizationMemberStatus.ACTIVE,
        },
        select: { id: true },
      });
      return Boolean(hasActiveMembership);
    }
    return false;
  }
}
