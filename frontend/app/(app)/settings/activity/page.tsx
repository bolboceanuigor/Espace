'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui';
import { activityApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type ActivityItem = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
  performedByRole?: string | null;
  createdAt: string;
};

export default function SettingsActivityPage() {
  const tSettings = useTranslations('pages.settings');
  const { user } = useAuth();
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [entityType, setEntityType] = useState('');
  const [limit, setLimit] = useState(200);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    activityApi
      .getAll({ entityType: entityType || undefined, limit })
      .then((res) => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, [entityType, isAdmin, limit]);

  return (
    <div className="space-y-4">
      <PageHeader title={tSettings('activityTitle')} description={tSettings('activityDesc')} />
      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        {isAdmin ? (
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
              placeholder="Filter by entity type (reservation, property...)"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            />
            <select
              className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
              value={String(limit)}
              onChange={(event) => setLimit(Number(event.target.value))}
            >
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        ) : null}
        {!isAdmin ? (
          <p className="text-sm text-muted-foreground">{tSettings('adminOnly')}</p>
        ) : null}
        {isAdmin && loading ? (
          <div className="space-y-2">
            {[...Array.from({ length: 6 })].map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : null}
        {isAdmin && !loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tSettings('activityEmpty')}</p>
        ) : null}
        {isAdmin && !loading && items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 px-3 py-2">
                <p className="text-sm font-medium text-foreground">{item.action}</p>
                <p className="text-xs text-muted-foreground">
                  {item.entityType || '-'} {item.entityId ? `• ${item.entityId}` : ''} •{' '}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
