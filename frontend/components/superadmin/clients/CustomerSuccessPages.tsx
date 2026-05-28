'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Flag, Kanban, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import { superadminCustomerSuccessApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Activ',
  ARCHIVED: 'Arhivat',
  OPEN: 'Deschisa',
  IN_PROGRESS: 'In lucru',
  WAITING_CLIENT: 'Asteapta client',
  WAITING_INTERNAL: 'Asteapta intern',
  COMPLETED: 'Finalizata',
  CANCELLED: 'Anulata',
  FAILED: 'Esuata',
  PENDING: 'Pending',
  SKIPPED: 'Skipped',
  BLOCKED: 'Blocat',
};

function tone(value?: string) {
  if (value === 'ACTIVE' || value === 'COMPLETED') return 'emerald';
  if (value === 'IN_PROGRESS' || value === 'WAITING_CLIENT' || value === 'WAITING_INTERNAL') return 'amber';
  if (value === 'FAILED' || value === 'BLOCKED' || value === 'URGENT') return 'red';
  if (value === 'OPEN' || value === 'HIGH') return 'blue';
  return 'slate';
}

function Badge({ value }: { value: string }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls[tone(value)]}`}>{statusLabels[value] || value}</span>;
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
          <Link href={path('/superadmin/customer-success')} className="rounded-md border border-slate-200 px-3 py-2">Dashboard</Link>
          <Link href={path('/superadmin/customer-success/playbooks')} className="rounded-md border border-slate-200 px-3 py-2">Playbooks</Link>
          <Link href={path('/superadmin/customer-success/interventions')} className="rounded-md border border-slate-200 px-3 py-2">Interventii</Link>
          <Link href={path('/superadmin/customer-success/recommendations')} className="rounded-md border border-slate-200 px-3 py-2">Recomandari</Link>
        </nav>
      </div>
    </header>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon}</div><p className="text-2xl font-semibold text-slate-950">{value || 0}</p><p className="text-sm text-slate-500">{label}</p></div>;
}

export function CustomerSuccessDashboardPage() {
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => setData((await superadminCustomerSuccessApi.dashboard()).data), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const s = data?.summary || {};
  return (
    <Shell>
      <Header title="Customer Success" subtitle="Gestioneaza interventiile, playbook-urile si actiunile recomandate pentru clienti." />
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Flag />} label="Interventii deschise" value={s.open} />
        <Kpi icon={<Kanban />} label="In lucru" value={s.inProgress} />
        <Kpi icon={<ShieldAlert />} label="Overdue" value={s.overdue} />
        <Kpi icon={<ClipboardList />} label="Playbook-uri active" value={s.playbooks} />
        <Kpi icon={<CheckCircle2 />} label="Finalizate luna aceasta" value={s.completedThisMonth} />
        <Kpi icon={<RefreshCw />} label="Actiuni recomandate" value={s.actions} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recommended interventions" empty="Nu exista recomandari de interventie.">
          {(data?.recommendedInterventions || []).map((item: any) => <RecommendationCard key={item.id} item={item} onDone={load} />)}
        </Panel>
        <Panel title="Active interventions" empty="Nu exista interventii active.">
          {(data?.activeInterventions || []).map((item: any) => <InterventionCard key={item.id} item={item} />)}
        </Panel>
      </div>
    </Shell>
  );
}

export function PlaybooksPage() {
  const path = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => setItems(((await superadminCustomerSuccessApi.playbooks()).data.items) || []), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return (
    <Shell>
      <Header title="Customer Success Playbooks" subtitle="Sabloane operationale pentru interventii manuale." />
      <div className="flex justify-end"><Link href={path('/superadmin/customer-success/playbooks/new')} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">New playbook</Link></div>
      <Panel title="Playbooks" empty="Nu exista playbook-uri.">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Name</th><th>Category</th><th>Status</th><th>Trigger</th><th>Steps</th><th>System</th><th>Usage</th><th>Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3 font-semibold">{item.name}</td><td>{item.category}</td><td><Badge value={item.status} /></td><td>{item.triggerType}</td><td>{item.steps?.length || 0}</td><td>{item.isSystem ? 'Da' : 'Nu'}</td><td>{item._count?.interventions || 0}</td><td><Link href={path(`/superadmin/customer-success/playbooks/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link></td></tr>)}</tbody></table></div>
      </Panel>
    </Shell>
  );
}

export function PlaybookDetailPage({ id }: { id: string }) {
  const path = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => setData((await superadminCustomerSuccessApi.playbook(id)).data), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const start = async () => {
    const clientAccountId = window.prompt('ClientAccount ID');
    if (!clientAccountId) return;
    const res = await superadminCustomerSuccessApi.startPlaybook(id, { clientAccountId });
    const interventionId = (res.data || res).intervention?.id;
    if (interventionId) window.location.href = path(`/superadmin/customer-success/interventions/${interventionId}/run`);
  };
  return (
    <Shell>
      <Header title="Playbook detail" subtitle="Vezi pasii si istoricul folosirii playbook-ului." />
      {!data ? <p className="text-sm text-slate-500">Se incarca...</p> : <>
        <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="text-xl font-semibold text-slate-950">{data.name}</h2><p className="mt-1 text-sm text-slate-500">{data.description}</p><div className="mt-3 flex flex-wrap gap-2"><Badge value={data.status} /><Badge value={data.defaultPriority} /><Badge value={data.category} /></div></div><button onClick={start} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><Play className="h-4 w-4" /> Start intervention</button></div></section>
        <Panel title="Steps" empty="Nu exista pasi.">{(data.steps || []).map((step: any) => <StepLine key={step.id} step={step} />)}</Panel>
        <Panel title="Recent interventions" empty="Nu exista interventii recente.">{(data.interventions || []).map((item: any) => <InterventionCard key={item.id} item={item} />)}</Panel>
      </>}
    </Shell>
  );
}

export function PlaybookFormPage() {
  const path = useLocalizedPath();
  const create = async () => {
    const name = window.prompt('Nume playbook');
    if (!name) return;
    const key = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const res = await superadminCustomerSuccessApi.createPlaybook({ key, name, description: name, category: 'OTHER', status: 'DRAFT', triggerType: 'MANUAL', steps: [{ sortOrder: 1, title: 'Verifica contextul', description: 'Primul pas operational.', stepType: 'CHECK', required: true }] });
    const id = (res.data || res).id;
    if (id) window.location.href = path(`/superadmin/customer-success/playbooks/${id}`);
  };
  return <Shell><Header title="New Playbook" subtitle="Creeaza un playbook operational intern." /><section className="rounded-lg border border-slate-200 bg-white p-8 text-center"><button onClick={create} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Creeaza playbook rapid</button></section></Shell>;
}

export function InterventionsPage({ clientId }: { clientId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => setItems(((await superadminCustomerSuccessApi.interventions({ clientAccountId: clientId })).data.items) || []), [clientId]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return <Shell><Header title="Interventii Customer Success" subtitle="Urmareste playbook-urile pornite pentru clienti." /><Panel title="Interventii" empty={clientId ? 'Nu exista interventii pentru acest client.' : 'Nu exista interventii active.'}>{items.map((item) => <InterventionCard key={item.id} item={item} />)}</Panel></Shell>;
}

export function InterventionRunPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => setData((await superadminCustomerSuccessApi.intervention(id)).data), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const complete = async () => {
    const outcomeNotes = window.prompt('Concluzie interventie') || '';
    await superadminCustomerSuccessApi.completeIntervention(id, { outcome: 'RESOLVED', outcomeNotes });
    await load();
  };
  return (
    <Shell>
      <Header title="Run Intervention" subtitle="Executa manual pasii playbook-ului si pastreaza trasabilitatea." />
      {!data ? <p className="text-sm text-slate-500">Se incarca interventia...</p> : <>
        <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-semibold text-slate-950">{data.intervention.title}</h2><p className="text-sm text-slate-500">{data.client.displayName} · {data.playbook.name}</p><div className="mt-3 flex gap-2"><Badge value={data.intervention.status} /><Badge value={data.intervention.priority} /><Badge value={`${data.progress.percent}%`} /></div></div><button onClick={complete} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Finalizeaza</button></div></section>
        <Panel title="Steps" empty="Nu exista pasi.">{(data.steps || []).map((step: any) => <RunnableStep key={step.id} interventionId={id} step={step} onDone={load} />)}</Panel>
        <Panel title="Timeline" empty="Nu exista evenimente.">{(data.events || []).map((event: any) => <div key={event.id} className="border-l-2 border-slate-200 pb-3 pl-4"><p className="font-semibold text-slate-950">{event.title}</p><p className="text-sm text-slate-500">{event.message}</p></div>)}</Panel>
      </>}
    </Shell>
  );
}

export function RecommendationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => setItems(((await superadminCustomerSuccessApi.recommendations()).data.items) || []), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return <Shell><Header title="Recommended interventions" subtitle="Recomandari generate din health score si risk reasons." /><Panel title="Recomandari" empty="Nu exista recomandari de interventie.">{items.map((item) => <RecommendationCard key={item.id} item={item} onDone={load} />)}</Panel></Shell>;
}

export function ClientSuccessPlanPage({ id }: { id: string }) {
  return <InterventionsPage clientId={id} />;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="mb-4 font-semibold text-slate-950">{title}</h2><div className="space-y-3">{has ? children : <p className="text-sm text-slate-500">{empty}</p>}</div></section>;
}

function StepLine({ step }: { step: any }) {
  return <div className="rounded-md border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-950">{step.sortOrder}. {step.title}</p><Badge value={step.stepType} /></div><p className="mt-1 text-sm text-slate-500">{step.description}</p></div>;
}

function InterventionCard({ item }: { item: any }) {
  const path = useLocalizedPath();
  return <Link href={path(`/superadmin/customer-success/interventions/${item.id}/run`)} className="block rounded-md border border-slate-200 p-3 hover:border-emerald-300"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">{item.title}</p><Badge value={item.status} /></div><p className="mt-1 text-sm text-slate-500">{item.clientAccount?.displayName || item.client?.displayName || '-'} · {item.playbook?.name || '-'}</p><p className="mt-2 text-xs text-slate-400">Progress: {item.progress?.percent || 0}%</p></Link>;
}

function RecommendationCard({ item, onDone }: { item: any; onDone: () => void }) {
  const start = async () => { await superadminCustomerSuccessApi.startRecommendation(item.id); await onDone(); };
  const dismiss = async () => { await superadminCustomerSuccessApi.dismissRecommendation(item.id); await onDone(); };
  return <article className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">{item.client?.displayName || item.clientAccount?.displayName}</p><Badge value={item.priority || 'NORMAL'} /></div><p className="mt-1 text-sm text-slate-500">{item.riskReason} · {item.recommendedPlaybook?.name}</p><p className="mt-1 text-xs text-slate-400">{item.message}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={item.alreadyHasActiveIntervention} onClick={start} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Start playbook</button><button onClick={dismiss} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Dismiss</button></div></article>;
}

function RunnableStep({ interventionId, step, onDone }: { interventionId: string; step: any; onDone: () => void }) {
  const complete = async () => { await superadminCustomerSuccessApi.completeStep(interventionId, step.id); await onDone(); };
  const task = async () => { await superadminCustomerSuccessApi.stepCreateTask(interventionId, step.id); await onDone(); };
  const follow = async () => { await superadminCustomerSuccessApi.stepCreateFollowUp(interventionId, step.id); await onDone(); };
  const note = async () => { const content = window.prompt('Nota interna'); if (!content) return; await superadminCustomerSuccessApi.stepAddNote(interventionId, step.id, { content }); await onDone(); };
  const skip = async () => { const reason = window.prompt('Motiv skip'); if (!reason) return; await superadminCustomerSuccessApi.skipStep(interventionId, step.id, reason); await onDone(); };
  return <article className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">{step.sortOrder}. {step.title}</p><Badge value={step.status} /></div><p className="mt-1 text-sm text-slate-500">{step.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><button onClick={complete} className="rounded-md bg-emerald-600 px-3 py-2 text-white">Complete</button><button onClick={task} className="rounded-md border border-slate-200 px-3 py-2">Task</button><button onClick={follow} className="rounded-md border border-slate-200 px-3 py-2">Follow-up</button><button onClick={note} className="rounded-md border border-slate-200 px-3 py-2">Note</button><button onClick={skip} className="rounded-md border border-slate-200 px-3 py-2 text-slate-500">Skip</button></div></article>;
}
