import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AssociationRoleType, OrganizationMemberRole, OrganizationMemberStatus, PlatformRole, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { permissionKey, resolvePermissions, type PermissionActionKey, type PermissionModuleKey, type TeamPermissionKey } from '../team/team-permissions';

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
    if (role === Role.SUPERADMIN || platformRole === PlatformRole.SUPER_ADMIN) {
      return true;
    }

    const associationContext = request.associationContext as { associationId?: string } | undefined;
    const organizationId = associationContext?.associationId || user.organizationId || null;
    if (!organizationId) throw new ForbiddenException('Organization context missing');

    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      include: {
        associationRole: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    // Backwards compatibility for existing ADMIN users not yet migrated to OrganizationMember.
    if (!member && role === Role.ADMIN) return true;
    if (member?.status === OrganizationMemberStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'STAFF_ACCESS_SUSPENDED',
        message: 'Accesul tău este suspendat.',
      });
    }
    if (member?.status === OrganizationMemberStatus.REVOKED || member?.status === OrganizationMemberStatus.DISABLED) {
      throw new ForbiddenException({
        code: 'STAFF_ACCESS_REVOKED',
        message: 'Accesul tău a fost revocat.',
      });
    }
    if (!member || member.status !== OrganizationMemberStatus.ACTIVE) {
      throw new ForbiddenException('Active organization membership required');
    }
    if (
      member.associationRole?.type === AssociationRoleType.ASSOCIATION_OWNER ||
      member.associationRole?.type === AssociationRoleType.ASSOCIATION_ADMIN
    ) {
      return true;
    }
    if (!member.associationRole && member.role === OrganizationMemberRole.ORG_ADMIN) return true;

    const effective = member.associationRole
      ? member.associationRole.rolePermissions.reduce<Record<string, boolean>>((acc, item) => {
          const key = permissionKey(item.permission.module as PermissionModuleKey, item.permission.action as PermissionActionKey);
          acc[key] = item.allowed;
          return acc;
        }, {})
      : resolvePermissions(member.role, member.permissionsJson);
    const allowed = required.every((permission) => effective[permission] === true);
    if (!allowed) throw new ForbiddenException('Missing required permissions');
    return true;
  }
}
