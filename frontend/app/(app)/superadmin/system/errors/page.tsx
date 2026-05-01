'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { systemMonitoringApi } from '@/lib/api';

const SOURCES = ['BACKEND', 'FRONTEND', 'JOB', 'WEBHOOK', 'PAYMENT_PROVIDER'] as const;
const LEVELS = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;

export default function SuperadminSystemErrorsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    source: '',
    level: '',
    resolved: 'false',
    organizationId: '',
  });

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemMonitoringApi.superadminListErrors({
        source: (filters.source || undefined) as any,
        level: (filters.level || undefined) as any,
        resolved: filters.resolved === 'all' ? undefined : filters.resolved === 'true',
        organizationId: filters.organizationId || undefined,
      });
      setRows(res.data || []);
      if (!selectedId && (res.data || []).length) setSelectedId(res.data?.[0]?.id || '');
    } finally {
      setLoading(false);
    }
  }, [filters.source, filters.level, filters.resolved, filters.organizationId, selectedId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">System errors</h1>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <select className="input" value={filters.source} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}>
            <option value="">All sources</option>
            {SOURCES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="input" value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))}>
            <option value="">All levels</option>
            {LEVELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="input" value={filters.resolved} onChange={(e) => setFilters((p) => ({ ...p, resolved: e.target.value }))}>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
            <option value="all">All</option>
          </select>
          <input
            className="input"
            placeholder="Organization ID"
            value={filters.organizationId}
            onChange={(e) => setFilters((p) => ({ ...p, organizationId: e.target.value }))}
          />
          <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Apply filters'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Organization</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-b border-border/40 hover:bg-muted/30" onClick={() => setSelectedId(row.id)}>
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{row.source}</td>
                <td className="px-3 py-2">{row.level}</td>
                <td className="max-w-[380px] truncate px-3 py-2">{row.message}</td>
                <td className="px-3 py-2">{row.organization?.name || row.organizationId || '-'}</td>
                <td className="px-3 py-2">{row.resolved ? 'resolved' : 'unresolved'}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No errors found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-border/70 bg-background p-4 shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{selected.source} · {selected.level}</p>
              <p className="text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
            <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={() => setSelectedId('')}>
              Close
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="font-medium text-foreground">Message</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.message}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="font-medium text-foreground">Stack</p>
              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{selected.stack || '-'}</pre>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="font-medium text-foreground">Metadata</p>
              <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {selected.metadataJson ? JSON.stringify(selected.metadataJson, null, 2) : '-'}
              </pre>
            </div>
          </div>
          {!selected.resolved ? (
            <button
              className="mt-4 rounded-md border border-border/70 px-3 py-2 text-sm"
              onClick={async () => {
                await systemMonitoringApi.superadminResolveError(selected.id);
                await load();
                setSelectedId('');
              }}
            >
              Mark resolved
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
