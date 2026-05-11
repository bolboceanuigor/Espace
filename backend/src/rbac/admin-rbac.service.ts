import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssociationRoleType,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  PermissionAction,
  PermissionModule,
  PlatformRole,
  Prisma,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ASSOCIATION_ROLE_PRESETS,
  PERMISSION_ACTIONS,
  PERMISSION_DEFINITIONS,
  PERMISSION_MODULES,
  permissionKey,
  permissionsToMap,
  resolvePermissions,
  type AssociationRoleTypeKey,
  type PermissionActionKey,
  type PermissionModuleKey,
  type TeamPermissionKey,
} from '../team/team-permissions';

type AuthUser = {
  id?: string;
  sub?: string;
  role?: Role | string;
  platformRole?: PlatformRole | string;
  organizationId?: string | null;
};

type RoleMutationPayload = {
  name?: unknown;
  description?: unknown;
  permissions?: unknown;
};

type MatrixMutationPayload = {
  roleId?: unknown;
  permissions?: unknown;
  roles?: unknown;
  confirmCritical?: unknown;
};

const PAGE_LIMIT_DEFAULT = 20;
const PAGE_LIMIT_MAX = 100;

function userIdOf(user: AuthUser) {
  return String(user.id || user.sub || '');
}

function organizationIdOf(user: AuthUser) {
  const organizationId = typeof user.organizationId === 'string' ? user.organizationId : '';
  if (!organizationId) throw new BadRequestException('Organization context missing');
  return organizationId;
}

function isSuperAdmin(user: AuthUser) {
  const role = String(user.role || '').toUpperCase();
  const platformRole = String(user.platformRole || '').toUpperCase();
  return role === Role.SUPERADMIN || platformRole === PlatformRole.SUPER_ADMIN;
}

function parsePage(value: unknown) {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseLimit(value: unknown) {
  const limit = Number(value || PAGE_LIMIT_DEFAULT);
  if (!Number.isFinite(limit) || limit < 1) return PAGE_LIMIT_DEFAULT;
  return Math.min(Math.floor(limit), PAGE_LIMIT_MAX);
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizePermissionsInput(input: unknown): Partial<Record<TeamPermissionKey, boolean>> {
  const result: Partial<Record<TeamPermissionKey, boolean>> = {};
  if (!input) return result;

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        result[item as TeamPermissionKey] = true;
      } else if (isRecord(item)) {
        const module = String(item.module || '').toUpperCase() as PermissionModuleKey;
        const action = String(item.action || '').toUpperCase() as PermissionActionKey;
        if (PERMISSION_MODULES.includes(module) && PERMISSION_ACTIONS.includes(action)) {
          result[permissionKey(module, action)] = item.allowed !== false;
        }
      }
    }
    return result;
  }

  if (isRecord(input)) {
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'boolean') {
        result[key as TeamPermissionKey] = value;
      }
    }
  }
  return result;
}

@Injectable()
export class AdminRbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async auditAction(user: AuthUser, action: string, entityType: string, entityId: string | null, description: string, oldValues?: unknown, newValues?: unknown) {
    const actorId = userIdOf(user);
    if (!actorId) return null;
    return this.audit.logAction({
      userId: actorId,
      organizationId: organizationIdOf(user),
      action,
      entityType,
      entityId,
      description,
      oldValuesJson: oldValues,
      newValuesJson: newValues,
    });
  }

  async ensurePermissionCatalog() {
    await Promise.all(
      PERMISSION_DEFINITIONS.map((definition) =>
        this.prisma.associationPermission.upsert({
          where: {
            module_action: {
              module: definition.module as PermissionModule,
              action: definition.action as PermissionAction,
            },
          },
          update: {
            label: definition.label,
            description: definition.description,
            isCritical: definition.isCritical,
          },
          create: {
            module: definition.module as PermissionModule,
            action: definition.action as PermissionAction,
            label: definition.label,
            description: definition.description,
            isCritical: definition.isCritical,
          },
        }),
      ),
    );
  }

  async ensureAssociationRoles(organizationId: string, actorUserId?: string) {
    await this.ensurePermissionCatalog();
    const permissions = await this.prisma.associationPermission.findMany();
    const permissionByKey = new Map(
      permissions.map((permission) => [
        permissionKey(permission.module as PermissionModuleKey, permission.action as PermissionActionKey),
        permission,
      ]),
    );

    for (const [type, preset] of Object.entries(ASSOCIATION_ROLE_PRESETS) as Array<
      [Exclude<AssociationRoleTypeKey, 'CUSTOM'>, (typeof ASSOCIATION_ROLE_PRESETS)[Exclude<AssociationRoleTypeKey, 'CUSTOM'>]]
    >) {
      let role = await this.prisma.associationRole.findFirst({
        where: { organizationId, type: type as AssociationRoleType, isSystem: true },
      });
      if (!role) {
        role = await this.prisma.associationRole.create({
          data: {
            organizationId,
            name: preset.name,
            description: preset.description,
            type: type as AssociationRoleType,
            isSystem: true,
            isDefault: preset.isDefault,
            createdById: actorUserId || null,
            updatedById: actorUserId || null,
          },
        });
      } else {
        role = await this.prisma.associationRole.update({
          where: { id: role.id },
          data: {
            name: role.name || preset.name,
            description: role.description || preset.description,
            isDefault: preset.isDefault,
            updatedById: actorUserId || role.updatedById,
          },
        });
      }

      await this.seedMissingRolePermissions(role.id, permissionsToMap(preset.permissions), permissionByKey);
    }
  }

  async ensureOwnerMembership(user: AuthUser) {
    const organizationId = organizationIdOf(user);
    const actorUserId = userIdOf(user);
    await this.ensureAssociationRoles(organizationId, actorUserId || undefined);
    if (!actorUserId || String(user.role || '').toUpperCase() !== Role.ADMIN) return;

    const ownerRole = await this.prisma.associationRole.findFirst({
      where: { organizationId, type: AssociationRoleType.ASSOCIATION_OWNER, isSystem: true },
      select: { id: true },
    });
    if (!ownerRole) return;

    const ownerCount = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        status: OrganizationMemberStatus.ACTIVE,
        associationRole: { type: AssociationRoleType.ASSOCIATION_OWNER },
      },
    });

    const existing = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: actorUserId },
      select: { id: true, associationRoleId: true },
    });

    if (existing) {
      if (ownerCount === 0 && !existing.associationRoleId) {
        await this.prisma.organizationMember.update({
          where: { id: existing.id },
          data: { associationRoleId: ownerRole.id, status: OrganizationMemberStatus.ACTIVE },
        });
      }
      return;
    }

    if (ownerCount === 0) {
      await this.prisma.organizationMember.create({
        data: {
          organizationId,
          userId: actorUserId,
          role: OrganizationMemberRole.ORG_ADMIN,
          associationRoleId: ownerRole.id,
          status: OrganizationMemberStatus.ACTIVE,
        },
      });
    }
  }

  private async permissionsPayload() {
    await this.ensurePermissionCatalog();
    const rows = await this.prisma.associationPermission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
    const orderByModule = new Map(PERMISSION_MODULES.map((module, index) => [module, index]));
    const orderByAction = new Map(PERMISSION_ACTIONS.map((action, index) => [action, index]));
    return rows
      .sort(
        (a, b) =>
          (orderByModule.get(a.module as PermissionModuleKey) ?? 999) - (orderByModule.get(b.module as PermissionModuleKey) ?? 999) ||
          (orderByAction.get(a.action as PermissionActionKey) ?? 999) - (orderByAction.get(b.action as PermissionActionKey) ?? 999),
      )
      .map((permission) => ({
        id: permission.id,
        module: permission.module,
        action: permission.action,
        key: permissionKey(permission.module as PermissionModuleKey, permission.action as PermissionActionKey),
        label: permission.label,
        description: permission.description,
        isCritical: permission.isCritical,
      }));
  }

  private async writeRolePermissions(
    roleId: string,
    permissionsInput: Partial<Record<TeamPermissionKey, boolean>>,
    permissionByKey?: Map<TeamPermissionKey, { id: string }>,
  ) {
    const permissions = permissionByKey
      ? Array.from(permissionByKey.entries())
      : (await this.prisma.associationPermission.findMany()).map((permission) => [
          permissionKey(permission.module as PermissionModuleKey, permission.action as PermissionActionKey),
          permission,
        ] as [TeamPermissionKey, { id: string }]);

    await Promise.all(
      permissions.map(([key, permission]) =>
        this.prisma.associationRolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          update: { allowed: permissionsInput[key] === true },
          create: { roleId, permissionId: permission.id, allowed: permissionsInput[key] === true },
        }),
      ),
    );
  }

  private async seedMissingRolePermissions(
    roleId: string,
    permissionsInput: Partial<Record<TeamPermissionKey, boolean>>,
    permissionByKey: Map<TeamPermissionKey, { id: string }>,
  ) {
    const existing = await this.prisma.associationRolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    const existingIds = new Set(existing.map((item) => item.permissionId));
    const missing = Array.from(permissionByKey.entries()).filter(([, permission]) => !existingIds.has(permission.id));
    if (!missing.length) return;
    await this.prisma.associationRolePermission.createMany({
      data: missing.map(([key, permission]) => ({
        roleId,
        permissionId: permission.id,
        allowed: permissionsInput[key] === true,
      })),
      skipDuplicates: true,
    });
  }

  private serializeRole(
    role: Prisma.AssociationRoleGetPayload<{
      include: {
        _count: { select: { members: true } };
        rolePermissions: { include: { permission: true } };
      };
    }>,
  ) {
    const permissionMap: Record<string, boolean> = {};
    for (const definition of PERMISSION_DEFINITIONS) {
      permissionMap[definition.key] = false;
    }
    for (const rolePermission of role.rolePermissions || []) {
      const key = permissionKey(rolePermission.permission.module as PermissionModuleKey, rolePermission.permission.action as PermissionActionKey);
      permissionMap[key] = rolePermission.allowed;
    }
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      type: role.type,
      isSystem: role.isSystem,
      isDefault: role.isDefault,
      membersCount: role._count?.members || 0,
      permissions: permissionMap,
      allowedPermissions: Object.entries(permissionMap)
        .filter(([, allowed]) => allowed)
        .map(([key]) => key),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private async getRoleOrThrow(organizationId: string, roleId: string) {
    const role = await this.prisma.associationRole.findFirst({
      where: { id: roleId, organizationId },
      include: {
        _count: { select: { members: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async listRoles(user: AuthUser) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const roles = await this.prisma.associationRole.findMany({
      where: { organizationId },
      include: {
        _count: { select: { members: true } },
        rolePermissions: { include: { permission: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return {
      items: roles.map((role) => this.serializeRole(role)),
      presets: ASSOCIATION_ROLE_PRESETS,
    };
  }

  async createRole(user: AuthUser, payload: RoleMutationPayload) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const actorUserId = userIdOf(user);
    const name = normalizeText(payload.name);
    if (!name) throw new BadRequestException('Role name is required');
    const role = await this.prisma.associationRole.create({
      data: {
        organizationId,
        name,
        description: normalizeText(payload.description) || null,
        type: AssociationRoleType.CUSTOM,
        isSystem: false,
        isDefault: false,
        createdById: actorUserId || null,
        updatedById: actorUserId || null,
      },
      include: {
        _count: { select: { members: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
    await this.writeRolePermissions(role.id, normalizePermissionsInput(payload.permissions));
    await this.auditAction(user, 'ROLE_CREATED', 'ASSOCIATION_ROLE', role.id, `Rol creat: ${name}`, null, { name });
    return this.getRole(user, role.id);
  }

  async getRole(user: AuthUser, roleId: string) {
    await this.ensureOwnerMembership(user);
    return this.serializeRole(await this.getRoleOrThrow(organizationIdOf(user), roleId));
  }

  async updateRole(user: AuthUser, roleId: string, payload: RoleMutationPayload) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const before = await this.getRoleOrThrow(organizationId, roleId);
    const data: Prisma.AssociationRoleUpdateInput = { updatedBy: userIdOf(user) ? { connect: { id: userIdOf(user) } } : undefined };
    const name = normalizeText(payload.name);
    if (name) data.name = name;
    if (payload.description !== undefined) data.description = normalizeText(payload.description) || null;
    const updated = await this.prisma.associationRole.update({
      where: { id: before.id },
      data,
      include: {
        _count: { select: { members: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
    await this.auditAction(user, 'ROLE_UPDATED', 'ASSOCIATION_ROLE', roleId, `Rol actualizat: ${updated.name}`, this.serializeRole(before), this.serializeRole(updated));
    return this.serializeRole(updated);
  }

  async deleteRole(user: AuthUser, roleId: string) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const role = await this.getRoleOrThrow(organizationId, roleId);
    if (role.isSystem || role.type !== AssociationRoleType.CUSTOM) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    if ((role._count?.members || 0) > 0) {
      throw new BadRequestException('Role is assigned to team members and cannot be deleted');
    }
    await this.prisma.associationRole.delete({ where: { id: role.id } });
    await this.auditAction(user, 'ROLE_DELETED', 'ASSOCIATION_ROLE', roleId, `Rol sters: ${role.name}`, this.serializeRole(role), null);
    return { success: true };
  }

  async duplicateRole(user: AuthUser, roleId: string) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const source = await this.getRoleOrThrow(organizationId, roleId);
    const role = await this.prisma.associationRole.create({
      data: {
        organizationId,
        name: `${source.name} copy`,
        description: source.description,
        type: AssociationRoleType.CUSTOM,
        isSystem: false,
        isDefault: false,
        createdById: userIdOf(user) || null,
        updatedById: userIdOf(user) || null,
      },
    });
    const permissionMap = this.serializeRole(source).permissions as Record<TeamPermissionKey, boolean>;
    await this.writeRolePermissions(role.id, permissionMap);
    await this.auditAction(user, 'ROLE_DUPLICATED', 'ASSOCIATION_ROLE', role.id, `Rol duplicat din ${source.name}`, { sourceRoleId: source.id }, { roleId: role.id });
    return this.getRole(user, role.id);
  }

  async updateRolePermissions(user: AuthUser, roleId: string, payload: MatrixMutationPayload) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const role = await this.getRoleOrThrow(organizationId, roleId);
    const permissions = normalizePermissionsInput(payload.permissions);
    const grantsCritical = PERMISSION_DEFINITIONS.some((definition) => definition.isCritical && permissions[definition.key] === true);
    if (grantsCritical && payload.confirmCritical !== true) {
      throw new BadRequestException('Critical permissions require explicit confirmation');
    }
    const before = this.serializeRole(role);
    await this.writeRolePermissions(role.id, permissions);
    const after = await this.getRole(user, role.id);
    await this.auditAction(user, 'ROLE_PERMISSIONS_UPDATED', 'ASSOCIATION_ROLE', role.id, `Permisiuni actualizate pentru ${role.name}`, before.permissions, after.permissions);
    return after;
  }

  async resetPreset(user: AuthUser, roleId: string) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const role = await this.getRoleOrThrow(organizationId, roleId);
    if (!role.isSystem || role.type === AssociationRoleType.CUSTOM) {
      throw new BadRequestException('Only system roles can be reset to preset');
    }
    const preset = ASSOCIATION_ROLE_PRESETS[role.type as Exclude<AssociationRoleTypeKey, 'CUSTOM'>];
    if (!preset) throw new BadRequestException('Preset not found');
    const before = this.serializeRole(role);
    await this.prisma.associationRole.update({
      where: { id: role.id },
      data: {
        name: preset.name,
        description: preset.description,
        isDefault: preset.isDefault,
        updatedById: userIdOf(user) || null,
      },
    });
    await this.writeRolePermissions(role.id, permissionsToMap(preset.permissions));
    const after = await this.getRole(user, role.id);
    await this.auditAction(user, 'ROLE_PRESET_RESET', 'ASSOCIATION_ROLE', role.id, `Preset resetat pentru ${role.name}`, before, after);
    return after;
  }

  async listPermissions(user: AuthUser) {
    await this.ensureOwnerMembership(user);
    const permissions = await this.permissionsPayload();
    const grouped = PERMISSION_MODULES.map((module) => ({
      module,
      label: module.replace(/_/g, ' '),
      permissions: permissions.filter((permission) => permission.module === module),
    })).filter((group) => group.permissions.length > 0);
    return { items: permissions, modules: grouped, actions: PERMISSION_ACTIONS };
  }

  async getMatrix(user: AuthUser) {
    const [roles, permissions] = await Promise.all([this.listRoles(user), this.listPermissions(user)]);
    return {
      roles: roles.items,
      permissions: permissions.items,
      modules: permissions.modules,
      actions: PERMISSION_ACTIONS,
      criticalPermissions: PERMISSION_DEFINITIONS.filter((permission) => permission.isCritical).map((permission) => permission.key),
    };
  }

  async updateMatrix(user: AuthUser, payload: MatrixMutationPayload) {
    await this.ensureOwnerMembership(user);
    if (typeof payload.roleId === 'string') {
      return this.updateRolePermissions(user, payload.roleId, payload);
    }
    if (!Array.isArray(payload.roles)) {
      throw new BadRequestException('roleId or roles payload is required');
    }
    const updated = [];
    for (const rolePayload of payload.roles) {
      if (!isRecord(rolePayload) || typeof rolePayload.roleId !== 'string') continue;
      updated.push(
        await this.updateRolePermissions(user, rolePayload.roleId, {
          permissions: rolePayload.permissions,
          confirmCritical: payload.confirmCritical,
        }),
      );
    }
    return { items: updated };
  }

  async myPermissions(user: AuthUser) {
    await this.ensureOwnerMembership(user);
    if (isSuperAdmin(user)) {
      return {
        permissions: permissionsToMap(PERMISSION_DEFINITIONS.map((definition) => definition.key)),
        role: { type: 'SUPERADMIN', name: 'Superadmin' },
      };
    }
    const organizationId = organizationIdOf(user);
    const member = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: userIdOf(user) },
      include: {
        associationRole: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    if (!member) {
      return {
        permissions: permissionsToMap(PERMISSION_DEFINITIONS.map((definition) => definition.key)),
        role: { type: 'ASSOCIATION_OWNER', name: 'Administrator principal' },
        fallback: true,
      };
    }
    if (member.associationRole) {
      const permissions: Record<string, boolean> = {};
      for (const definition of PERMISSION_DEFINITIONS) permissions[definition.key] = false;
      for (const rolePermission of member.associationRole.rolePermissions) {
        permissions[permissionKey(rolePermission.permission.module as PermissionModuleKey, rolePermission.permission.action as PermissionActionKey)] =
          rolePermission.allowed;
      }
      return {
        permissions,
        role: {
          id: member.associationRole.id,
          name: member.associationRole.name,
          type: member.associationRole.type,
          isSystem: member.associationRole.isSystem,
        },
      };
    }
    return {
      permissions: resolvePermissions(member.role, member.permissionsJson),
      role: { type: member.role, name: member.role },
      legacy: true,
    };
  }

  async getTeamMemberPermissions(user: AuthUser, memberId: string) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        associationRole: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    if (!member) throw new NotFoundException('Team member not found');
    const roles = await this.listRoles(user);
    const effective = member.associationRole
      ? this.serializeRole({
          ...member.associationRole,
          _count: { members: 0 },
        } as any).permissions
      : resolvePermissions(member.role, member.permissionsJson);
    return {
      member: {
        id: member.id,
        userId: member.userId,
        fullName: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim() || member.user.email,
        email: member.user.email,
        status: member.status,
        legacyRole: member.role,
        roleId: member.associationRoleId,
        role: member.associationRole
          ? {
              id: member.associationRole.id,
              name: member.associationRole.name,
              type: member.associationRole.type,
              isSystem: member.associationRole.isSystem,
            }
          : null,
      },
      permissions: effective,
      availableRoles: roles.items,
    };
  }

  private async assertOwnerWillRemain(organizationId: string, targetMemberId: string, nextRoleId: string) {
    const target = await this.prisma.organizationMember.findFirst({
      where: { id: targetMemberId, organizationId },
      include: { associationRole: true },
    });
    if (!target) throw new NotFoundException('Team member not found');
    if (target.associationRole?.type !== AssociationRoleType.ASSOCIATION_OWNER) return target;
    const nextRole = await this.prisma.associationRole.findFirst({ where: { id: nextRoleId, organizationId } });
    if (nextRole?.type === AssociationRoleType.ASSOCIATION_OWNER) return target;
    const otherOwners = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        id: { not: targetMemberId },
        status: OrganizationMemberStatus.ACTIVE,
        associationRole: { type: AssociationRoleType.ASSOCIATION_OWNER },
      },
    });
    if (otherOwners < 1) {
      throw new BadRequestException('Cannot remove the last association owner');
    }
    return target;
  }

  async updateTeamMemberRole(user: AuthUser, memberId: string, payload: { roleId?: unknown; confirm?: unknown }) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const roleId = normalizeText(payload.roleId);
    if (!roleId) throw new BadRequestException('roleId is required');
    const role = await this.prisma.associationRole.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Role not found');
    const before = await this.assertOwnerWillRemain(organizationId, memberId, roleId);
    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        associationRoleId: roleId,
        role: role.type === AssociationRoleType.ASSOCIATION_OWNER || role.type === AssociationRoleType.ASSOCIATION_ADMIN ? OrganizationMemberRole.ORG_ADMIN : before.role,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        associationRole: true,
      },
    });
    await this.auditAction(user, 'TEAM_MEMBER_ROLE_CHANGED', 'ORGANIZATION_MEMBER', memberId, `Rol schimbat pentru ${updated.user.email}`, { roleId: before.associationRoleId }, { roleId });
    return this.getTeamMemberPermissions(user, memberId);
  }

  async listTeamMembers(user: AuthUser, query: Record<string, unknown>) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          associationRole: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organizationMember.count({ where: { organizationId } }),
    ]);
    return {
      items: items.map((member) => ({
        id: member.id,
        userId: member.userId,
        fullName: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim() || member.user.email,
        email: member.user.email,
        status: member.status,
        roleId: member.associationRoleId,
        role: member.associationRole ? { id: member.associationRole.id, name: member.associationRole.name, type: member.associationRole.type } : null,
        legacyRole: member.role,
      })),
      meta: { page, limit, total },
    };
  }
}
