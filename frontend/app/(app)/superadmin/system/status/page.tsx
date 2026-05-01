'use client';

import { useCallback, useEffect, useState } from 'react';
import { systemMonitoringApi } from '@/lib/api';

export default function SuperadminSystemStatusPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemMonitoringApi.superadminSystemStatus();
      setData(res.data || null);
    } catch {
      setError('Nu am putut incarca statusul sistemului.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">System Status</h1>
        <button className="rounded-md border border-border/70 px-3 py-2 text-xs" onClick={() => load().catch(() => undefined)}>
          Refresh
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Last check: {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : loading ? 'Loading...' : '-'}
      </p>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{error}</p>
          <button
            className="mt-2 rounded-md border border-destructive/40 px-3 py-1 text-xs"
            onClick={() => load().catch(() => undefined)}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          ['API status', data?.apiStatus || '-'],
          ['Database', data?.databaseStatus || '-'],
          ['Jobs (failed)', data?.failedJobsCount ?? 0],
          ['Errors (unresolved)', data?.unresolvedErrorsCount ?? 0],
          ['Storage (MB)', data?.storageSummary?.totalUsedMb ?? 0],
          ['Organizations (active)', data?.activeOrganizationsCount ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Last successful scheduled job run</p>
        {data?.lastSuccessfulScheduledJobRun ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {data.lastSuccessfulScheduledJobRun.jobName} at{' '}
            {new Date(data.lastSuccessfulScheduledJobRun.lastRunAt).toLocaleString()}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No successful scheduled job run recorded.</p>
        )}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Build info</p>
        <p className="mt-1 text-sm text-muted-foreground">Version: {data?.appVersion || '-'}</p>
        <p className="text-sm text-muted-foreground">Environment: {data?.environment || '-'}</p>
        <p className="text-sm text-muted-foreground">Total files: {data?.storageSummary?.totalFiles ?? 0}</p>
      </div>
    </div>
  );
}
