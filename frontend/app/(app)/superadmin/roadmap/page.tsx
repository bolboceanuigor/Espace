'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, GitBranch, Lightbulb, MessageSquare, Rocket, ThumbsUp } from 'lucide-react';
import { roadmapApi } from '@/lib/api';

const STATUSES = ['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'] as const;
const CATEGORIES = ['PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER'] as const;
const VISIBILITY = ['INTERNAL', 'PUBLIC'] as const;

function Badge({ value }: { value?: string }) {
  const tone = value === 'RELEASED' || value === 'PUBLIC' ? 'emerald' : value === 'REJECTED' ? 'red' : value === 'PLANNED' || value === 'IN_PROGRESS' ? 'blue' : 'slate';
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

export default function SuperadminRoadmapPage() {
  const [items, setItems] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [filters, setFilters] = useState({ status: '', category: '', visibility: '' });

  const load = useCallback(async () => {
    const [res, dash] = await Promise.all([
      roadmapApi.superadminList({
        status: (filters.status || undefined) as any,
        category: (filters.category || undefined) as any,
        visibility: (filters.visibility || undefined) as any,
      }),
      roadmapApi.superadminDashboard(),
    ]);
    setItems(res.data || []);
    setDashboard(dash.data || {});
  }, [filters.status, filters.category, filters.visibility]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold text-slate-950">Feature Requests & Roadmap Intake</h1>
          <p className="mt-1 text-sm text-slate-500">Prioritizează cererile clienților fără să expui roadmap-ul intern complet. Doar elementele marcate PUBLIC apar în roadmap-ul utilizatorilor.</p>
        </header>

        <div className="grid gap-3 md:grid-cols-6">
          <Kpi icon={<Lightbulb />} label="Noi" value={dashboard?.byStatus?.NEW} />
          <Kpi icon={<GitBranch />} label="Planificate" value={dashboard?.byStatus?.PLANNED} />
          <Kpi icon={<Rocket />} label="Lansate" value={dashboard?.byStatus?.RELEASED} />
          <Kpi icon={<Eye />} label="Publice" value={dashboard?.publicItems} />
          <Kpi icon={<ThumbsUp />} label="Voturi" value={dashboard?.totalVotes} />
          <Kpi icon={<MessageSquare />} label="Feedback legat" value={dashboard?.linkedFeedback} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <select className="input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select className="input" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
              <option value="">All categories</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="input" value={filters.visibility} onChange={(e) => setFilters((p) => ({ ...p, visibility: e.target.value }))}>
              <option value="">All visibility</option>
              {VISIBILITY.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
            </select>
            <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={load}>Refresh</button>
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Feature</th>
                <th>Category</th>
                <th>Score</th>
                <th>Votes</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Source</th>
                <th>Quarter</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="p-3">
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-slate-600">{item.publicSummary || item.description}</p>
                    {item.internalNotes ? <p className="mt-1 text-xs text-slate-400">{item.internalNotes}</p> : null}
                  </td>
                  <td><Badge value={item.category} /></td>
                  <td className="font-semibold">{item.score || 0}</td>
                  <td>{item._count?.votes || 0}</td>
                  <td><StatusSelect item={item} onDone={load} /></td>
                  <td><VisibilitySelect item={item} onDone={load} /></td>
                  <td>{item.organization?.name || 'Global'}{item.sourceFeedback ? <p className="text-xs text-slate-500">Feedback: {item.sourceFeedback.title}</p> : null}</td>
                  <td>
                    <input className="input h-9 w-28" defaultValue={item.roadmapQuarter || ''} onBlur={async (e) => { if (e.target.value !== (item.roadmapQuarter || '')) { await roadmapApi.superadminUpdate(item.id, { roadmapQuarter: e.target.value }); await load(); } }} />
                  </td>
                  <td className="text-xs text-slate-500">
                    <p>{item._count?.feedbackItems || 0} feedback</p>
                    <p>{item._count?.comments || 0} comments</p>
                    <p>{item._count?.productUpdates || 0} releases</p>
                  </td>
                </tr>
              ))}
              {!items.length ? <tr><td colSpan={9} className="p-8 text-center text-slate-500">No roadmap items found</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4"><EyeOff className="mb-2 h-5 w-5 text-slate-500" /><b className="text-slate-950">INTERNAL</b><p>Vizibil doar pentru Superadmin și folosit pentru triere, scoring și planificare.</p></div>
          <div className="rounded-lg border border-slate-200 bg-white p-4"><CheckCircle2 className="mb-2 h-5 w-5 text-emerald-600" /><b className="text-slate-950">PUBLIC</b><p>Vizibil în roadmap-ul utilizatorilor și poate primi voturi.</p></div>
        </section>
      </div>
    </main>
  );
}

function StatusSelect({ item, onDone }: { item: any; onDone: () => Promise<void> }) {
  return <select className="input h-9 w-44" value={item.status} onChange={async (e) => { await roadmapApi.superadminUpdate(item.id, { status: e.target.value as any }); await onDone(); }}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>;
}

function VisibilitySelect({ item, onDone }: { item: any; onDone: () => Promise<void> }) {
  return <select className="input h-9 w-36" value={item.visibility} onChange={async (e) => { await roadmapApi.superadminUpdate(item.id, { visibility: e.target.value as any }); await onDone(); }}>{VISIBILITY.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}</select>;
}
