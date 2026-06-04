'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_BRANDING_MENU,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SIDEBAR_COLOR,
  hexToHslTriplet,
  normalizeMenuConfig,
  normalizePrimaryColor,
  normalizeSidebarColor,
  type BrandingMenuItem,
} from '@/lib/branding';
import { useAuth } from './AuthContext';

type BrandingState = {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  sidebarColor: string;
  themeMode: 'LIGHT' | 'DARK';
  menuConfig: BrandingMenuItem[];
};

type BrandingContextValue = {
  branding: BrandingState;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  setBranding: (next: Partial<BrandingState>) => void;
};

const DEFAULT_BRANDING: BrandingState = {
  appName: 'Espace',
  logoUrl: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  sidebarColor: DEFAULT_SIDEBAR_COLOR,
  themeMode: 'LIGHT',
  menuConfig: DEFAULT_BRANDING_MENU,
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function applyBrandingToDom(branding: BrandingState) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const primaryColor = normalizePrimaryColor(branding.primaryColor);
  const sidebarColor = normalizeSidebarColor(branding.sidebarColor);
  root.style.setProperty('--primary', hexToHslTriplet(primaryColor));
  root.style.setProperty('--sidebar-bg', hexToHslTriplet(sidebarColor));
  root.style.setProperty('--brand-primary-hex', primaryColor);
  root.style.setProperty('--brand-sidebar-hex', sidebarColor);
  root.dataset.theme = branding.themeMode.toLowerCase();
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [branding, setBrandingState] = useState<BrandingState>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const refreshBranding = async () => {
    if (!isAuthenticated) {
      setBrandingState(DEFAULT_BRANDING);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { settingsApi } = await import('@/lib/api');
      const response = await settingsApi.get();
      const org = response.data?.org;
      setBrandingState({
        appName: org?.appName || 'Espace',
        logoUrl: org?.logoUrl || null,
        primaryColor: normalizePrimaryColor(org?.primaryColor),
        sidebarColor: normalizeSidebarColor(org?.sidebarColor),
        themeMode: org?.themeMode === 'DARK' ? 'DARK' : 'LIGHT',
        menuConfig: normalizeMenuConfig(org?.menuConfig),
      });
    } catch {
      setBrandingState(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBranding();
  }, [isAuthenticated]);

  useEffect(() => {
    applyBrandingToDom(branding);
  }, [branding]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      loading,
      refreshBranding,
      setBranding: (next) =>
        setBrandingState((prev) => ({
          ...prev,
          ...next,
          primaryColor: next.primaryColor ? normalizePrimaryColor(next.primaryColor) : prev.primaryColor,
          sidebarColor: next.sidebarColor ? normalizeSidebarColor(next.sidebarColor) : prev.sidebarColor,
          menuConfig: next.menuConfig ? normalizeMenuConfig(next.menuConfig) : prev.menuConfig,
        })),
    }),
    [branding, loading],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used inside BrandingProvider');
  return ctx;
}
