export type DemoRole = 'SUPERADMIN' | 'ADMIN' | 'RESIDENT';

export const DEMO_ROLE_STORAGE_KEY = 'espace_demo_role';

export function setDemoRole(role: DemoRole) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
}

export function getDemoRole(): DemoRole | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY);
  if (value === 'SUPERADMIN' || value === 'ADMIN' || value === 'RESIDENT') return value;
  return null;
}

export function clearDemoRole() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
}

export function demoRolePath(role: DemoRole, locale = 'ro') {
  if (role === 'SUPERADMIN') return `/${locale}/superadmin`;
  if (role === 'RESIDENT') return `/${locale}/resident`;
  return `/${locale}/admin`;
}

export function demoOnboardingPath(locale = 'ro') {
  return `/${locale}/onboarding`;
}

export function demoLogout(locale = 'ro') {
  clearDemoRole();
  if (typeof window !== 'undefined') {
    window.location.assign(`/${locale}/login`);
  }
}
