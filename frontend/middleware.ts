import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, isLocale } from '@/i18n';
import { roleHomePath } from '@/lib/role-routing';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/accept-invitation',
  '/pricing',
  '/features',
  '/contact',
  '/demo-request',
  '/terms',
  '/privacy',
  '/403',
  '/404',
  '/error',
  '/forbidden',
];
const LOCALE_COOKIE = 'locale';
const DEMO_ROLE_COOKIE = 'espace_demo_role';
const KNOWN_ROLES = ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RESIDENT', 'TENANT', 'LOCATAR'] as const;
const CANONICAL_LOGIN_ROUTE = '/login';

type TokenPayload = {
  role?: string;
  exp?: number;
};

function getPayloadFromToken(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete('accessToken');
  response.cookies.delete('role');
  response.cookies.delete(DEMO_ROLE_COOKIE);
}

function safeHomePathForRole(role: string): string {
  return roleHomePath(role);
}

function localizedLoginPath(locale: string) {
  return `/${locale}${CANONICAL_LOGIN_ROUTE}`;
}

function normalizeMiddlewareRole(role: string | null | undefined): 'SUPERADMIN' | 'ADMIN' | 'RESIDENT' | null {
  const value = (role || '').toUpperCase();
  if (value === 'SUPERADMIN' || value === 'SUPER_ADMIN') return 'SUPERADMIN';
  if (value === 'ADMIN' || value === 'MANAGER') return 'ADMIN';
  if (value === 'RESIDENT' || value === 'TENANT' || value === 'LOCATAR') return 'RESIDENT';
  return null;
}

function requiredRoleForPath(pathWithoutLocale: string): 'SUPERADMIN' | 'ADMIN' | 'RESIDENT' | null {
  if (pathWithoutLocale === '/superadmin' || pathWithoutLocale.startsWith('/superadmin/')) return 'SUPERADMIN';
  if (pathWithoutLocale === '/admin' || pathWithoutLocale.startsWith('/admin/')) return 'ADMIN';
  if (pathWithoutLocale === '/resident' || pathWithoutLocale.startsWith('/resident/')) return 'RESIDENT';
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const maybeLocale = segments[0];
  const hasLocale = !!maybeLocale && isLocale(maybeLocale);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const preferredLocale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const token = request.cookies.get('accessToken')?.value;
  const roleCookie = request.cookies.get('role')?.value;
  const demoRoleCookie = request.cookies.get(DEMO_ROLE_COOKIE)?.value;
  const tokenPayload = token ? getPayloadFromToken(token) : null;
  const tokenExpired = !!tokenPayload?.exp && tokenPayload.exp * 1000 <= Date.now();
  const hasUsableToken = !!token && !!tokenPayload && !tokenExpired;
  const realRole = normalizeMiddlewareRole(roleCookie || tokenPayload?.role);
  const demoRole = !hasUsableToken ? normalizeMiddlewareRole(demoRoleCookie) : null;
  const activeRole = realRole || demoRole;
  const hasDemoRole = !!demoRole;

  if (!hasLocale) {
    const pathWithoutTrailingSlash = pathname.replace(/\/+$/, '') || '/';
    if (pathWithoutTrailingSlash === CANONICAL_LOGIN_ROUTE) {
      if (token && (!tokenPayload || tokenExpired)) {
        const loginUrl = new URL(localizedLoginPath(preferredLocale), request.url);
        loginUrl.searchParams.set('expired', '1');
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set(LOCALE_COOKIE, preferredLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
        clearAuthCookies(response);
        return response;
      }
      if (hasUsableToken) {
        const response = NextResponse.redirect(new URL(`/${preferredLocale}${safeHomePathForRole(realRole || '')}`, request.url));
        response.cookies.set(LOCALE_COOKIE, preferredLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
        return response;
      }
      const response = NextResponse.redirect(new URL(localizedLoginPath(preferredLocale), request.url));
      response.cookies.set(LOCALE_COOKIE, preferredLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return response;
    }

    const redirected = new URL(`/${preferredLocale}${pathname}${search}`, request.url);
    const response = NextResponse.redirect(redirected);
    response.cookies.set(LOCALE_COOKIE, preferredLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  const locale = maybeLocale;
  const pathWithoutLocale = `/${segments.slice(1).join('/')}`.replace(/\/+$/, '') || '/';
  const hasKnownRole = !!activeRole && KNOWN_ROLES.includes(activeRole as (typeof KNOWN_ROLES)[number]);
  const homeRoute = safeHomePathForRole(activeRole || '');
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`),
  );
  const requiredRole = requiredRoleForPath(pathWithoutLocale);

  if (token && (!tokenPayload || tokenExpired)) {
    const loginUrl = new URL(localizedLoginPath(locale), request.url);
    loginUrl.searchParams.set('expired', '1');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    clearAuthCookies(response);
    return response;
  }

  if (pathWithoutLocale === CANONICAL_LOGIN_ROUTE && !hasUsableToken && !hasDemoRole) {
    const response = NextResponse.next();
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  if (!activeRole && !isPublicRoute) {
    const response = NextResponse.redirect(new URL(localizedLoginPath(locale), request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  // Prevent redirect loops when token exists but role is missing/corrupted.
  if ((hasUsableToken || hasDemoRole) && !hasKnownRole) {
    const response = NextResponse.redirect(new URL(localizedLoginPath(locale), request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    clearAuthCookies(response);
    return response;
  }

  if (activeRole && pathWithoutLocale === CANONICAL_LOGIN_ROUTE) {
    const response = NextResponse.redirect(new URL(`/${locale}${homeRoute}`, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  if (activeRole && pathWithoutLocale.startsWith('/team')) {
    if (!['ADMIN', 'SUPERADMIN'].includes(activeRole)) {
      const response = NextResponse.redirect(new URL(`/${locale}${homeRoute}`, request.url));
      response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return response;
    }
  }

  if (requiredRole && activeRole && activeRole !== requiredRole) {
    const response = NextResponse.redirect(new URL(`/${locale}${homeRoute}`, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  const response = NextResponse.next();
  response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
