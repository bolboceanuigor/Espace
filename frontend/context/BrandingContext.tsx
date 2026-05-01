'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { settingsApi } from '@/lib/api';
import { DEFAULT_BRANDING_MENU, hexToHslTriplet, normalizeMenuConfig, type BrandingMenuItem } from '@/lib/branding';
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
  appName: 'CondoFlow',
  logoUrl: null,
  primaryColor: '#2563eb',
  sidebarColor: '#ffffff',
  themeMode: 'LIGHT',
  menuConfig: DEFAULT_BRANDING_MENU,
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function applyBrandingToDom(branding: BrandingState) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary', hexToHslTriplet(branding.primaryColor));
  root.style.setProperty('--sidebar-bg', branding.sidebarColor);
  root.style.setProperty('--brand-primary-hex', branding.primaryColor);
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
      const response = await settingsApi.get();
      const org = response.data?.org;
      setBrandingState({
        appName: org?.appName || 'CondoFlow',
        logoUrl: org?.logoUrl || null,
        primaryColor: org?.primaryColor || '#2563eb',
        sidebarColor: org?.sidebarColor || '#ffffff',
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
