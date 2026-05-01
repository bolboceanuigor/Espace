'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { clearAuthCookies, removeToken, getUser, setToken, setUser, removeUser } from '@/lib/auth';
import { authApi } from '@/lib/api';
import { defaultLocale, isLocale } from '@/i18n';

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  authProvider?: 'LOCAL' | 'GOOGLE' | 'BOTH';
  emailVerifiedAt?: string | null;
  organizationId?: string | null;
  onboardingDone?: boolean;
  createdAt?: string;
  isDemoUser?: boolean;
  preferredLanguage?: 'RO' | 'RU' | 'EN';
};

type Org = {
  id: string;
  name: string;
  weekStart: 'MONDAY' | 'SUNDAY';
  defaultLocale: 'ro' | 'ru' | 'en';
  betaAccessEnabled?: boolean;
  isDemo?: boolean;
  modulesJson?: Record<string, boolean>;
};

type Prefs = {
  locale: 'ro' | 'ru' | 'en';
  sidebarLabels: boolean;
  calendarZoom: 'sm' | 'md' | 'lg';
  calendarStatusFilter?: string;
  calendarGroupId?: string | null;
  welcomeDismissed?: boolean;
};

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  org: Org | null;
  prefs: Prefs | null;
  system: { maintenanceMode: boolean } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    orgName: string;
    email: string;
    password: string;
    locale?: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (data: Partial<Prefs>) => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isPublicRoute(pathname: string): boolean {
  const clean = pathname.split('?')[0] || '/';
  const parts = clean.split('/').filter(Boolean);
  const withoutLocale = ['ro', 'ru', 'en'].includes(parts[0] || '') ? `/${parts.slice(1).join('/')}` : clean;
  const normalized = withoutLocale === '' ? '/' : withoutLocale;
  const publicPrefixes = [
    '/',
    '/pricing',
    '/features',
    '/contact',
    '/demo',
    '/demo-request',
    '/login',
    '/register',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/accept-invite',
    '/accept-invitation',
    '/terms',
    '/privacy',
    '/403',
    '/404',
    '/error',
    '/forbidden',
  ];
  return publicPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [system, setSystem] = useState<{ maintenanceMode: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setAccessTokenState(null);

      const cached = getUser();
      if (cached && active) {
        setUserState(cached);
      }

      try {
        const response = await authApi.getMe();
        const payload = response.data;
        const serverUser = payload?.user ?? payload;
        setUser(serverUser);
        if (active) {
          setUserState(serverUser);
          if (payload?.org) setOrg(payload.org);
          if (payload?.prefs) setPrefs(payload.prefs);
          if (payload?.system) setSystem(payload.system);
        }
      } catch (err: any) {
        removeToken();
        removeUser();
        if (active) {
          setAccessTokenState(null);
          setUserState(null);
          setOrg(null);
          setPrefs(null);
          setSystem(null);
        }
        if (typeof window !== 'undefined' && err?.status === 401) {
          const maybeLocale = window.location.pathname.split('/').filter(Boolean)[0];
          const locale = maybeLocale && isLocale(maybeLocale) ? maybeLocale : defaultLocale;
          if (!isPublicRoute(window.location.pathname)) {
            window.location.href = `/${locale}/login?expired=1`;
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const userData = res.data.user;
    if (res.data.accessToken) {
      setToken(res.data.accessToken);
      setAccessTokenState(res.data.accessToken);
    } else {
      setAccessTokenState(null);
    }
    setUser(userData);
    setUserState(userData);
    const payload = await authApi.getMe();
    if (payload.data?.user) {
      setUser(payload.data.user);
      setUserState(payload.data.user);
    }
    if (payload.data?.org) setOrg(payload.data.org);
    if (payload.data?.prefs) setPrefs(payload.data.prefs);
    if (payload.data?.system) setSystem(payload.data.system);
  }, []);

  const register = useCallback(
    async (data: {
      orgName: string;
      email: string;
      password: string;
      locale?: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const res = await authApi.register(data);
      if (res.data?.accessToken && res.data?.user) {
        const userData = res.data.user;
        setToken(res.data.accessToken);
        setAccessTokenState(res.data.accessToken);
        setUser(userData);
        setUserState(userData);
        const payload = await authApi.getMe();
        if (payload.data?.user) {
          setUser(payload.data.user);
          setUserState(payload.data.user);
        }
        if (payload.data?.org) setOrg(payload.data.org);
        if (payload.data?.prefs) setPrefs(payload.data.prefs);
        if (payload.data?.system) setSystem(payload.data.system);
      } else {
        setAccessTokenState(null);
        setUserState(null);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best effort; local auth state is always cleared below
    }
    removeToken();
    removeUser();
    clearAuthCookies();
    setAccessTokenState(null);
    setUserState(null);
    setOrg(null);
    setPrefs(null);
    setSystem(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeOrgId');
    }
    if (typeof window !== 'undefined') {
      const maybeLocale = window.location.pathname.split('/').filter(Boolean)[0];
      const locale = maybeLocale && isLocale(maybeLocale) ? maybeLocale : defaultLocale;
      window.location.href = `/${locale}/login`;
    }
  }, []);

  const updatePreferences = useCallback(async (data: Partial<Prefs>) => {
    const res = await authApi.updatePreferences(data);
    setPrefs((prev) => ({
      locale: res.data?.locale ?? prev?.locale ?? 'ro',
      sidebarLabels: res.data?.sidebarLabels ?? prev?.sidebarLabels ?? false,
      calendarZoom: res.data?.calendarZoom ?? prev?.calendarZoom ?? 'md',
      calendarStatusFilter: res.data?.calendarStatusFilter ?? prev?.calendarStatusFilter ?? 'all',
      calendarGroupId: res.data?.calendarGroupId ?? prev?.calendarGroupId ?? null,
      welcomeDismissed: res.data?.welcomeDismissed ?? prev?.welcomeDismissed ?? false,
    }));
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    org,
    prefs,
    system,
    loading,
    login,
    register,
    logout,
    updatePreferences,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
