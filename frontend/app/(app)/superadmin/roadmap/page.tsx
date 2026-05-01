'use client';

import { useCallback, useEffect, useState } from 'react';
import { roadmapApi } from '@/lib/api';

const STATUSES = ['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'] as const;
const CATEGORIES = ['PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER'] as const;
const VISIBILITY = ['INTERNAL', 'PUBLIC'] as const;

export default function SuperadminRoadmapPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '' });

  const load = useCallback(async () => {
    const res = await roadmapApi.superadminList({
      status: (filters.status || undefined) as any,
      category: (filters.category || undefined) as any,
    });
    setItems(res.data || []);
  }, [filters.status, filters.category]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Roadmap management</h1>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <select className="input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select className="input" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Feature</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Votes</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Organization</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/50 align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </td>
                <td className="px-3 py-2">{item.category}</td>
                <td className="px-3 py-2">{item._count?.votes || 0}</td>
                <td className="px-3 py-2">
                  <select
                    className="input h-8 w-44"
                    value={item.status}
                    onChange={async (e) => {
                      await roadmapApi.superadminUpdate(item.id, { status: e.target.value as any });
                      await load();
                    }}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="input h-8 w-36"
                    value={item.visibility}
                    onChange={async (e) => {
                      await roadmapApi.superadminUpdate(item.id, { visibility: e.target.value as any });
                      await load();
                    }}
                  >
                    {VISIBILITY.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {visibility}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">{item.organization?.name || '-'}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No roadmap items found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
