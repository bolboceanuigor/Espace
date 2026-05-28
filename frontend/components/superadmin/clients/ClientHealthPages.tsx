'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, HeartPulse, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { superadminClientHealthApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  EXCELLENT: 'Excelent',
  HEALTHY: 'Sanatos',
  NEEDS_ATTENTION: 'Necesita atentie',
  AT_RISK: 'In risc',
  CRITICAL: 'Critic',
  UNKNOWN: 'Necunoscut',
};

const dimensionLabels: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  PRODUCT_USAGE: 'Utilizare produs',
  SUBSCRIPTION: 'Abonament',
  SAAS_BILLING: 'Facturi SaaS',
  SUPPORT: 'Suport',
  DATA_QUALITY: 'Data Quality',
  SECURITY: 'Securitate',
  MONITORING: 'Monitoring',
  FOLLOW_UP: 'Follow-up',
  ENGAGEMENT: 'Engagement',
  PLATFORM_SERVICES: 'Servicii platforma',
  KNOWLEDGE_BASE: 'Knowledge Base',
};

function tone(status?: string) {
  if (status === 'EXCELLENT' || status === 'HEALTHY') return 'emerald';
  if (status === 'NEEDS_ATTENTION') return 'amber';
  if (status === 'AT_RISK' || status === 'CRITICAL') return 'red';
  return 'slate';
}

function Badge({ value, variant = 'slate' }: { value: string; variant?: string }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls[variant] || cls.slate}`}>{value}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const path = useLocalizedPath();
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href={path('/superadmin/client-health/dashboard')} className="rounded-md border border-slate-200 px-3 py-2">Dashboard</Link>
          <Link href={path('/superadmin/client-health/clients')} className="rounded-md border border-slate-200 px-3 py-2">Clienti</Link>
          <Link href={path('/superadmin/client-health/at-risk')} className="rounded-md border border-slate-200 px-3 py-2">At-risk</Link>
          <Link href={path('/superadmin/client-health/trends')} className="rounded-md border border-slate-200 px-3 py-2">Trends</Link>
        </nav>
      </div>
    </header>
  );
}

function Kpi({ icon, label, value, variant = 'slate' }: { icon: React.ReactNode; label: string; value: number; variant?: string }) {
  const cls = variant === 'red' ? 'bg-red-50 text-red-700' : variant === 'amber' ? 'bg-amber-50 text-amber-700' : variant === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${cls}`}>{icon}</div>
      <p className="text-2xl font-semibold text-slate-950">{value || 0}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ScoreRing({ score, status }: { score?: number; status?: string }) {
  const value = typeof score === 'number' ? score : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-24 w-24 place-items-center rounded-full border-8 border-emerald-100 bg-white">
        <span className="text-2xl font-bold text-slate-950">{value}</span>
      </div>
      <div>
        <Badge value={statusLabels[status || 'UNKNOWN'] || 'Necunoscut'} variant={tone(status)} />
        <p className="mt-2 text-sm text-slate-500">Health score 0-100</p>
      </div>
    </div>
  );
}

export function ClientHealthDashboardPage() {
  const path = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => setData((await superadminClientHealthApi.overview()).data), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const recalc = async () => {
    setLoading(true);
    await superadminClientHealthApi.recalculateAll();
    await load();
    setLoading(false);
  };
  const s = data?.summary || {};
  return (
    <Shell>
      <Header title="Client Health" subtitle="Monitorizeaza sanatatea clientilor APC si prioritizeaza interventiile." />
      <div className="flex justify-end">
        <button onClick={recalc} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><RefreshCw className="h-4 w-4" /> Recalculeaza tot</button>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Kpi icon={<CheckCircle2 />} label="Sanatosi" value={(s.excellent || 0) + (s.healthy || 0)} variant="emerald" />
        <Kpi icon={<AlertTriangle />} label="Necesita atentie" value={s.needsAttention || 0} variant="amber" />
        <Kpi icon={<ShieldAlert />} label="In risc" value={s.atRisk || 0} variant="red" />
        <Kpi icon={<ShieldAlert />} label="Critici" value={s.critical || 0} variant="red" />
        <Kpi icon={<Activity />} label="Fara score" value={s.unknown || 0} />
        <Kpi icon={<TrendingUp />} label="Trial ending soon" value={s.trialEndingSoon || 0} variant="amber" />
        <Kpi icon={<ClipboardList />} label="Facturi SaaS restante" value={s.overdueSaasInvoices || 0} variant="red" />
        <Kpi icon={<AlertTriangle />} label="Follow-up intarziat" value={s.overdueFollowUps || 0} variant="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="At-risk clients" empty="Nu exista clienti in risc.">
          {(data?.atRiskClients || []).map((item: any) => <ClientRow key={item.id} item={item} />)}
        </Panel>
        <Panel title="Recommended actions" empty="Nu exista actiuni recomandate.">
          {(data?.recommendedActions || []).map((item: any) => <ActionRow key={item.id} item={item} onDone={load} />)}
        </Panel>
      </div>
      <Link href={path('/superadmin/client-health/clients')} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">Vezi toti clientii <ArrowRight className="h-4 w-4" /></Link>
    </Shell>
  );
}

export function ClientHealthClientsPage({ mode = 'all' }: { mode?: 'all' | 'at-risk' }) {
  const [data, setData] = useState<any>({ items: [] });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(mode === 'at-risk' ? 'NEEDS_ATTENTION,AT_RISK,CRITICAL' : '');
  const load = useCallback(async () => setData((await superadminClientHealthApi.clients({ search: search || undefined, healthStatus: status || undefined })).data), [search, status]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return (
    <Shell>
      <Header title={mode === 'at-risk' ? 'Clienti in risc' : 'Client Health Clients'} subtitle="Lista operationala cu health score, riscuri si actiuni rapide." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cauta client, cod, contact..." className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Toate statusurile</option>
            <option value="EXCELLENT,HEALTHY">Sanatosi</option>
            <option value="NEEDS_ATTENTION">Necesita atentie</option>
            <option value="AT_RISK">In risc</option>
            <option value="CRITICAL">Critici</option>
          </select>
          <button onClick={load} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Filtreaza</button>
        </div>
        <HealthTable items={data.items || []} onDone={load} />
      </div>
    </Shell>
  );
}

function HealthTable({ items, onDone }: { items: any[]; onDone: () => void }) {
  const path = useLocalizedPath();
  if (!items.length) return <p className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Nu exista health score calculat.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Client</th><th>Stage</th><th>Health</th><th>Riscuri</th><th>Abonament</th><th>SaaS balance</th><th>Owner</th><th>Follow-up</th><th>Actiuni</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="p-3"><Link href={path(`/superadmin/client-health/clients/${item.id}`)} className="font-semibold text-slate-950 hover:text-emerald-700">{item.displayName}</Link><p className="text-xs text-slate-500">{item.associationCode || item.associationName || '-'}</p></td>
              <td>{item.lifecycleStage}</td>
              <td><Badge value={`${item.health?.overallScore ?? '-'} · ${statusLabels[item.health?.status || 'UNKNOWN']}`} variant={tone(item.health?.status)} /></td>
              <td className="max-w-xs text-xs text-slate-500">{(item.health?.riskReasons || []).slice(0, 3).map((reason: any) => reason.label || reason.key || reason).join(', ') || '-'}</td>
              <td>{item.subscription?.status || '-'}</td>
              <td>{Number(item.saasBalance || 0).toFixed(2)}</td>
              <td>{item.ownerUserId || '-'}</td>
              <td>{item.nextFollowUp?.dueAt ? new Date(item.nextFollowUp.dueAt).toLocaleDateString('ro-MD') : '-'}</td>
              <td className="space-x-2"><button onClick={async () => { await superadminClientHealthApi.recalculate(item.id); onDone(); }} className="text-emerald-700 hover:underline">Recalc</button><Link href={path(`/superadmin/clients/${item.id}`)} className="text-slate-700 hover:underline">Client</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClientHealthDetailPage({ id }: { id: string }) {
  const path = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => setData((await superadminClientHealthApi.detail(id)).data), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const recalc = async () => { await superadminClientHealthApi.recalculate(id); await load(); };
  const applyOverride = async () => {
    const reason = window.prompt('Motiv override health');
    if (!reason) return;
    await superadminClientHealthApi.override(id, { overrideStatus: 'AT_RISK', reason });
    await load();
  };
  const health = data?.health;
  return (
    <Shell>
      <Header title="Client Health Detail" subtitle="Scor, dimensiuni, riscuri si actiuni recomandate pentru client." />
      {!data ? <p className="text-sm text-slate-500">Se incarca health score...</p> : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{data.client?.displayName || data.client?.associationName}</h2>
                <p className="mt-1 text-sm text-slate-500">Ultimul calcul: {health?.calculatedAt ? new Date(health.calculatedAt).toLocaleString('ro-MD') : '-'}</p>
              </div>
              <ScoreRing score={health?.overallScore} status={health?.status} />
              <div className="flex flex-wrap gap-2">
                <button onClick={recalc} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Recalculeaza</button>
                <button onClick={applyOverride} className="rounded-md border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700">Override risc</button>
                <Link href={path(`/superadmin/clients/${id}`)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Client</Link>
              </div>
            </div>
            {data.override ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Override activ: {data.override.reason}</div> : null}
          </section>
          <div className="grid gap-4 lg:grid-cols-3">
            {(health?.dimensions || []).map((dimension: any) => (
              <article key={dimension.key} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">{dimensionLabels[dimension.key] || dimension.key}</h3><Badge value={`${dimension.score}`} variant={tone(dimension.status)} /></div>
                <p className="mt-3 text-sm text-slate-500">{dimension.reasons?.length ? dimension.reasons.join(', ') : 'Fara riscuri majore.'}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Risk reasons" empty="Nu exista motive de risc.">
              {(health?.riskReasons || []).map((reason: any) => <div key={reason.key} className="rounded-md border border-slate-200 p-3"><Badge value={reason.severity || 'NORMAL'} variant={reason.severity === 'URGENT' ? 'red' : 'amber'} /><p className="mt-2 font-semibold text-slate-950">{reason.label}</p><p className="text-sm text-slate-500">{reason.message}</p></div>)}
            </Panel>
            <Panel title="Recommended actions" empty="Nu exista actiuni recomandate.">
              {(data.actions || []).map((item: any) => <ActionRow key={item.id} item={item} onDone={load} />)}
            </Panel>
          </div>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">Trend</h2>
            {(data.trend || []).length < 2 ? <p className="mt-3 text-sm text-slate-500">Trendurile vor aparea dupa mai multe recalculari.</p> : <div className="mt-4 flex items-end gap-2">{data.trend.map((item: any) => <div key={item.id} title={`${item.overallScore}`} className="w-8 rounded-t bg-emerald-500" style={{ height: `${Math.max(8, item.overallScore)}px` }} />)}</div>}
          </section>
        </>
      )}
    </Shell>
  );
}

export function ClientHealthTrendsPage() {
  return (
    <Shell>
      <Header title="Health Trends" subtitle="Evolutia scorurilor va deveni relevanta dupa mai multe recalculari." />
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Trendurile vor aparea dupa mai multe recalculari.</section>
    </Shell>
  );
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{title}</h2><div className="mt-4 space-y-3">{hasChildren ? children : <p className="text-sm text-slate-500">{empty}</p>}</div></section>;
}

function ClientRow({ item }: { item: any }) {
  const path = useLocalizedPath();
  return (
    <Link href={path(`/superadmin/client-health/clients/${item.id}`)} className="block rounded-md border border-slate-200 p-3 hover:border-emerald-300">
      <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-950">{item.displayName}</p><Badge value={`${item.health?.overallScore ?? '-'}`} variant={tone(item.health?.status)} /></div>
      <p className="mt-1 text-sm text-slate-500">{item.health?.riskReasons?.[0]?.label || 'Health detail'}</p>
    </Link>
  );
}

function ActionRow({ item, onDone }: { item: any; onDone: () => void }) {
  const createTask = async () => { await superadminClientHealthApi.createTask(item.id); onDone(); };
  const createFollowUp = async () => { await superadminClientHealthApi.createFollowUp(item.id); onDone(); };
  const dismiss = async () => { const reason = window.prompt('Motiv dismiss') || undefined; await superadminClientHealthApi.dismissAction(item.id, reason); onDone(); };
  return (
    <article className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">{item.title}</p><Badge value={item.priority || 'NORMAL'} variant={item.priority === 'URGENT' || item.priority === 'HIGH' ? 'red' : 'slate'} /></div>
      <p className="mt-1 text-sm text-slate-500">{item.description}</p>
      <p className="mt-1 text-xs text-slate-400">{item.clientAccount?.displayName || ''}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <button onClick={createTask} className="rounded-md border border-slate-200 px-3 py-2 text-slate-700">Creeaza task</button>
        <button onClick={createFollowUp} className="rounded-md border border-slate-200 px-3 py-2 text-slate-700">Creeaza follow-up</button>
        <button onClick={dismiss} className="rounded-md border border-slate-200 px-3 py-2 text-slate-500">Dismiss</button>
      </div>
    </article>
  );
}
