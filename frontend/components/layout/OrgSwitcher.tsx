'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { superadminApi } from '@/lib/api';
import { useToast } from '@/components/ui';

const ACTIVE_ORG_STORAGE_KEY = 'activeOrgId';
const ORG_CHANGED_TOAST_KEY = 'activeOrgChangedToast';

type OrgItem = {
  id: string;
  name: string;
  createdAt: string;
};

export default function OrgSwitcher() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const isSuperadmin = useMemo(
    () => (user?.role || '').toString().toUpperCase() === 'SUPERADMIN',
    [user?.role],
  );

  useEffect(() => {
    if (!isSuperadmin || typeof window === 'undefined') return;
    const persisted = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) || user?.organizationId || '';
    if (persisted) {
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, persisted);
      setActiveOrgId(persisted);
    }
    setLoading(true);
    superadminApi
      .listOrgs()
      .then((res) => {
        setOrgs(res.data || []);
      })
      .finally(() => setLoading(false));
  }, [isSuperadmin, user?.organizationId]);

  useEffect(() => {
    if (!isSuperadmin || typeof window === 'undefined') return;
    const shouldShowToast = sessionStorage.getItem(ORG_CHANGED_TOAST_KEY) === '1';
    if (!shouldShowToast) return;
    sessionStorage.removeItem(ORG_CHANGED_TOAST_KEY);
    showToast('Organization changed', 'success');
  }, [isSuperadmin, showToast]);

  if (!isSuperadmin) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Org</span>
      <select
        className="h-9 min-w-[180px] rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        value={activeOrgId}
        disabled={loading || orgs.length === 0}
        onChange={(event) => {
          const next = event.target.value;
          setActiveOrgId(next);
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, next);
            sessionStorage.setItem(ORG_CHANGED_TOAST_KEY, '1');
            router.refresh();
            window.location.reload();
          }
        }}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}

