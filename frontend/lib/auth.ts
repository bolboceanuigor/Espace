const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'user';
const ROLE_COOKIE = 'role';
export const ESPACE_ACCESS_TOKEN_KEY = 'espace_access_token';
export const ESPACE_USER_KEY = 'espace_user';
export const ESPACE_ROLE_KEY = 'espace_role';
const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:';
const cookieSecurity = isProd ? '; secure' : '';

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ESPACE_ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const setToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  document.cookie = `${ACCESS_TOKEN_KEY}=${token}; path=/; max-age=604800; samesite=lax${cookieSecurity}`;
};

export const removeToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
};

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(ESPACE_USER_KEY) || localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setUser = (user: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const role = (user?.role || '').toString().toUpperCase();
  if (role) {
    document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=604800; samesite=lax${cookieSecurity}`;
  }
};

export const removeUser = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_USER_KEY);
  localStorage.removeItem(ESPACE_ROLE_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = `${ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
};

export const clearAuthCookies = () => {
  if (typeof window === 'undefined') return;
  document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
  document.cookie = `${ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
};

export const saveRealSession = (accessToken: string, user: any) => {
  if (typeof window === 'undefined') return;
  const role = (user?.role || '').toString().toUpperCase();
  localStorage.setItem(ESPACE_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(ESPACE_USER_KEY, JSON.stringify(user));
  if (role) localStorage.setItem(ESPACE_ROLE_KEY, role);
};

export const clearRealSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ESPACE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ESPACE_USER_KEY);
  localStorage.removeItem(ESPACE_ROLE_KEY);
};
