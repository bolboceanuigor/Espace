'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminRbacApi } from '@/lib/api';

export type PermissionModule =
  | 'DASHBOARD'
  | 'APARTMENTS'
  | 'RESIDENTS'
  | 'TARIFFS'
  | 'METERS'
  | 'METER_READINGS'
  | 'BILLING'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'RECONCILIATION'
  | 'REPORTS'
  | 'ANNOUNCEMENTS'
  | 'REQUESTS'
  | 'IMPORTS'
  | 'EXPORTS'
  | 'DATA_QUALITY'
  | 'TEAM'
  | 'SETTINGS'
  | 'AUDIT_LOG'
  | 'NOTIFICATIONS';

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'CANCEL'
  | 'EXPORT'
  | 'IMPORT'
  | 'MANAGE'
  | 'FINALIZE'
  | 'LOCK'
  | 'ASSIGN'
  | 'INVITE';

type PermissionState = {
  permissions: Record<string, boolean>;
  loading: boolean;
  error: string;
  role?: { id?: string; name?: string; type?: string } | null;
  refresh: () => Promise<void>;
  can: (module: PermissionModule, action: PermissionAction) => boolean;
};

const PermissionContext = createContext<PermissionState | null>(null);

function keyFor(module: PermissionModule, action: PermissionAction) {
  return `${module.toLowerCase()}.${action.toLowerCase()}`;
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<PermissionState['role']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminRbacApi.myPermissions();
      setPermissions(response.data?.permissions || {});
      setRole(response.data?.role || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca permisiunile.'));
      setPermissions({});
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      if (loading) return true;
      if (!Object.keys(permissions).length && error) return true;
      return permissions[keyFor(module, action)] === true;
    },
    [error, loading, permissions],
  );

  const value = useMemo(
    () => ({ permissions, loading, error, role, refresh, can }),
    [can, error, loading, permissions, refresh, role],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context) return context;
  return {
    permissions: {},
    loading: false,
    error: '',
    role: null,
    refresh: async () => {},
    can: () => true,
  } satisfies PermissionState;
}

export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: PermissionModule;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions();
  return can(module, action) ? <>{children}</> : <>{fallback}</>;
}
