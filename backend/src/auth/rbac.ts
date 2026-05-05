import { Role } from '@prisma/client';

type RoleCarrier = { role?: Role | string | null } | null | undefined;

export function isSuperAdmin(user: RoleCarrier): boolean {
  const role = (user?.role || '').toString().toUpperCase();
  return role === Role.SUPERADMIN || role === 'SUPER_ADMIN';
}

export function isAdmin(user: RoleCarrier): boolean {
  const role = (user?.role || '').toString().toUpperCase();
  return role === Role.ADMIN || role === Role.SUPERADMIN || role === 'SUPER_ADMIN';
}

export function isManager(user: RoleCarrier): boolean {
  return (user?.role || '').toString().toUpperCase() === Role.ADMIN;
}

export function isResident(user: RoleCarrier): boolean {
  const role = (user?.role || '').toString().toUpperCase();
  return role === Role.RESIDENT || role === 'RESIDENT';
}

