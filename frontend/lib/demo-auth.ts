export type DemoRole = 'SUPERADMIN' | 'ADMIN' | 'RESIDENT';

export const DEMO_ROLE_STORAGE_KEY = 'espace_demo_role';
const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:';
const cookieSecurity = isProd ? '; secure' : '';

function setDemoRoleCookie(role: DemoRole) {
  if (typeof window === 'undefined') return;
  window.document.cookie = `${DEMO_ROLE_STORAGE_KEY}=${role}; path=/; max-age=604800; samesite=lax${cookieSecurity}`;
}

function clearDemoRoleCookie() {
  if (typeof window === 'undefined') return;
  window.document.cookie = `${DEMO_ROLE_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
}

export function setDemoRole(role: DemoRole) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
  setDemoRoleCookie(role);
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
  clearDemoRoleCookie();
}

export function demoRolePath(role: DemoRole, locale = 'ro') {
  if (role === 'SUPERADMIN') return `/${locale}/superadmin`;
  if (role === 'RESIDENT') return `/${locale}/resident`;
  return `/${locale}/admin`;
}

export function demoOnboardingPath(locale = 'ro') {
  return `/${locale}/login`;
}

export function demoLogout(locale = 'ro') {
  clearDemoRole();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('espace_access_token');
    window.localStorage.removeItem('espace_user');
    window.localStorage.removeItem('espace_role');
    window.localStorage.removeItem('accessToken');
    window.localStorage.removeItem('user');
    window.document.cookie = `accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
    window.document.cookie = `role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
    window.location.assign(`/${locale}/login`);
  }
}
