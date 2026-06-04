const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'user';
const ROLE_COOKIE = 'role';
const DEMO_ROLE_COOKIE = 'espace_demo_role';
export const ESPACE_ACCESS_TOKEN_KEY = 'espace_access_token';
export const ESPACE_USER_KEY = 'espace_user';
export const ESPACE_ROLE_KEY = 'espace_role';
const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:';
const cookieSecurity = isProd ? '; secure' : '';
const DEMO_PREVIEW_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true' ||
  process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true' ||
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export type EspaceRole = 'SUPERADMIN' | 'ADMIN' | 'RESIDENT';

export type StoredAuth = {
  token: string | null;
  user: any | null;
  role: EspaceRole | null;
  isDemo: boolean;
};

export function normalizeEspaceRole(role: string | null | undefined): EspaceRole | null {
  const value = String(role || '').toUpperCase();
  if (value === 'SUPERADMIN' || value === 'SUPER_ADMIN') return 'SUPERADMIN';
  if (value === 'ADMIN' || value === 'MANAGER') return 'ADMIN';
  if (value === 'RESIDENT' || value === 'TENANT' || value === 'LOCATAR') return 'RESIDENT';
  return null;
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; samesite=lax${cookieSecurity}`;
}

function clearCookie(name: string) {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
}

export function hasAccessTokenCookie() {
  if (typeof window === 'undefined') return false;
  return document.cookie.split(';').some((chunk) => chunk.trim().startsWith(`${ACCESS_TOKEN_KEY}=`));
}

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ESPACE_ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getStoredToken = getToken;

export const setToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ESPACE_ACCESS_TOKEN_KEY, token);
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  setCookie(ACCESS_TOKEN_KEY, token);
};

export const removeToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  clearCookie(ACCESS_TOKEN_KEY);
};

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(ESPACE_USER_KEY) || localStorage.getItem(USER_KEY);
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const getStoredUser = getUser;

export const setUser = (user: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ESPACE_USER_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const role = normalizeEspaceRole(user?.role);
  if (role) {
    localStorage.setItem(ESPACE_ROLE_KEY, role);
    setCookie(ROLE_COOKIE, role);
  }
};

export const removeUser = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_USER_KEY);
  localStorage.removeItem(ESPACE_ROLE_KEY);
  localStorage.removeItem(USER_KEY);
  clearCookie(ROLE_COOKIE);
};

export const clearAuthCookies = () => {
  if (typeof window === 'undefined') return;
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie(ROLE_COOKIE);
  clearCookie(DEMO_ROLE_COOKIE);
};

export const saveRealSession = (accessToken: string, user: any) => {
  if (typeof window === 'undefined') return;
  const role = normalizeEspaceRole(user?.role);
  localStorage.setItem(ESPACE_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(ESPACE_USER_KEY, JSON.stringify(user));
  localStorage.removeItem('espace_demo_role');
  if (role) {
    localStorage.setItem(ESPACE_ROLE_KEY, role);
    setCookie(ROLE_COOKIE, role);
  }
  setCookie(ACCESS_TOKEN_KEY, accessToken);
  clearCookie(DEMO_ROLE_COOKIE);
};

export const clearRealSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ESPACE_USER_KEY);
  localStorage.removeItem(ESPACE_ROLE_KEY);
  clearCookie(ACCESS_TOKEN_KEY);
  clearCookie(ROLE_COOKIE);
};

export function getCurrentRole(): EspaceRole | null {
  if (typeof window === 'undefined') return null;
  const storedRole = localStorage.getItem(ESPACE_ROLE_KEY);
  const userRole = getUser()?.role;
  const demoRole = DEMO_PREVIEW_ENABLED ? localStorage.getItem('espace_demo_role') : null;
  return normalizeEspaceRole(storedRole || userRole || demoRole);
}

export const getStoredRole = getCurrentRole;

export function getStoredAuth(): StoredAuth {
  if (typeof window === 'undefined') {
    return { token: null, user: null, role: null, isDemo: false };
  }
  const token = getToken();
  const user = getUser();
  const role = getCurrentRole();
  const isDemo = DEMO_PREVIEW_ENABLED && !token && !!localStorage.getItem('espace_demo_role');
  return { token, user, role, isDemo };
}

export function saveAuth(accessToken: string, user: any) {
  saveRealSession(accessToken, user);
}

export function isRealAuthenticated() {
  return !!getToken();
}

export function isDemoAuthenticated() {
  if (typeof window === 'undefined') return false;
  return DEMO_PREVIEW_ENABLED && !getToken() && !!localStorage.getItem('espace_demo_role');
}

export function getDashboardForRole(role: string | null | undefined, locale = 'ro') {
  const normalized = normalizeEspaceRole(role);
  if (normalized === 'SUPERADMIN') return `/${locale}/superadmin`;
  if (normalized === 'RESIDENT') return `/${locale}/resident`;
  return `/${locale}/admin`;
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ESPACE_USER_KEY);
  localStorage.removeItem(ESPACE_ROLE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('espace_demo_role');
  clearAuthCookies();
}
