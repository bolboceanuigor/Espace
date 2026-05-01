const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'user';
const ROLE_COOKIE = 'role';
const isProd = typeof window !== 'undefined' && window.location.protocol === 'https:';
const cookieSecurity = isProd ? '; secure' : '';

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const setToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  document.cookie = `${ACCESS_TOKEN_KEY}=${token}; path=/; max-age=604800; samesite=lax${cookieSecurity}`;
};

export const removeToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
};

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
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
  localStorage.removeItem(USER_KEY);
  document.cookie = `${ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
};

export const clearAuthCookies = () => {
  if (typeof window === 'undefined') return;
  document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
  document.cookie = `${ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${cookieSecurity}`;
};
