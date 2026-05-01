import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationMemberRole, OrganizationMemberStatus, PlatformRole, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { resolvePermissions, type TeamPermissionKey } from '../team/team-permissions';

type RequestUser = {
  id?: string;
  sub?: string;
  role?: Role | string;
  platformRole?: PlatformRole | string;
  organizationId?: string | null;
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<TeamPermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = (request.user || {}) as RequestUser;
    const userId = user.id || user.sub;
    if (!userId) throw new ForbiddenException('Missing user id');

    const role = String(user.role || '').toUpperCase();
    const platformRole = String(user.platformRole || '').toUpperCase();
    if (role === Role.SUPERADMIN || role === Role.SUPER_ADMIN || platformRole === PlatformRole.SUPER_ADMIN) {
      return true;
    }

    const organizationId = user.organizationId || null;
    if (!organizationId) throw new ForbiddenException('Organization context missing');

    // Backwards compatibility for existing ADMIN users not yet migrated to OrganizationMember.
    if (role === Role.ADMIN) return true;

    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { role: true, status: true, permissionsJson: true },
    });
    if (!member || member.status !== OrganizationMemberStatus.ACTIVE) {
      throw new ForbiddenException('Active organization membership required');
    }
    if (member.role === OrganizationMemberRole.ORG_ADMIN) return true;

    const effective = resolvePermissions(member.role, member.permissionsJson);
    const allowed = required.every((permission) => effective[permission] === true);
    if (!allowed) throw new ForbiddenException('Missing required permissions');
    return true;
  }
}

