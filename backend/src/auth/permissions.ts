import { Role } from '@prisma/client';

export enum Permission {
  PROPERTY_CREATE = 'PROPERTY_CREATE',
  PROPERTY_UPDATE = 'PROPERTY_UPDATE',
  PROPERTY_DELETE = 'PROPERTY_DELETE',
  RESERVATION_CREATE = 'RESERVATION_CREATE',
  RESERVATION_UPDATE = 'RESERVATION_UPDATE',
  RESERVATION_DELETE = 'RESERVATION_DELETE',
  CLIENT_CREATE = 'CLIENT_CREATE',
  CLIENT_UPDATE = 'CLIENT_UPDATE',
  CLIENT_DELETE = 'CLIENT_DELETE',
  SUBSCRIPTION_MANAGE = 'SUBSCRIPTION_MANAGE',
}

const ALL_PERMISSIONS: Permission[] = [
  Permission.PROPERTY_CREATE,
  Permission.PROPERTY_UPDATE,
  Permission.PROPERTY_DELETE,
  Permission.RESERVATION_CREATE,
  Permission.RESERVATION_UPDATE,
  Permission.RESERVATION_DELETE,
  Permission.CLIENT_CREATE,
  Permission.CLIENT_UPDATE,
  Permission.CLIENT_DELETE,
  Permission.SUBSCRIPTION_MANAGE,
];

const MANAGER_PERMISSIONS: Permission[] = [
  Permission.PROPERTY_CREATE,
  Permission.PROPERTY_UPDATE,
  Permission.RESERVATION_CREATE,
  Permission.RESERVATION_UPDATE,
  Permission.CLIENT_CREATE,
  Permission.CLIENT_UPDATE,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPERADMIN]: [...ALL_PERMISSIONS],
  [Role.SUPER_ADMIN]: [...ALL_PERMISSIONS],
  [Role.ADMIN]: [...ALL_PERMISSIONS],
  [Role.MANAGER]: [...MANAGER_PERMISSIONS],
  [Role.TENANT]: [],
  [Role.RESIDENT]: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}
