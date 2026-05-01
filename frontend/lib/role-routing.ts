export function normalizeRole(role: string | null | undefined): string {
  const value = String(role || '').toUpperCase();
  if (value === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (value === 'TENANT') return 'RESIDENT';
  if (value === 'LOCATAR') return 'RESIDENT';
  if (value === 'MANAGER') return 'ADMIN';
  return value;
}

export function roleHomePath(role: string | null | undefined): '/superadmin' | '/admin' | '/resident' {
  const normalized = normalizeRole(role);
  if (normalized === 'SUPER_ADMIN') return '/superadmin';
  if (normalized === 'RESIDENT') return '/resident';
  return '/admin';
}
