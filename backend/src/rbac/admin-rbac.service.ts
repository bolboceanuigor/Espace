import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssociationRoleType,
  AuthProvider,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  NotificationChannel,
  PermissionAction,
  PermissionModule,
  PlatformRole,
  Prisma,
  Role,
  StaffInvitationDeliveryMethod,
  StaffInvitationStatus,
  TransactionalNotificationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { TransactionalNotificationsService } from '../notifications/transactional-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamActivityRiskService } from './team-activity-risk.service';
import {
  ASSOCIATION_ROLE_PRESETS,
  PERMISSION_ACTIONS,
  PERMISSION_DEFINITIONS,
  PERMISSION_MODULES,
  applyPermissionAliases,
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

type StaffInvitationPayload = {
  invitedFullName?: unknown;
  invitedEmail?: unknown;
  invitedPhone?: unknown;
  roleId?: unknown;
  deliveryMethod?: unknown;
  expiresInDays?: unknown;
  message?: unknown;
  confirmReplaceActive?: unknown;
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

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseExpiresInDays(value: unknown) {
  const days = Number(value || 7);
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    throw new BadRequestException('expiresInDays must be between 1 and 30');
  }
  return Math.floor(days);
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function generateSecureToken() {
  return randomBytes(32).toString('base64url');
}

function effectiveStaffInvitationStatus(status: StaffInvitationStatus, expiresAt: Date) {
  if ((status === StaffInvitationStatus.PENDING || status === StaffInvitationStatus.SENT) && expiresAt.getTime() < Date.now()) {
    return StaffInvitationStatus.EXPIRED;
  }
  return status;
}

function legacyRoleForAssociationRole(type: AssociationRoleType) {
  if (type === AssociationRoleType.ASSOCIATION_OWNER || type === AssociationRoleType.ASSOCIATION_ADMIN) {
    return OrganizationMemberRole.ORG_ADMIN;
  }
  if (type === AssociationRoleType.FINANCE_OPERATOR) return OrganizationMemberRole.ACCOUNTANT;
  if (type === AssociationRoleType.METER_OPERATOR) return OrganizationMemberRole.TECHNICIAN;
  return OrganizationMemberRole.OPERATOR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseDateFilter(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateToFilter(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) date.setHours(23, 59, 59, 999);
  return date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function activitySeverity(action: string, payload: Record<string, unknown>) {
  const explicit = normalizeText(payload.severity || payload.status).toUpperCase();
  if (['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(explicit)) return explicit;
  const key = action.toUpperCase();
  if (key.includes('FAILED') || key.includes('REJECTED') || key.includes('ERROR')) return 'ERROR';
  if (key.includes('CANCELLED') || key.includes('SUSPENDED') || key.includes('REVOKED') || key.includes('BLOCKED')) return 'WARNING';
  if (key.includes('LOGIN_SUCCESS') || key.includes('ACCEPTED') || key.includes('CREATED') || key.includes('UPDATED')) return 'SUCCESS';
  return 'INFO';
}

function riskOrder(risk: string) {
  return ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as Record<string, number>)[risk] || 0;
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
    private readonly teamActivityRisk: TeamActivityRiskService,
    private readonly transactionalNotifications: TransactionalNotificationsService,
  ) {}

  private buildStaffInviteLink(token: string, locale = 'ro') {
    const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3001').replace(/\/+$/, '');
    return `${appUrl}/${locale}/staff-invite/${token}`;
  }

  private serializeRoleForPreview(role: Prisma.AssociationRoleGetPayload<{ include: { rolePermissions: { include: { permission: true } } } }>) {
    const grouped = new Map<string, string[]>();
    const critical: string[] = [];
    for (const item of role.rolePermissions || []) {
      if (!item.allowed) continue;
      const module = String(item.permission.module);
      const action = String(item.permission.action);
      grouped.set(module, [...(grouped.get(module) || []), action]);
      if (item.permission.isCritical) critical.push(permissionKey(item.permission.module as PermissionModuleKey, item.permission.action as PermissionActionKey));
    }
    return {
      id: role.id,
      name: role.name,
      type: role.type,
      isSystem: role.isSystem,
      permissionsPreview: Array.from(grouped.entries()).map(([module, actions]) => ({ module, actions })),
      criticalPermissions: critical,
    };
  }

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

  private async assertAnyPermission(user: AuthUser, permissions: TeamPermissionKey[]) {
    const current = await this.myPermissions(user);
    const map = current.permissions || {};
    if (permissions.some((permission) => map[permission])) return;
    throw new ForbiddenException('Nu ai permisiunea necesară.');
  }

  private actorDisplayName(user?: { email?: string | null; fullName?: string | null; firstName?: string | null; lastName?: string | null } | null) {
    if (!user) return 'Sistem';
    return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Sistem';
  }

  private async activityRoleMap(organizationId: string, userIds: string[]) {
    if (!userIds.length) return new Map<string, any>();
    const memberships = await this.prisma.organizationMember.findMany({
      where: { organizationId, userId: { in: Array.from(new Set(userIds)) } },
      include: { associationRole: true },
    });
    return new Map(memberships.map((membership) => [membership.userId, membership]));
  }

  private serializeActivityLog(row: any, roleByUserId: Map<string, any>) {
    const newValues = isRecord(row.newValuesJson) ? row.newValuesJson : {};
    const oldValues = isRecord(row.oldValuesJson) ? row.oldValuesJson : {};
    const metadataSource = isRecord(newValues.metadata) ? newValues.metadata : newValues;
    const metadata = this.teamActivityRisk.sanitizeMetadata(metadataSource) as Record<string, unknown>;
    const beforeSnapshot = this.teamActivityRisk.sanitizeMetadata(oldValues.beforeSnapshot ?? oldValues);
    const afterSnapshot = this.teamActivityRisk.sanitizeMetadata(newValues.afterSnapshot ?? null);
    const category = this.teamActivityRisk.mapAuditActionToCategory(row.action, row.entityType);
    const riskLevel = this.teamActivityRisk.mapAuditActionToRisk(row.action, row.entityType);
    const member = roleByUserId.get(row.userId);
    const title = normalizeText(metadata.title) || row.description || row.action.replace(/_/g, ' ');
    const message = normalizeText(metadata.message) || row.description || title;
    return {
      id: row.id,
      createdAt: row.createdAt,
      actor: row.user
        ? {
            id: row.user.id,
            fullName: this.actorDisplayName(row.user),
            email: row.user.email,
          }
        : null,
      actorRole: member?.associationRole
        ? {
            id: member.associationRole.id,
            name: member.associationRole.name,
            type: member.associationRole.type,
          }
        : member
          ? {
              id: null,
              name: member.role,
              type: member.role,
            }
          : null,
      action: row.action,
      category,
      riskLevel,
      isSensitiveAction: this.teamActivityRisk.isSensitiveAction(row.action, row.entityType),
      severity: activitySeverity(row.action, metadata),
      entityType: row.entityType,
      entityId: row.entityId,
      title,
      message,
      description: row.description,
      actionUrl: normalizeText(metadata.actionUrl) || this.teamActivityRisk.buildActionUrl(row.entityType, row.entityId, metadata),
      metadata,
      beforeSnapshot,
      afterSnapshot,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    };
  }

  private filterActivityItems(items: any[], query: Record<string, unknown>) {
    const category = normalizeText(query.category).toUpperCase();
    const action = normalizeText(query.action).toUpperCase();
    const riskLevel = normalizeText(query.riskLevel).toUpperCase();
    const severity = normalizeText(query.severity).toUpperCase();
    const entityType = normalizeText(query.entityType).toUpperCase();
    const search = normalizeText(query.search).toLowerCase();
    const sensitiveOnly = query.sensitiveOnly === true || query.sensitiveOnly === 'true';
    const failedOnly = query.failedOnly === true || query.failedOnly === 'true';
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (action && !String(item.action || '').toUpperCase().includes(action)) return false;
      if (riskLevel && item.riskLevel !== riskLevel) return false;
      if (severity && item.severity !== severity) return false;
      if (entityType && String(item.entityType || '').toUpperCase() !== entityType) return false;
      if (sensitiveOnly && !item.isSensitiveAction) return false;
      if (failedOnly && item.severity !== 'ERROR' && !String(item.action || '').toUpperCase().includes('FAILED')) return false;
      if (search) {
        const haystack = [
          item.actor?.fullName,
          item.actor?.email,
          item.actorRole?.name,
          item.title,
          item.message,
          item.action,
          item.category,
          item.entityType,
          item.entityId,
          JSON.stringify(item.metadata || {}),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  private sortActivityItems(items: any[], query: Record<string, unknown>) {
    const sortBy = normalizeText(query.sortBy) || 'newest';
    const direction = normalizeText(query.sortDirection).toLowerCase() === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'risk' || sortBy === 'riskLevel') return (riskOrder(a.riskLevel) - riskOrder(b.riskLevel)) * -1;
      if (sortBy === 'actor') return String(a.actor?.fullName || '').localeCompare(String(b.actor?.fullName || '')) * direction;
      if (sortBy === 'category') return String(a.category || '').localeCompare(String(b.category || '')) * direction;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });
  }

  private activityStats(items: any[]) {
    const today = startOfToday().getTime();
    const byDate = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const last = byDate[0] || null;
    const lastCritical = byDate.find((item) => item.riskLevel === 'CRITICAL') || null;
    return {
      today: items.filter((item) => new Date(item.createdAt).getTime() >= today).length,
      sensitive: items.filter((item) => item.isSensitiveAction).length,
      critical: items.filter((item) => item.riskLevel === 'CRITICAL').length,
      high: items.filter((item) => item.riskLevel === 'HIGH').length,
      loginSuccess: items.filter((item) => item.action === 'LOGIN_SUCCESS').length,
      loginFailed: items.filter((item) => item.action === 'LOGIN_FAILED').length,
      lastActivityAt: last?.createdAt || null,
      lastCriticalAt: lastCritical?.createdAt || null,
    };
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
        permissions: applyPermissionAliases(permissions as any),
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
    const status = normalizeText(query.status);
    const roleId = normalizeText(query.roleId);
    const search = normalizeText(query.search).toLowerCase();
    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId,
      ...(status ? { status: status as OrganizationMemberStatus } : {}),
      ...(roleId ? { associationRoleId: roleId } : {}),
      ...(search
        ? {
            OR: [
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
          associationRole: true,
          createdBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organizationMember.count({ where }),
    ]);
    const userIds = items.map((member) => member.userId);
    const loginRows = userIds.length
      ? await this.prisma.auditLog.findMany({
          where: { organizationId, userId: { in: userIds }, action: 'LOGIN_SUCCESS' },
          orderBy: { createdAt: 'desc' },
          select: { userId: true, createdAt: true },
        })
      : [];
    const lastLoginByUser = new Map<string, Date>();
    for (const row of loginRows) {
      if (!lastLoginByUser.has(row.userId)) lastLoginByUser.set(row.userId, row.createdAt);
    }
    return {
      items: items.map((member) => ({
        id: member.id,
        userId: member.userId,
        fullName: member.user.fullName || [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim() || member.user.email,
        email: member.user.email,
        status: member.status,
        roleId: member.associationRoleId,
        role: member.associationRole ? { id: member.associationRole.id, name: member.associationRole.name, type: member.associationRole.type } : null,
        legacyRole: member.role,
        invitedAt: member.invitedAt,
        activatedAt: member.activatedAt,
        suspendedAt: member.suspendedAt,
        revokedAt: member.revokedAt,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        lastLoginAt: lastLoginByUser.get(member.userId) || null,
        invitedBy: member.createdBy
          ? {
              id: member.createdBy.id,
              fullName:
                member.createdBy.fullName ||
                [member.createdBy.firstName, member.createdBy.lastName].filter(Boolean).join(' ').trim() ||
                member.createdBy.email,
              email: member.createdBy.email,
            }
          : null,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: await this.getTeamStats(user),
    };
  }

  async getTeamStats(user: AuthUser) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const now = new Date();
    const [active, invited, suspended, revoked, expiredInvitations, pendingInvitations, customRoles, lastInvitation] =
      await Promise.all([
        this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.ACTIVE } }),
        this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.INVITED } }),
        this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.SUSPENDED } }),
        this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.REVOKED } }),
        this.prisma.associationStaffInvitation.count({
          where: {
            associationId: organizationId,
            OR: [
              { status: StaffInvitationStatus.EXPIRED },
              { status: { in: [StaffInvitationStatus.PENDING, StaffInvitationStatus.SENT] }, expiresAt: { lt: now } },
            ],
          },
        }),
        this.prisma.associationStaffInvitation.count({
          where: { associationId: organizationId, status: { in: [StaffInvitationStatus.PENDING, StaffInvitationStatus.SENT] }, expiresAt: { gte: now } },
        }),
        this.prisma.associationRole.count({ where: { organizationId, type: AssociationRoleType.CUSTOM } }),
        this.prisma.associationStaffInvitation.findFirst({
          where: { associationId: organizationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, invitedEmail: true, status: true, expiresAt: true, createdAt: true },
        }),
      ]);
    return {
      active,
      invited,
      suspended,
      revoked,
      pendingInvitations,
      expiredInvitations,
      customRoles,
      lastInvitation: lastInvitation
        ? { ...lastInvitation, status: effectiveStaffInvitationStatus(lastInvitation.status, lastInvitation.expiresAt) }
        : null,
    };
  }

  private async assertOwnerCanBeInactive(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: { associationRole: true },
    });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.associationRole?.type !== AssociationRoleType.ASSOCIATION_OWNER) return member;
    const otherOwners = await this.prisma.organizationMember.count({
      where: {
        organizationId,
        id: { not: memberId },
        status: OrganizationMemberStatus.ACTIVE,
        associationRole: { type: AssociationRoleType.ASSOCIATION_OWNER },
      },
    });
    if (otherOwners < 1) throw new BadRequestException('Cannot suspend or revoke the last association owner');
    return member;
  }

  private async activityItemsForOrganization(user: AuthUser, query: Record<string, unknown>, forcedActorUserId?: string) {
    const organizationId = organizationIdOf(user);
    const actorUserId = forcedActorUserId || normalizeText(query.actorUserId);
    const dateFrom = parseDateFilter(query.dateFrom);
    const dateTo = parseDateToFilter(query.dateTo);
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(actorUserId ? { userId: actorUserId } : {}),
      ...(normalizeText(query.entityType) ? { entityType: normalizeText(query.entityType) } : {}),
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const roleByUserId = await this.activityRoleMap(
      organizationId,
      rows.map((row) => row.userId),
    );
    return this.sortActivityItems(
      this.filterActivityItems(
        rows.map((row) => this.serializeActivityLog(row, roleByUserId)),
        query,
      ),
      query,
    );
  }

  async listTeamActivity(user: AuthUser, query: Record<string, unknown>) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view', 'team.manage']);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const items = await this.activityItemsForOrganization(user, query);
    const total = items.length;
    return {
      items: items.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: await this.getTeamActivityStats(user, query),
    };
  }

  async getTeamActivityStats(user: AuthUser, query: Record<string, unknown> = {}) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view', 'team.manage']);
    const organizationId = organizationIdOf(user);
    const items = await this.activityItemsForOrganization(user, query);
    const [activeMembers, suspendedMembers] = await Promise.all([
      this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.ACTIVE } }),
      this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.SUSPENDED } }),
    ]);
    return {
      ...this.activityStats(items),
      activeMembers,
      suspendedMembers,
    };
  }

  async getTeamActivityDetail(user: AuthUser, activityId: string) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view', 'team.manage']);
    const organizationId = organizationIdOf(user);
    const row = await this.prisma.auditLog.findFirst({
      where: { id: activityId, organizationId },
      include: { user: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } } },
    });
    if (!row) throw new NotFoundException('Activity log not found');
    const roleByUserId = await this.activityRoleMap(organizationId, [row.userId]);
    return this.serializeActivityLog(row, roleByUserId);
  }

  async listSensitiveTeamActions(user: AuthUser, query: Record<string, unknown>) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view']);
    return this.listTeamActivity(user, { ...query, sensitiveOnly: true, sortBy: normalizeText(query.sortBy) || 'risk' });
  }

  private isSecurityActivity(item: any) {
    const key = `${item.action || ''} ${item.category || ''}`.toUpperCase();
    return (
      item.category === 'AUTH' ||
      key.includes('LOGIN') ||
      key.includes('PASSWORD') ||
      key.includes('SESSION') ||
      key.includes('ACCESS_BLOCKED') ||
      key.includes('SUSPENDED') ||
      key.includes('REVOKED') ||
      key.includes('INVITATION')
    );
  }

  async listTeamSecurity(user: AuthUser, query: Record<string, unknown>) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view', 'settings.manage']);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const items = (await this.activityItemsForOrganization(user, query)).filter((item) => this.isSecurityActivity(item));
    const total = items.length;
    return {
      items: items.slice((page - 1) * limit, page * limit).map((item) => ({
        ...item,
        eventType: item.action,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: await this.getTeamSecurityStats(user, query),
    };
  }

  async getTeamSecurityStats(user: AuthUser, query: Record<string, unknown> = {}) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view', 'settings.manage']);
    const organizationId = organizationIdOf(user);
    const today = startOfToday();
    const [loginSuccessToday, loginFailedToday, blockedAccess, passwordResetRequests, suspended, revoked, expiredInvitations] = await Promise.all([
      this.prisma.auditLog.count({ where: { organizationId, action: 'LOGIN_SUCCESS', createdAt: { gte: today } } }),
      this.prisma.auditLog.count({ where: { organizationId, action: 'LOGIN_FAILED', createdAt: { gte: today } } }),
      this.prisma.auditLog.count({ where: { organizationId, action: { contains: 'BLOCKED' } } }),
      this.prisma.auditLog.count({ where: { organizationId, action: { contains: 'PASSWORD_RESET' } } }),
      this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.SUSPENDED } }),
      this.prisma.organizationMember.count({ where: { organizationId, status: OrganizationMemberStatus.REVOKED } }),
      this.prisma.associationStaffInvitation.count({
        where: {
          associationId: organizationId,
          OR: [
            { status: StaffInvitationStatus.EXPIRED },
            { status: { in: [StaffInvitationStatus.PENDING, StaffInvitationStatus.SENT] }, expiresAt: { lt: new Date() } },
          ],
        },
      }),
    ]);
    return {
      loginSuccessToday,
      loginFailedToday,
      blockedAccess,
      passwordResetRequests,
      suspended,
      revoked,
      expiredInvitations,
    };
  }

  async getTeamMember(user: AuthUser, memberId: string) {
    await this.ensureOwnerMembership(user);
    const details = await this.getTeamMemberPermissions(user, memberId);
    const activity = await this.activityItemsForOrganization(user, { limit: 5 }, details.member.userId);
    return { ...details.member, permissions: details.permissions, availableRoles: details.availableRoles, activity: activity.slice(0, 5) };
  }

  async suspendTeamMember(user: AuthUser, memberId: string, payload: { reason?: unknown }) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const reason = normalizeText(payload.reason);
    if (!reason) throw new BadRequestException('Suspension reason is required');
    const before = await this.assertOwnerCanBeInactive(organizationId, memberId);
    const updated = await this.prisma.organizationMember.update({
      where: { id: before.id },
      data: {
        status: OrganizationMemberStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedById: userIdOf(user) || null,
        suspensionReason: reason,
      },
    });
    await this.auditAction(user, 'STAFF_MEMBER_SUSPENDED', 'ORGANIZATION_MEMBER', memberId, 'Membru echipă suspendat', before, {
      status: updated.status,
      reason,
    });
    return this.getTeamMember(user, memberId);
  }

  async reactivateTeamMember(user: AuthUser, memberId: string, payload: { note?: unknown }) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const before = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId } });
    if (!before) throw new NotFoundException('Team member not found');
    const updated = await this.prisma.organizationMember.update({
      where: { id: before.id },
      data: {
        status: OrganizationMemberStatus.ACTIVE,
        suspendedAt: null,
        suspendedById: null,
        suspensionReason: null,
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
      },
    });
    await this.auditAction(user, 'STAFF_MEMBER_REACTIVATED', 'ORGANIZATION_MEMBER', memberId, 'Membru echipă reactivat', before, {
      status: updated.status,
      note: normalizeText(payload.note) || null,
    });
    return this.getTeamMember(user, memberId);
  }

  async revokeTeamMember(user: AuthUser, memberId: string, payload: { reason?: unknown }) {
    await this.ensureOwnerMembership(user);
    const organizationId = organizationIdOf(user);
    const reason = normalizeText(payload.reason);
    if (!reason) throw new BadRequestException('Revoke reason is required');
    const before = await this.assertOwnerCanBeInactive(organizationId, memberId);
    const updated = await this.prisma.organizationMember.update({
      where: { id: before.id },
      data: {
        status: OrganizationMemberStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: userIdOf(user) || null,
        revokeReason: reason,
      },
    });
    await this.auditAction(user, 'STAFF_MEMBER_REVOKED', 'ORGANIZATION_MEMBER', memberId, 'Acces membru echipă revocat', before, {
      status: updated.status,
      reason,
    });
    return this.getTeamMember(user, memberId);
  }

  async listTeamMemberActivity(user: AuthUser, memberId: string, query: Record<string, unknown>) {
    await this.ensureOwnerMembership(user);
    await this.assertAnyPermission(user, ['audit_log.view', 'team.manage']);
    const organizationId = organizationIdOf(user);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: {
        user: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
        associationRole: true,
      },
    });
    if (!member) throw new NotFoundException('Team member not found');
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit || 20);
    const items = await this.activityItemsForOrganization(user, query, member.userId);
    const total = items.length;
    const stats = this.activityStats(items);
    return {
      member: {
        id: member.id,
        userId: member.userId,
        user: {
          id: member.user.id,
          fullName: this.actorDisplayName(member.user),
          email: member.user.email,
        },
        role: member.associationRole
          ? { id: member.associationRole.id, name: member.associationRole.name, type: member.associationRole.type }
          : { id: null, name: member.role, type: member.role },
        status: member.status,
      },
      summary: {
        totalActivities: total,
        today: stats.today,
        sensitiveActions: stats.sensitive,
        criticalActions: stats.critical,
        loginSuccess: items.filter((item) => item.action === 'LOGIN_SUCCESS').length,
        loginFailed: items.filter((item) => item.action === 'LOGIN_FAILED').length,
        lastActivityAt: stats.lastActivityAt,
      },
      moduleBreakdown: Object.entries(
        items.reduce<Record<string, number>>((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        }, {}),
      ).map(([category, count]) => ({ category, count })),
      items: items.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getTeamMemberActivityStats(user: AuthUser, memberId: string, query: Record<string, unknown> = {}) {
    const payload = await this.listTeamMemberActivity(user, memberId, { ...query, page: 1, limit: 1 });
    return payload.summary;
  }

  private async getRoleWithPermissionsOrThrow(organizationId: string, roleId: string) {
    const role = await this.prisma.associationRole.findFirst({
      where: { id: roleId, organizationId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private serializeStaffInvitation(invitation: any, rawToken?: string) {
    const effectiveStatus = effectiveStaffInvitationStatus(invitation.status, invitation.expiresAt);
    return {
      id: invitation.id,
      invitedEmail: invitation.invitedEmail,
      invitedFullName: invitation.invitedFullName,
      invitedPhone: invitation.invitedPhone,
      status: effectiveStatus,
      storedStatus: invitation.status,
      deliveryMethod: invitation.deliveryMethod,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      cancelledAt: invitation.cancelledAt,
      revokedAt: invitation.revokedAt,
      cancellationReason: invitation.cancellationReason,
      revokeReason: invitation.revokeReason,
      tokenPreview: invitation.tokenPreview,
      lastSentAt: invitation.lastSentAt,
      sendCount: invitation.sendCount,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      inviteLink: rawToken ? this.buildStaffInviteLink(rawToken) : undefined,
      rawToken,
      association: invitation.association
        ? {
            id: invitation.association.id,
            shortName: invitation.association.name,
            associationCode: invitation.association.fiscalCode || invitation.association.invoicePrefix || invitation.association.id.slice(0, 8),
          }
        : undefined,
      role: invitation.role ? this.serializeRoleForPreview(invitation.role) : null,
      createdBy: invitation.createdBy
        ? { id: invitation.createdBy.id, fullName: invitation.createdBy.fullName || invitation.createdBy.email, email: invitation.createdBy.email }
        : null,
      acceptedBy: invitation.acceptedBy
        ? { id: invitation.acceptedBy.id, fullName: invitation.acceptedBy.fullName || invitation.acceptedBy.email, email: invitation.acceptedBy.email }
        : null,
    };
  }

  private staffInvitationInclude() {
    return {
      association: { select: { id: true, name: true, fiscalCode: true, invoicePrefix: true } },
      role: { include: { rolePermissions: { include: { permission: true } } } },
      createdBy: { select: { id: true, email: true, fullName: true } },
      acceptedBy: { select: { id: true, email: true, fullName: true } },
      cancelledBy: { select: { id: true, email: true, fullName: true } },
      revokedBy: { select: { id: true, email: true, fullName: true } },
    } satisfies Prisma.AssociationStaffInvitationInclude;
  }

  async listStaffInvitations(user: AuthUser, query: Record<string, unknown>) {
    await this.ensureOwnerMembership(user);
    const associationId = organizationIdOf(user);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const status = normalizeText(query.status);
    const roleId = normalizeText(query.roleId);
    const deliveryMethod = normalizeText(query.deliveryMethod);
    const search = normalizeText(query.search).toLowerCase();
    const expiredOnly = query.expiredOnly === true || query.expiredOnly === 'true';
    const where: Prisma.AssociationStaffInvitationWhereInput = {
      associationId,
      ...(status ? { status: status as StaffInvitationStatus } : {}),
      ...(roleId ? { roleId } : {}),
      ...(deliveryMethod ? { deliveryMethod: deliveryMethod as StaffInvitationDeliveryMethod } : {}),
      ...(search
        ? {
            OR: [
              { invitedEmail: { contains: search, mode: 'insensitive' } },
              { invitedFullName: { contains: search, mode: 'insensitive' } },
              { invitedPhone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(expiredOnly
        ? {
            OR: [
              { status: StaffInvitationStatus.EXPIRED },
              { status: { in: [StaffInvitationStatus.PENDING, StaffInvitationStatus.SENT] }, expiresAt: { lt: new Date() } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.associationStaffInvitation.findMany({
        where,
        include: this.staffInvitationInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.associationStaffInvitation.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serializeStaffInvitation(item)),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async createStaffInvitation(user: AuthUser, payload: StaffInvitationPayload) {
    await this.ensureOwnerMembership(user);
    const associationId = organizationIdOf(user);
    const actorId = userIdOf(user);
    if (!actorId) throw new BadRequestException('Actor user is required');
    const invitedEmail = normalizeEmail(payload.invitedEmail);
    if (!invitedEmail || !isValidEmail(invitedEmail)) throw new BadRequestException('A valid invitedEmail is required');
    const roleId = normalizeText(payload.roleId);
    if (!roleId) throw new BadRequestException('roleId is required');
    const role = await this.getRoleWithPermissionsOrThrow(associationId, roleId);
    const rolePreview = this.serializeRoleForPreview(role);
    if (rolePreview.criticalPermissions.length && payload.confirmCritical !== true) {
      throw new BadRequestException('Critical role permissions require explicit confirmation');
    }
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId: associationId, user: { email: invitedEmail, deletedAt: null }, status: OrganizationMemberStatus.ACTIVE },
      select: { id: true },
    });
    if (existingMember) throw new BadRequestException('Acest user este deja membru activ în asociație.');
    const activeInvitation = await this.prisma.associationStaffInvitation.findFirst({
      where: {
        associationId,
        invitedEmail,
        status: { in: [StaffInvitationStatus.PENDING, StaffInvitationStatus.SENT] },
        expiresAt: { gt: new Date() },
      },
    });
    if (activeInvitation && payload.confirmReplaceActive !== true) {
      throw new BadRequestException('Există deja o invitație activă pentru acest email.');
    }
    const rawToken = generateSecureToken();
    const expiresInDays = parseExpiresInDays(payload.expiresInDays);
    const deliveryMethod = Object.values(StaffInvitationDeliveryMethod).includes(payload.deliveryMethod as StaffInvitationDeliveryMethod)
      ? (payload.deliveryMethod as StaffInvitationDeliveryMethod)
      : StaffInvitationDeliveryMethod.COPY_LINK;
    const invitation = await this.prisma.$transaction(async (tx) => {
      if (activeInvitation) {
        await tx.associationStaffInvitation.update({
          where: { id: activeInvitation.id },
          data: {
            status: StaffInvitationStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: actorId || null,
            cancellationReason: 'Înlocuită cu o invitație nouă.',
          },
        });
      }
      return tx.associationStaffInvitation.create({
        data: {
          associationId,
          invitedEmail,
          invitedFullName: normalizeText(payload.invitedFullName) || null,
          invitedPhone: normalizeText(payload.invitedPhone) || null,
          roleId,
          tokenHash: tokenHash(rawToken),
          tokenPreview: rawToken.slice(-6),
          expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
          createdById: actorId,
          deliveryMethod,
          metadata: normalizeText(payload.message) ? { message: normalizeText(payload.message) } : undefined,
        },
        include: this.staffInvitationInclude(),
      });
    });
    await this.auditAction(user, 'STAFF_INVITATION_CREATED', 'ASSOCIATION_STAFF_INVITATION', invitation.id, 'Invitație staff creată', null, {
      invitedEmail,
      roleId,
      deliveryMethod,
      expiresAt: invitation.expiresAt,
    });
    await this.sendStaffInvitationNotification(invitation, rawToken, actorId).catch(() => undefined);
    return this.serializeStaffInvitation(invitation, rawToken);
  }

  async getStaffInvitation(user: AuthUser, invitationId: string) {
    await this.ensureOwnerMembership(user);
    const invitation = await this.prisma.associationStaffInvitation.findFirst({
      where: { id: invitationId, associationId: organizationIdOf(user) },
      include: this.staffInvitationInclude(),
    });
    if (!invitation) throw new NotFoundException('Staff invitation not found');
    return this.serializeStaffInvitation(invitation);
  }

  async regenerateStaffInvitation(user: AuthUser, invitationId: string) {
    await this.ensureOwnerMembership(user);
    const associationId = organizationIdOf(user);
    const existing = await this.prisma.associationStaffInvitation.findFirst({ where: { id: invitationId, associationId } });
    if (!existing) throw new NotFoundException('Staff invitation not found');
    if (
      new Set<StaffInvitationStatus>([
        StaffInvitationStatus.ACCEPTED,
        StaffInvitationStatus.CANCELLED,
        StaffInvitationStatus.REVOKED,
      ]).has(existing.status)
    ) {
      throw new BadRequestException('Invitation cannot be regenerated in its current status');
    }
    const rawToken = generateSecureToken();
    const updated = await this.prisma.associationStaffInvitation.update({
      where: { id: existing.id },
      data: {
        tokenHash: tokenHash(rawToken),
        tokenPreview: rawToken.slice(-6),
        status: StaffInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: this.staffInvitationInclude(),
    });
    await this.auditAction(user, 'STAFF_INVITATION_REGENERATED', 'ASSOCIATION_STAFF_INVITATION', updated.id, 'Invitație staff regenerată', { status: existing.status }, { expiresAt: updated.expiresAt });
    await this.sendStaffInvitationNotification(updated, rawToken, userIdOf(user)).catch(() => undefined);
    return this.serializeStaffInvitation(updated, rawToken);
  }

  private async sendStaffInvitationNotification(invitation: any, rawToken: string, actorUserId?: string | null) {
    if (invitation.deliveryMethod !== StaffInvitationDeliveryMethod.EMAIL_PLACEHOLDER) return;
    await this.transactionalNotifications.sendTransactionalNotification({
      type: TransactionalNotificationType.STAFF_INVITATION,
      channels: [NotificationChannel.EMAIL],
      associationId: invitation.associationId,
      recipientEmail: invitation.invitedEmail,
      locale: 'ro',
      variables: {
        staffName: invitation.invitedFullName || invitation.invitedEmail,
        associationName: invitation.association?.name || 'asociație',
        associationCode: invitation.association?.fiscalCode || '',
        inviteLink: this.buildStaffInviteLink(rawToken),
        supportEmail: process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL || 'support@espace.md',
      },
      relatedEntityType: 'ASSOCIATION_STAFF_INVITATION',
      relatedEntityId: invitation.id,
      createdById: actorUserId || null,
    });
  }

  async markStaffInvitationSent(user: AuthUser, invitationId: string) {
    await this.ensureOwnerMembership(user);
    const invitation = await this.prisma.associationStaffInvitation.findFirst({ where: { id: invitationId, associationId: organizationIdOf(user) } });
    if (!invitation) throw new NotFoundException('Staff invitation not found');
    if (!new Set<StaffInvitationStatus>([StaffInvitationStatus.PENDING, StaffInvitationStatus.SENT]).has(invitation.status)) {
      throw new BadRequestException('Invitation cannot be marked as sent');
    }
    const updated = await this.prisma.associationStaffInvitation.update({
      where: { id: invitation.id },
      data: { status: StaffInvitationStatus.SENT, lastSentAt: new Date(), sendCount: { increment: 1 } },
      include: this.staffInvitationInclude(),
    });
    await this.auditAction(user, 'STAFF_INVITATION_MARKED_SENT', 'ASSOCIATION_STAFF_INVITATION', updated.id, 'Invitație staff marcată ca trimisă', { sendCount: invitation.sendCount }, { sendCount: updated.sendCount });
    return this.serializeStaffInvitation(updated);
  }

  async cancelStaffInvitation(user: AuthUser, invitationId: string, payload: { reason?: unknown }) {
    await this.ensureOwnerMembership(user);
    const reason = normalizeText(payload.reason) || 'Anulată de administrator.';
    const invitation = await this.prisma.associationStaffInvitation.findFirst({ where: { id: invitationId, associationId: organizationIdOf(user) } });
    if (!invitation) throw new NotFoundException('Staff invitation not found');
    if (invitation.status === StaffInvitationStatus.ACCEPTED) throw new BadRequestException('Accepted invitations cannot be cancelled');
    const updated = await this.prisma.associationStaffInvitation.update({
      where: { id: invitation.id },
      data: { status: StaffInvitationStatus.CANCELLED, cancelledAt: new Date(), cancelledById: userIdOf(user) || null, cancellationReason: reason },
      include: this.staffInvitationInclude(),
    });
    await this.auditAction(user, 'STAFF_INVITATION_CANCELLED', 'ASSOCIATION_STAFF_INVITATION', updated.id, 'Invitație staff anulată', invitation, { reason });
    return this.serializeStaffInvitation(updated);
  }

  async revokeStaffInvitation(user: AuthUser, invitationId: string, payload: { reason?: unknown }) {
    await this.ensureOwnerMembership(user);
    const reason = normalizeText(payload.reason) || 'Revocată de administrator.';
    const invitation = await this.prisma.associationStaffInvitation.findFirst({ where: { id: invitationId, associationId: organizationIdOf(user) } });
    if (!invitation) throw new NotFoundException('Staff invitation not found');
    if (invitation.status === StaffInvitationStatus.ACCEPTED) throw new BadRequestException('Accepted invitations cannot be revoked');
    const updated = await this.prisma.associationStaffInvitation.update({
      where: { id: invitation.id },
      data: { status: StaffInvitationStatus.REVOKED, revokedAt: new Date(), revokedById: userIdOf(user) || null, revokeReason: reason },
      include: this.staffInvitationInclude(),
    });
    await this.auditAction(user, 'STAFF_INVITATION_REVOKED', 'ASSOCIATION_STAFF_INVITATION', updated.id, 'Invitație staff revocată', invitation, { reason });
    return this.serializeStaffInvitation(updated);
  }

  async staffInvitationPermissionsPreview(user: AuthUser, invitationId: string) {
    const invitation = await this.getStaffInvitation(user, invitationId);
    return { role: invitation.role, permissionsPreview: invitation.role?.permissionsPreview || [], criticalPermissions: invitation.role?.criticalPermissions || [] };
  }

  async validatePublicStaffInvitation(rawToken: string) {
    const invitation = await this.prisma.associationStaffInvitation.findFirst({
      where: { tokenHash: tokenHash(rawToken) },
      include: this.staffInvitationInclude(),
    });
    if (!invitation) return { valid: false, reason: 'INVALID' };
    const status = effectiveStaffInvitationStatus(invitation.status, invitation.expiresAt);
    const valid = status === StaffInvitationStatus.PENDING || status === StaffInvitationStatus.SENT;
    return {
      valid,
      reason: valid ? null : status,
      invitation: {
        id: invitation.id,
        status,
        expiresAt: invitation.expiresAt,
      },
      association: {
        id: invitation.association.id,
        shortName: invitation.association.name,
        associationCode: invitation.association.fiscalCode || invitation.association.invoicePrefix || invitation.association.id.slice(0, 8),
      },
      role: this.serializeRoleForPreview(invitation.role),
      invitedEmail: invitation.invitedEmail,
      invitedFullName: invitation.invitedFullName,
      permissionsPreview: this.serializeRoleForPreview(invitation.role).permissionsPreview,
    };
  }

  private async applyAcceptedStaffInvitation(invitationId: string, userId: string, tx: Prisma.TransactionClient) {
    const invitation = await tx.associationStaffInvitation.findUnique({
      where: { id: invitationId },
      include: { role: true },
    });
    if (!invitation) throw new NotFoundException('Staff invitation not found');
    const legacyRole = legacyRoleForAssociationRole(invitation.role.type);
    const existingMembership = await tx.organizationMember.findFirst({ where: { userId } });
    if (existingMembership && existingMembership.organizationId !== invitation.associationId) {
      throw new BadRequestException('Userul este deja asociat cu altă organizație.');
    }
    if (existingMembership) {
      return tx.organizationMember.update({
        where: { id: existingMembership.id },
        data: {
          organizationId: invitation.associationId,
          role: legacyRole,
          associationRoleId: invitation.roleId,
          status: OrganizationMemberStatus.ACTIVE,
          invitedAt: invitation.createdAt,
          activatedAt: new Date(),
          createdById: invitation.createdById,
          revokedAt: null,
          revokedById: null,
          revokeReason: null,
          suspendedAt: null,
          suspendedById: null,
          suspensionReason: null,
        },
      });
    }
    return tx.organizationMember.create({
      data: {
        organizationId: invitation.associationId,
        userId,
        role: legacyRole,
        associationRoleId: invitation.roleId,
        status: OrganizationMemberStatus.ACTIVE,
        invitedAt: invitation.createdAt,
        activatedAt: new Date(),
        createdById: invitation.createdById,
      },
    });
  }

  async acceptStaffInvitation(rawToken: string, payload: Record<string, unknown>, authenticatedUser?: AuthUser) {
    const validation = await this.validatePublicStaffInvitation(rawToken);
    if (!validation.valid) throw new BadRequestException('Invitația nu este validă sau a expirat.');
    const email = normalizeEmail(payload.email || validation.invitedEmail);
    if (email !== normalizeEmail(validation.invitedEmail)) {
      throw new BadRequestException('Emailul trebuie să coincidă cu invitația.');
    }
    const fullName = normalizeText(payload.fullName || validation.invitedFullName || email);
    const password = normalizeText(payload.password);
    const confirmPassword = normalizeText(payload.confirmPassword);
    const invitation = await this.prisma.associationStaffInvitation.findFirst({
      where: { tokenHash: tokenHash(rawToken) },
      include: this.staffInvitationInclude(),
    });
    if (!invitation) throw new NotFoundException('Staff invitation not found');

    let targetUserId = authenticatedUser ? userIdOf(authenticatedUser) : '';
    if (targetUserId) {
      const current = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
      if (!current || normalizeEmail(current.email) !== email) {
        throw new BadRequestException('Contul autentificat nu coincide cu emailul invitației.');
      }
    } else {
      if (!password || password.length < 8) throw new BadRequestException('Parola trebuie să aibă minimum 8 caractere.');
      if (password !== confirmPassword) throw new BadRequestException('Confirmarea parolei nu coincide.');
      const existingUser = await this.prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
      if (existingUser) {
        throw new BadRequestException('Există deja un cont cu acest email. Autentifică-te pentru a accepta invitația.');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (!targetUserId) {
        const [firstName, ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
        const created = await tx.user.create({
          data: {
            email,
            fullName,
            firstName: firstName || fullName,
            lastName: lastNameParts.join(' ') || null,
            phone: normalizeText(payload.phone || invitation.invitedPhone) || null,
            passwordHash: await bcrypt.hash(password, 12),
            authProvider: AuthProvider.LOCAL,
            emailVerifiedAt: new Date(),
            role: Role.ADMIN,
            platformRole: PlatformRole.ORGANIZATION_USER,
            organizationId: invitation.associationId,
          },
          select: { id: true, email: true, fullName: true },
        });
        targetUserId = created.id;
      }
      const member = await this.applyAcceptedStaffInvitation(invitation.id, targetUserId, tx);
      const updatedInvitation = await tx.associationStaffInvitation.update({
        where: { id: invitation.id },
        data: { status: StaffInvitationStatus.ACCEPTED, acceptedAt: new Date(), acceptedByUserId: targetUserId },
        include: this.staffInvitationInclude(),
      });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.associationId,
          userId: targetUserId,
          action: 'STAFF_INVITATION_ACCEPTED',
          entityType: 'ASSOCIATION_STAFF_INVITATION',
          entityId: invitation.id,
          description: 'Invitație staff acceptată',
          newValuesJson: { memberId: member.id, roleId: invitation.roleId },
        },
      });
      return { member, invitation: updatedInvitation };
    });
    return {
      success: true,
      invitation: this.serializeStaffInvitation(result.invitation),
      user: { id: targetUserId, email, fullName },
      redirectTarget: '/ro/admin',
    };
  }

  async linkExistingStaffInvitation(rawToken: string, user: AuthUser) {
    return this.acceptStaffInvitation(rawToken, { email: undefined }, user);
  }
}
