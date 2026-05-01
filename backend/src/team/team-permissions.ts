import { OrganizationMemberRole } from '@prisma/client';

export const TEAM_PERMISSION_KEYS = [
  'buildings.view',
  'buildings.manage',
  'apartments.view',
  'apartments.manage',
  'residents.view',
  'residents.manage',
  'payments.view',
  'payments.manage',
  'invoices.view',
  'invoices.manage',
  'reports.view',
  'announcements.view',
  'announcements.manage',
  'issues.view',
  'issues.manage',
  'chat.view',
  'chat.manage',
  'suppliers.view',
  'suppliers.manage',
  'maintenance.view',
  'maintenance.manage',
  'expenses.view',
  'expenses.manage',
  'settings.view',
  'settings.manage',
  'audit.view',
  'team.view',
  'team.manage',
] as const;

export type TeamPermissionKey = (typeof TEAM_PERMISSION_KEYS)[number];

const allPermissions = new Set<TeamPermissionKey>(TEAM_PERMISSION_KEYS);

function pickPermissions(keys: TeamPermissionKey[]): Record<TeamPermissionKey, boolean> {
  return TEAM_PERMISSION_KEYS.reduce(
    (acc, key) => {
      acc[key] = keys.includes(key);
      return acc;
    },
    {} as Record<TeamPermissionKey, boolean>,
  );
}

export const DEFAULT_ROLE_PERMISSIONS: Record<OrganizationMemberRole, Record<TeamPermissionKey, boolean>> = {
  ORG_ADMIN: pickPermissions([...allPermissions]),
  ACCOUNTANT: pickPermissions([
    'suppliers.view',
    'suppliers.manage',
    'payments.view',
    'payments.manage',
    'invoices.view',
    'invoices.manage',
    'reports.view',
    'expenses.view',
    'expenses.manage',
  ]),
  MANAGER: pickPermissions([
    'buildings.view',
    'buildings.manage',
    'apartments.view',
    'apartments.manage',
    'residents.view',
    'residents.manage',
    'announcements.view',
    'announcements.manage',
    'issues.view',
    'issues.manage',
    'chat.view',
    'chat.manage',
    'suppliers.view',
    'suppliers.manage',
    'maintenance.view',
    'maintenance.manage',
  ]),
  TECHNICIAN: pickPermissions(['issues.view', 'issues.manage', 'chat.view', 'maintenance.view', 'maintenance.manage']),
  OPERATOR: pickPermissions([
    'buildings.view',
    'apartments.view',
    'residents.view',
    'announcements.view',
    'issues.view',
    'chat.view',
    'suppliers.view',
    'maintenance.view',
    'expenses.view',
  ]),
};

export function normalizePermissionOverrides(input: unknown): Partial<Record<TeamPermissionKey, boolean>> {
  if (!input || typeof input !== 'object') return {};
  const source = input as Record<string, unknown>;
  const result: Partial<Record<TeamPermissionKey, boolean>> = {};
  for (const key of TEAM_PERMISSION_KEYS) {
    if (typeof source[key] === 'boolean') {
      result[key] = source[key] as boolean;
    }
  }
  return result;
}

export function resolvePermissions(
  role: OrganizationMemberRole,
  overrides?: unknown,
): Record<TeamPermissionKey, boolean> {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] ?? DEFAULT_ROLE_PERMISSIONS.OPERATOR;
  return { ...defaults, ...normalizePermissionOverrides(overrides) };
}

