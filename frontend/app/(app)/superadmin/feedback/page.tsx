'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Lightbulb, Link2, MessageSquare, RefreshCw } from 'lucide-react';
import { feedbackApi, superadminApi } from '@/lib/api';

const TYPES = ['BUG', 'IDEA', 'QUESTION', 'COMPLAINT'] as const;
const STATUSES = ['NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

function Badge({ value }: { value?: string }) {
  const tone = value === 'RESOLVED' || value === 'LOW' ? 'emerald' : value === 'HIGH' || value === 'COMPLAINT' || value === 'BUG' ? 'red' : value === 'IN_PROGRESS' || value === 'IDEA' ? 'blue' : 'slate';
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls[tone]}`}>{value || '-'}</span>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</div><p className="text-2xl font-semibold text-slate-950">{value || 0}</p><p className="text-sm text-slate-500">{label}</p></div>;
}

export default function SuperadminFeedbackPage() {
  const [items, setItems] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [filters, setFilters] = useState({ organizationId: '', type: '', status: '', priority: '', linked: '' });

  const load = useCallback(async () => {
    const [res, orgRes, dash] = await Promise.all([
      feedbackApi.superadminList({
        organizationId: filters.organizationId || undefined,
        type: (filters.type as any) || undefined,
        status: (filters.status as any) || undefined,
        priority: (filters.priority as any) || undefined,
        linked: (filters.linked as any) || undefined,
      }),
      superadminApi.listOrgs(),
      feedbackApi.superadminDashboard(),
    ]);
    setItems(res.data || []);
    setOrgs(orgRes.data || []);
    setDashboard(dash.data || {});
  }, [filters.organizationId, filters.type, filters.status, filters.priority, filters.linked]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold text-slate-950">Customer Feedback Intake</h1>
          <p className="mt-1 text-sm text-slate-500">Centralizează bug-uri, idei, întrebări și reclamații. Ideile validate pot fi convertite în feature requests pentru roadmap.</p>
        </header>

        <div className="grid gap-3 md:grid-cols-5">
          <Kpi icon={<MessageSquare />} label="Nou" value={dashboard?.byStatus?.NEW} />
          <Kpi icon={<RefreshCw />} label="În lucru" value={dashboard?.byStatus?.IN_PROGRESS} />
          <Kpi icon={<CheckCircle2 />} label="Rezolvat" value={dashboard?.byStatus?.RESOLVED} />
          <Kpi icon={<Lightbulb />} label="Idei" value={dashboard?.byType?.IDEA} />
          <Kpi icon={<ArrowUpRight />} label="Candidați roadmap" value={dashboard?.roadmapCandidates} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <select className="select" value={filters.organizationId} onChange={(e) => setFilters((p) => ({ ...p, organizationId: e.target.value }))}>
              <option value="">Toate organizațiile</option>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <select className="select" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}>
              <option value="">Toate tipurile</option>
              {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className="select" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Toate statusurile</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className="select" value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}>
              <option value="">Toate prioritățile</option>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
            <select className="select" value={filters.linked} onChange={(e) => setFilters((p) => ({ ...p, linked: e.target.value }))}>
              <option value="">Toate</option>
              <option value="false">Nelegate de roadmap</option>
              <option value="true">Legate de roadmap</option>
            </select>
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Feedback</th>
                <th>Client</th>
                <th>Tip</th>
                <th>Status</th>
                <th>Prioritate</th>
                <th>Modul</th>
                <th>Roadmap</th>
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="p-3">
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-slate-600">{item.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.pageUrl || '-'}</p>
                  </td>
                  <td>{item.organization?.name || '-'}<p className="text-xs text-slate-500">{item.user?.email}</p></td>
                  <td><Badge value={item.type} /></td>
                  <td><StatusSelect item={item} onDone={load} /></td>
                  <td><PrioritySelect item={item} onDone={load} /></td>
                  <td>{item.moduleKey || '-'}</td>
                  <td>{item.linkedFeatureRequest ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Link2 className="h-3 w-3" />{item.linkedFeatureRequest.title}</span> : '-'}</td>
                  <td>
                    <div className="flex flex-col gap-2">
                      {!item.linkedFeatureRequest && item.type === 'IDEA' ? (
                        <button className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white" onClick={async () => { await feedbackApi.convertToFeature(item.id); await load(); }}>
                          Convert to feature
                        </button>
                      ) : null}
                      <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={async () => { const note = window.prompt('Notă internă'); if (!note) return; await feedbackApi.superadminUpdate(item.id, { internalNotes: note }); await load(); }}>
                        Notă internă
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Nu există feedback pentru filtrele selectate.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function StatusSelect({ item, onDone }: { item: any; onDone: () => Promise<void> }) {
  return <select className="select h-9" value={item.status} onChange={async (e) => { await feedbackApi.superadminUpdate(item.id, { status: e.target.value as any }); await onDone(); }}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>;
}

function PrioritySelect({ item, onDone }: { item: any; onDone: () => Promise<void> }) {
  return <select className="select h-9" value={item.priority} onChange={async (e) => { await feedbackApi.superadminUpdate(item.id, { priority: e.target.value as any }); await onDone(); }}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>;
}
