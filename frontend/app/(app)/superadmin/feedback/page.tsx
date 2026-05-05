'use client';

import { useCallback, useEffect, useState } from 'react';
import { feedbackApi, superadminApi } from '@/lib/api';

export default function SuperadminFeedbackPage() {
  const [items, setItems] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    organizationId: '',
    type: '',
    status: '',
    priority: '',
  });

  const load = useCallback(async () => {
    const [res, orgRes] = await Promise.all([
      feedbackApi.superadminList({
        organizationId: filters.organizationId || undefined,
        type: (filters.type as any) || undefined,
        status: (filters.status as any) || undefined,
        priority: (filters.priority as any) || undefined,
      }),
      superadminApi.listOrgs(),
    ]);
    setItems(res.data || []);
    setOrgs(orgRes.data || []);
  }, [filters.organizationId, filters.type, filters.status, filters.priority]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Feedback global</h1>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <select className="select" value={filters.organizationId} onChange={(e) => setFilters((p) => ({ ...p, organizationId: e.target.value }))}>
          <option value="">Toate organizatiile</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <select className="select" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}>
          <option value="">Toate tipurile</option>
          <option value="BUG">BUG</option>
          <option value="IDEA">IDEA</option>
          <option value="QUESTION">QUESTION</option>
          <option value="COMPLAINT">COMPLAINT</option>
        </select>
        <select className="select" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">Toate statusurile</option>
          <option value="NEW">NEW</option>
          <option value="REVIEWED">REVIEWED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <select className="select" value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}>
          <option value="">Toate prioritatile</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Organizatie</th>
              <th className="px-3 py-2">Tip</th>
              <th className="px-3 py-2">Titlu</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Prioritate</th>
              <th className="px-3 py-2">Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border/60 align-top">
                <td className="px-3 py-2">{item.organization?.name || '-'}</td>
                <td className="px-3 py-2">{item.type}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  <p className="text-[11px] text-muted-foreground">{item.pageUrl || '-'}</p>
                </td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">{item.priority}</td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <select
                      className="select"
                      value={item.status}
                      onChange={async (e) => {
                        await feedbackApi.superadminUpdate(item.id, { status: e.target.value as any });
                        await load();
                      }}
                    >
                      <option value="NEW">NEW</option>
                      <option value="REVIEWED">REVIEWED</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                    <select
                      className="select"
                      value={item.priority}
                      onChange={async (e) => {
                        await feedbackApi.superadminUpdate(item.id, { priority: e.target.value as any });
                        await load();
                      }}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

