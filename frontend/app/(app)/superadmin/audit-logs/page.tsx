'use client';

import { useCallback, useEffect, useState } from 'react';
import { auditLogsApi } from '@/lib/api';

export default function SuperadminAuditLogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ organizationId: '', action: '', entityType: '', from: '', to: '' });

  const load = useCallback(async () => {
    const res = await auditLogsApi.superadminList(filters);
    setRows(res.data || []);
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Global audit logs</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input className="input" placeholder="Organization ID" value={filters.organizationId} onChange={(e) => setFilters((p) => ({ ...p, organizationId: e.target.value }))} />
          <input className="input" placeholder="Action" value={filters.action} onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))} />
          <input className="input" placeholder="Entity type" value={filters.entityType} onChange={(e) => setFilters((p) => ({ ...p, entityType: e.target.value }))} />
          <input className="input" type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
          <input className="input" type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
        </div>
        <button className="mt-3 rounded-md border border-border/70 px-3 py-2 text-sm" onClick={load}>
          Apply filters
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
            <p className="text-sm font-medium text-foreground">
              {row.action} • {row.entityType} • {row.organization?.name || row.organizationId || 'GLOBAL'}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString()} • {row.user?.email || row.userId}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
