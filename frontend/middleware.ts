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
  '/demo',
  '/demo-request',
  '/terms',
  '/privacy',
  '/403',
  '/404',
  '/error',
  '/forbidden',
];
const LOCALE_COOKIE = 'locale';
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
}

function safeHomePathForRole(role: string): string {
  return roleHomePath(role);
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
  const tokenPayload = token ? getPayloadFromToken(token) : null;
  const tokenExpired = !!tokenPayload?.exp && tokenPayload.exp * 1000 <= Date.now();
  const hasUsableToken = !!token && !!tokenPayload && !tokenExpired;
  const role = (roleCookie || tokenPayload?.role || '').toUpperCase();

  if (!hasLocale) {
    const pathWithoutTrailingSlash = pathname.replace(/\/+$/, '') || '/';
    if (pathWithoutTrailingSlash === CANONICAL_LOGIN_ROUTE) {
      if (token && (!tokenPayload || tokenExpired)) {
        const loginUrl = new URL(CANONICAL_LOGIN_ROUTE, request.url);
        loginUrl.searchParams.set('expired', '1');
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set(LOCALE_COOKIE, preferredLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
        clearAuthCookies(response);
        return response;
      }
      if (hasUsableToken) {
        const response = NextResponse.redirect(new URL(`/${preferredLocale}${safeHomePathForRole(role)}`, request.url));
        response.cookies.set(LOCALE_COOKIE, preferredLocale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
        return response;
      }
      const response = NextResponse.next();
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
  const hasKnownRole = KNOWN_ROLES.includes(role as (typeof KNOWN_ROLES)[number]);
  const homeRoute = safeHomePathForRole(role);
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`),
  );
  const isForbiddenRoute = pathWithoutLocale === '/forbidden' || pathWithoutLocale === '/403';

  if (token && (!tokenPayload || tokenExpired)) {
    const loginUrl = new URL(CANONICAL_LOGIN_ROUTE, request.url);
    loginUrl.searchParams.set('expired', '1');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    clearAuthCookies(response);
    return response;
  }

  if (pathWithoutLocale === CANONICAL_LOGIN_ROUTE && !hasUsableToken) {
    const response = NextResponse.redirect(new URL(`${CANONICAL_LOGIN_ROUTE}${search}`, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  if (!hasUsableToken && !isPublicRoute) {
    const response = NextResponse.redirect(new URL(CANONICAL_LOGIN_ROUTE, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  // Prevent redirect loops when token exists but role is missing/corrupted.
  if (hasUsableToken && !hasKnownRole) {
    const response = NextResponse.redirect(new URL(CANONICAL_LOGIN_ROUTE, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    clearAuthCookies(response);
    return response;
  }

  if (hasUsableToken && isPublicRoute && !isForbiddenRoute) {
    const response = NextResponse.redirect(new URL(`/${locale}${homeRoute}`, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  if (hasUsableToken && pathWithoutLocale === '/') {
    const response = NextResponse.redirect(new URL(`/${locale}${homeRoute}`, request.url));
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return response;
  }

  if (hasUsableToken && pathWithoutLocale.startsWith('/team')) {
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
      const response = NextResponse.redirect(new URL(`/${locale}/403`, request.url));
      response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return response;
    }
  }

  if (hasUsableToken && pathWithoutLocale.startsWith('/superadmin')) {
    if (role !== 'SUPERADMIN' && role !== 'SUPER_ADMIN') {
      const response = NextResponse.redirect(new URL(`/${locale}/403`, request.url));
      response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return response;
    }
  }

  if (hasUsableToken && pathWithoutLocale.startsWith('/admin')) {
    if (!['ADMIN', 'MANAGER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
      const response = NextResponse.redirect(new URL(`/${locale}/403`, request.url));
      response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return response;
    }
  }

  if (hasUsableToken && pathWithoutLocale.startsWith('/resident')) {
    if (!['RESIDENT', 'TENANT', 'LOCATAR'].includes(role)) {
      const response = NextResponse.redirect(new URL(`/${locale}/403`, request.url));
      response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      return response;
    }
  }

  const response = NextResponse.next();
  response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
