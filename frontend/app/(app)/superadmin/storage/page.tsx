'use client';

import { useEffect, useState } from 'react';
import { filesApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';

export default function SuperadminStoragePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    filesApi
      .superadminStorage()
      .then((res) => {
        if (!active) return;
        setRows(res.data || []);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setError('Nu am putut încărca datele de storage.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Storage" subtitle="Platform storage usage per organization." />
      {loading ? <LoadingState label="Se încarcă storage..." /> : null}
      {error ? <EmptyState title="Eroare" description={error} /> : null}
      {!loading && !error && !rows.length ? <EmptyState title="Nu există date" description="Nu există încă date de storage disponibile." /> : null}
      <div className="space-y-2">
        {rows.map((row: any) => (
          <div key={row.organizationId || row.id} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">{row.organizationName || row.organizationId || 'Organization'}</p>
            <p className="text-xs text-muted-foreground">
              Files: {row.filesCount ?? row.totalFiles ?? 0} • Used: {row.usedMb ?? row.totalUsedMb ?? 0} MB
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
