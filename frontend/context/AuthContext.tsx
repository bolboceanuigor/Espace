'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  clearAuth,
  clearAuthCookies,
  getToken,
  getUser,
  isDemoAuthenticated,
  removeToken,
  removeUser,
  saveAuth,
  setToken,
  setUser,
} from '@/lib/auth';
import { authApi } from '@/lib/api';
import { defaultLocale, isLocale } from '@/i18n';
import { isApiConfigured } from '@/lib/runtime-config';

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
  isDemoAuthenticated: boolean;
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
  const [demoAuthenticated, setDemoAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setAccessTokenState(null);
      setDemoAuthenticated(isDemoAuthenticated());

      if (!isApiConfigured()) {
        removeToken();
        removeUser();
        if (active) {
          setUserState(null);
          setOrg(null);
          setPrefs(null);
          setSystem(null);
          setDemoAuthenticated(isDemoAuthenticated());
          setLoading(false);
        }
        return;
      }

      const cachedToken = getToken();
      const cached = getUser();
      if (cachedToken && active) {
        setAccessTokenState(cachedToken);
      }
      if (cached && active) {
        setUserState(cached);
      }

      if (!cachedToken) {
        if (active) {
          setDemoAuthenticated(isDemoAuthenticated());
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authApi.getMe();
        const payload = response.data;
        const serverUser = payload?.user ?? payload;
        saveAuth(cachedToken, serverUser);
        if (active) {
          setUserState(serverUser);
          setAccessTokenState(cachedToken);
          setDemoAuthenticated(false);
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
          setDemoAuthenticated(isDemoAuthenticated());
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
      saveAuth(res.data.accessToken, userData);
      setAccessTokenState(res.data.accessToken);
    } else {
      setAccessTokenState(null);
    }
    setUser(userData);
    setUserState(userData);
    setDemoAuthenticated(false);
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
          saveAuth(res.data.accessToken, userData);
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
    clearAuth();
    clearAuthCookies();
    setAccessTokenState(null);
    setUserState(null);
    setOrg(null);
    setPrefs(null);
    setSystem(null);
    setDemoAuthenticated(false);
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
    isDemoAuthenticated: demoAuthenticated,
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
