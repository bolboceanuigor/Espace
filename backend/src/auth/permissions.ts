import { Role } from '@prisma/client';

export enum Permission {
  APARTMENT_CREATE = 'APARTMENT_CREATE',
  APARTMENT_UPDATE = 'APARTMENT_UPDATE',
  APARTMENT_DELETE = 'APARTMENT_DELETE',
  RESIDENT_CREATE = 'RESIDENT_CREATE',
  RESIDENT_UPDATE = 'RESIDENT_UPDATE',
  ISSUE_MANAGE = 'ISSUE_MANAGE',
  INVOICE_MANAGE = 'INVOICE_MANAGE',
}

const ALL_PERMISSIONS: Permission[] = [
  Permission.APARTMENT_CREATE,
  Permission.APARTMENT_UPDATE,
  Permission.APARTMENT_DELETE,
  Permission.RESIDENT_CREATE,
  Permission.RESIDENT_UPDATE,
  Permission.ISSUE_MANAGE,
  Permission.INVOICE_MANAGE,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPERADMIN]: [...ALL_PERMISSIONS],
  [Role.ADMIN]: [...ALL_PERMISSIONS],
  [Role.RESIDENT]: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}
