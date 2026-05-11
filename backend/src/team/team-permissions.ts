import { OrganizationMemberRole } from '@prisma/client';

export const PERMISSION_MODULES = [
  'DASHBOARD',
  'APARTMENTS',
  'RESIDENTS',
  'TARIFFS',
  'METERS',
  'METER_READINGS',
  'BILLING',
  'INVOICES',
  'PAYMENTS',
  'RECONCILIATION',
  'REPORTS',
  'ANNOUNCEMENTS',
  'REQUESTS',
  'IMPORTS',
  'EXPORTS',
  'DATA_QUALITY',
  'TEAM',
  'SETTINGS',
  'AUDIT_LOG',
  'NOTIFICATIONS',
] as const;

export const PERMISSION_ACTIONS = [
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'CANCEL',
  'EXPORT',
  'IMPORT',
  'MANAGE',
  'FINALIZE',
  'LOCK',
  'ASSIGN',
  'INVITE',
] as const;

export type PermissionModuleKey = (typeof PERMISSION_MODULES)[number];
export type PermissionActionKey = (typeof PERMISSION_ACTIONS)[number];
export type AssociationRoleTypeKey =
  | 'ASSOCIATION_OWNER'
  | 'ASSOCIATION_ADMIN'
  | 'FINANCE_OPERATOR'
  | 'METER_OPERATOR'
  | 'SUPPORT_OPERATOR'
  | 'READ_ONLY'
  | 'CUSTOM';

export type MatrixPermissionKey = `${Lowercase<PermissionModuleKey>}.${Lowercase<PermissionActionKey>}`;

export type PermissionDefinition = {
  module: PermissionModuleKey;
  action: PermissionActionKey;
  key: MatrixPermissionKey;
  label: string;
  description: string;
  isCritical: boolean;
};

const moduleLabels: Record<PermissionModuleKey, string> = {
  DASHBOARD: 'Dashboard',
  APARTMENTS: 'Apartamente',
  RESIDENTS: 'Locatari',
  TARIFFS: 'Tarife',
  METERS: 'Contoare',
  METER_READINGS: 'Indici contoare',
  BILLING: 'Facturare',
  INVOICES: 'Facturi',
  PAYMENTS: 'Plati',
  RECONCILIATION: 'Reconciliere',
  REPORTS: 'Rapoarte',
  ANNOUNCEMENTS: 'Anunturi',
  REQUESTS: 'Solicitari',
  IMPORTS: 'Importuri',
  EXPORTS: 'Exporturi',
  DATA_QUALITY: 'Calitatea datelor',
  TEAM: 'Echipa',
  SETTINGS: 'Setari',
  AUDIT_LOG: 'Audit log',
  NOTIFICATIONS: 'Notificari',
};

const actionLabels: Record<PermissionActionKey, string> = {
  VIEW: 'View',
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  APPROVE: 'Approve',
  CANCEL: 'Cancel',
  EXPORT: 'Export',
  IMPORT: 'Import',
  MANAGE: 'Manage',
  FINALIZE: 'Finalize',
  LOCK: 'Lock',
  ASSIGN: 'Assign',
  INVITE: 'Invite',
};

const moduleActions: Record<PermissionModuleKey, PermissionActionKey[]> = {
  DASHBOARD: ['VIEW'],
  APARTMENTS: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'],
  RESIDENTS: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'],
  TARIFFS: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'],
  METERS: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'],
  METER_READINGS: ['VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'IMPORT', 'MANAGE'],
  BILLING: ['VIEW', 'MANAGE', 'LOCK', 'FINALIZE'],
  INVOICES: ['VIEW', 'CREATE', 'UPDATE', 'CANCEL', 'EXPORT', 'FINALIZE', 'MANAGE'],
  PAYMENTS: ['VIEW', 'CREATE', 'CANCEL', 'EXPORT', 'MANAGE'],
  RECONCILIATION: ['VIEW', 'MANAGE'],
  REPORTS: ['VIEW', 'EXPORT'],
  ANNOUNCEMENTS: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'],
  REQUESTS: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'MANAGE'],
  IMPORTS: ['VIEW', 'IMPORT', 'MANAGE'],
  EXPORTS: ['VIEW', 'EXPORT'],
  DATA_QUALITY: ['VIEW', 'MANAGE'],
  TEAM: ['VIEW', 'MANAGE', 'ASSIGN', 'INVITE'],
  SETTINGS: ['VIEW', 'MANAGE'],
  AUDIT_LOG: ['VIEW'],
  NOTIFICATIONS: ['VIEW', 'MANAGE'],
};

export const CRITICAL_PERMISSION_KEYS = new Set<string>([
  'settings.manage',
  'team.manage',
  'team.invite',
  'billing.finalize',
  'billing.lock',
  'invoices.finalize',
  'payments.cancel',
  'data_quality.manage',
  'imports.import',
  'audit_log.view',
]);

export function permissionKey(module: PermissionModuleKey, action: PermissionActionKey): MatrixPermissionKey {
  return `${module.toLowerCase()}.${action.toLowerCase()}` as MatrixPermissionKey;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = PERMISSION_MODULES.flatMap((module) =>
  moduleActions[module].map((action) => {
    const key = permissionKey(module, action);
    return {
      module,
      action,
      key,
      label: `${moduleLabels[module]} - ${actionLabels[action]}`,
      description: `${actionLabels[action]} pentru modulul ${moduleLabels[module]}.`,
      isCritical: CRITICAL_PERMISSION_KEYS.has(key),
    };
  }),
);

const matrixKeys = PERMISSION_DEFINITIONS.map((permission) => permission.key);

const legacyPermissionKeys = [
  'buildings.view',
  'buildings.manage',
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
  'audit.view',
] as const;

export const TEAM_PERMISSION_KEYS = [...matrixKeys, ...legacyPermissionKeys] as const;
export type TeamPermissionKey = (typeof TEAM_PERMISSION_KEYS)[number];

const allPermissionKeys = TEAM_PERMISSION_KEYS as readonly TeamPermissionKey[];

function pickPermissions(keys: readonly TeamPermissionKey[]): Record<TeamPermissionKey, boolean> {
  const selected = new Set<TeamPermissionKey>(keys);
  return allPermissionKeys.reduce(
    (acc, key) => {
      acc[key] = selected.has(key);
      return acc;
    },
    {} as Record<TeamPermissionKey, boolean>,
  );
}

function withAliases(keys: readonly TeamPermissionKey[]): TeamPermissionKey[] {
  const selected = new Set<TeamPermissionKey>(keys);
  if (selected.has('requests.view')) selected.add('issues.view');
  if (selected.has('requests.manage')) selected.add('issues.manage');
  if (selected.has('audit_log.view')) selected.add('audit.view');
  if (selected.has('apartments.view')) selected.add('buildings.view');
  if (selected.has('apartments.manage')) selected.add('buildings.manage');
  if (selected.has('settings.view')) selected.add('suppliers.view');
  if (selected.has('settings.manage')) selected.add('suppliers.manage');
  return Array.from(selected);
}

const ALL_MATRIX_KEYS = PERMISSION_DEFINITIONS.map((permission) => permission.key) as TeamPermissionKey[];
const VIEW_ONLY_KEYS = PERMISSION_DEFINITIONS.filter((permission) => permission.action === 'VIEW').map(
  (permission) => permission.key,
) as TeamPermissionKey[];

export const ASSOCIATION_ROLE_PRESETS: Record<
  Exclude<AssociationRoleTypeKey, 'CUSTOM'>,
  {
    name: string;
    description: string;
    isDefault: boolean;
    permissions: TeamPermissionKey[];
  }
> = {
  ASSOCIATION_OWNER: {
    name: 'Administrator principal',
    description: 'Acces complet la asociatie, echipa, permisiuni, setari si finalizarea facturilor.',
    isDefault: true,
    permissions: withAliases(ALL_MATRIX_KEYS),
  },
  ASSOCIATION_ADMIN: {
    name: 'Administrator',
    description: 'Acces aproape complet pentru operatiunile zilnice ale asociatiei.',
    isDefault: false,
    permissions: withAliases(
      ALL_MATRIX_KEYS.filter((key) => key !== 'team.assign' && key !== 'settings.manage') as TeamPermissionKey[],
    ),
  },
  FINANCE_OPERATOR: {
    name: 'Operator financiar',
    description: 'Facturi, plati, reconciliere, rapoarte financiare si exporturi financiare.',
    isDefault: false,
    permissions: withAliases([
      'dashboard.view',
      'apartments.view',
      'residents.view',
      'billing.view',
      'invoices.view',
      'invoices.export',
      'payments.view',
      'payments.create',
      'payments.cancel',
      'payments.export',
      'reconciliation.view',
      'reconciliation.manage',
      'reports.view',
      'reports.export',
      'exports.view',
      'exports.export',
      'audit_log.view',
    ]),
  },
  METER_OPERATOR: {
    name: 'Operator contoare',
    description: 'Contoare, indici, import indici si rapoarte de consum.',
    isDefault: false,
    permissions: withAliases([
      'dashboard.view',
      'apartments.view',
      'residents.view',
      'meters.view',
      'meters.create',
      'meters.update',
      'meters.manage',
      'meter_readings.view',
      'meter_readings.create',
      'meter_readings.update',
      'meter_readings.approve',
      'meter_readings.import',
      'meter_readings.manage',
      'reports.view',
      'imports.view',
      'imports.import',
      'exports.view',
      'exports.export',
    ]),
  },
  SUPPORT_OPERATOR: {
    name: 'Suport locatari',
    description: 'Locatari si apartamente read-only, solicitari si anunturi pentru suport.',
    isDefault: false,
    permissions: withAliases([
      'dashboard.view',
      'apartments.view',
      'residents.view',
      'requests.view',
      'requests.create',
      'requests.update',
      'requests.manage',
      'announcements.view',
      'notifications.view',
    ]),
  },
  READ_ONLY: {
    name: 'Vizualizare',
    description: 'Read-only pe modulele principale, fara actiuni financiare sau administrative.',
    isDefault: false,
    permissions: withAliases(VIEW_ONLY_KEYS),
  },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<OrganizationMemberRole, Record<TeamPermissionKey, boolean>> = {
  ORG_ADMIN: pickPermissions(withAliases(ALL_MATRIX_KEYS)),
  ACCOUNTANT: pickPermissions(ASSOCIATION_ROLE_PRESETS.FINANCE_OPERATOR.permissions),
  MANAGER: pickPermissions(
    withAliases([
      'dashboard.view',
      'apartments.view',
      'apartments.create',
      'apartments.update',
      'apartments.manage',
      'residents.view',
      'residents.create',
      'residents.update',
      'residents.manage',
      'announcements.view',
      'announcements.create',
      'announcements.update',
      'announcements.manage',
      'requests.view',
      'requests.create',
      'requests.update',
      'requests.manage',
      'meters.view',
      'meter_readings.view',
      'reports.view',
    ]),
  ),
  TECHNICIAN: pickPermissions(
    withAliases([
      'dashboard.view',
      'requests.view',
      'requests.update',
      'requests.manage',
      'meters.view',
      'meter_readings.view',
      'maintenance.view',
      'maintenance.manage',
    ]),
  ),
  OPERATOR: pickPermissions(
    withAliases([
      'dashboard.view',
      'apartments.view',
      'residents.view',
      'announcements.view',
      'requests.view',
      'meters.view',
      'meter_readings.view',
      'reports.view',
    ]),
  ),
};

export function normalizePermissionOverrides(input: unknown): Partial<Record<TeamPermissionKey, boolean>> {
  if (!input || typeof input !== 'object') return {};
  const source = input as Record<string, unknown>;
  const result: Partial<Record<TeamPermissionKey, boolean>> = {};
  for (const key of allPermissionKeys) {
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

export function permissionsToMap(keys: readonly TeamPermissionKey[]): Record<TeamPermissionKey, boolean> {
  return pickPermissions(withAliases(keys));
}
