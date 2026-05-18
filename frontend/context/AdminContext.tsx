'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ACTIVE_ORG_STORAGE_KEY, adminContextApi } from '@/lib/api';

type AssociationSummary = {
  id: string;
  shortName: string;
  associationCode?: string | null;
  status?: string | null;
  membershipStatus?: string | null;
};

type AdminContextValue = {
  user: { id?: string; fullName?: string | null; email?: string | null; role?: string | null } | null;
  activeAssociation: AssociationSummary | null;
  availableAssociations: AssociationSummary[];
  membership: {
    id?: string | null;
    status?: string | null;
    role?: { id?: string | null; name?: string | null; type?: string | null } | null;
  } | null;
  permissions: string[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  switchAssociation: (associationId: string) => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  can: (module: string, action: string) => boolean;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function normalizePermission(permission: string) {
  return permission.trim().toLowerCase().replace(':', '.');
}

export function AdminContextProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    user: AdminContextValue['user'];
    activeAssociation: AssociationSummary | null;
    availableAssociations: AssociationSummary[];
    membership: AdminContextValue['membership'];
    permissions: string[];
  }>({
    user: null,
    activeAssociation: null,
    availableAssociations: [],
    membership: null,
    permissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPayload = useCallback((payload: any) => {
    const activeAssociation = payload?.activeAssociation || null;
    if (activeAssociation?.id && typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, activeAssociation.id);
    }
    setState({
      user: payload?.user || null,
      activeAssociation,
      availableAssociations: Array.isArray(payload?.availableAssociations) ? payload.availableAssociations : [],
      membership: payload?.membership || null,
      permissions: Array.isArray(payload?.permissions) ? payload.permissions.map(normalizePermission) : [],
    });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminContextApi.get();
      applyPayload(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nu am putut încărca contextul asociației.');
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const switchAssociation = useCallback(
    async (associationId: string) => {
      if (!associationId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await adminContextApi.switchAssociation(associationId);
        applyPayload({
          ...response.data,
          user: state.user,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nu am putut schimba asociația activă.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applyPayload, state.user],
  );

  const permissionSet = useMemo(() => new Set(state.permissions.map(normalizePermission)), [state.permissions]);

  const value = useMemo<AdminContextValue>(
    () => ({
      ...state,
      loading,
      error,
      reload,
      switchAssociation,
      hasPermission: (permissionKey: string) => permissionSet.has(normalizePermission(permissionKey)),
      can: (module: string, action: string) => permissionSet.has(`${module}.${action}`.toLowerCase()),
    }),
    [error, loading, permissionSet, reload, state, switchAssociation],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used inside AdminContextProvider');
  }
  return context;
}
