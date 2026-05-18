'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { residentContextApi } from '@/lib/api';

type ResidentContextValue = {
  user: { id?: string; fullName?: string | null; email?: string | null } | null;
  resident: { id?: string; fullName?: string | null; phone?: string | null } | null;
  portalAccessStatus: string | null;
  apartments: Array<{
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    association?: { id: string; shortName: string; associationCode?: string | null } | null;
  }>;
  associations: Array<{ id: string; shortName: string; associationCode?: string | null }>;
  activeAssociation: { id: string; shortName: string; associationCode?: string | null } | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const ResidentContext = createContext<ResidentContextValue | null>(null);

export function ResidentContextProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Omit<ResidentContextValue, 'loading' | 'error' | 'reload'>>({
    user: null,
    resident: null,
    portalAccessStatus: null,
    apartments: [],
    associations: [],
    activeAssociation: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await residentContextApi.get();
      const payload = response.data || {};
      setData({
        user: payload.user || null,
        resident: payload.resident || null,
        portalAccessStatus: payload.portalAccessStatus || null,
        apartments: Array.isArray(payload.apartments) ? payload.apartments : [],
        associations: Array.isArray(payload.associations) ? payload.associations : [],
        activeAssociation: payload.activeAssociation || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nu am putut încărca portalul locatarului.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<ResidentContextValue>(
    () => ({
      ...data,
      loading,
      error,
      reload,
    }),
    [data, error, loading, reload],
  );

  return <ResidentContext.Provider value={value}>{children}</ResidentContext.Provider>;
}

export function useResidentContext() {
  const context = useContext(ResidentContext);
  if (!context) {
    throw new Error('useResidentContext must be used inside ResidentContextProvider');
  }
  return context;
}
