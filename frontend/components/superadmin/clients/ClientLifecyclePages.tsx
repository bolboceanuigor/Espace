'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ClipboardList, Clock, Kanban, ListChecks, MessageSquare, RefreshCw, ShieldAlert, UserRoundCheck } from 'lucide-react';
import { superadminClientsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const stages = ['NEW_REQUEST', 'CONTACTED', 'QUALIFIED', 'PREPARING_ONBOARDING', 'ONBOARDING', 'READY_TO_ACTIVATE', 'ACTIVE', 'AT_RISK', 'SUSPENDED', 'CHURNED', 'CLOSED'];
const stageLabels: Record<string, string> = {
  NEW_REQUEST: 'Cerere noua',
  CONTACTED: 'Contactat',
  QUALIFIED: 'Calificat',
  PREPARING_ONBOARDING: 'Pregatire onboarding',
  ONBOARDING: 'In onboarding',
  READY_TO_ACTIVATE: 'Gata de activare',
  ACTIVE: 'Activ',
  AT_RISK: 'In risc',
  SUSPENDED: 'Suspendat',
  CHURNED: 'Churn',
  CLOSED: 'Inchis',
};
const priorityLabels: Record<string, string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' };
const riskLabels: Record<string, string> = { NONE: 'Fara risc', LOW: 'Low', MEDIUM: 'Mediu', HIGH: 'High', CRITICAL: 'Critic' };

function fmt(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ value, tone = 'slate' }: { value: string; tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[tone]}`}>{value}</span>;
}

function riskTone(value?: string): 'slate' | 'emerald' | 'amber' | 'red' {
  if (value === 'CRITICAL' || value === 'HIGH') return 'red';
  if (value === 'MEDIUM') return 'amber';
  if (value === 'LOW') return 'emerald';
  return 'slate';
}

function stageTone(value?: string): 'slate' | 'emerald' | 'amber' | 'red' | 'blue' {
  if (value === 'ACTIVE') return 'emerald';
  if (value === 'AT_RISK' || value === 'ONBOARDING') return 'amber';
  if (value === 'SUSPENDED' || value === 'CHURNED') return 'red';
  if (value === 'NEW_REQUEST' || value === 'READY_TO_ACTIVATE') return 'blue';
  return 'slate';
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
          <Link href={path('/superadmin/clients/pipeline')} className="rounded-md border border-slate-200 px-3 py-2">Pipeline</Link>
          <Link href={path('/superadmin/clients/list')} className="rounded-md border border-slate-200 px-3 py-2">Lista</Link>
          <Link href={path('/superadmin/clients/tasks')} className="rounded-md border border-slate-200 px-3 py-2">Taskuri</Link>
          <Link href={path('/superadmin/clients/follow-ups')} className="rounded-md border border-slate-200 px-3 py-2">Follow-ups</Link>
        </nav>
      </div>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

export function ClientsDashboardPage() {
  const path = useLocalizedPath();
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { superadminClientsApi.stats().then((res) => setStats(res.data || res)).catch(() => setStats({})); }, []);
  const byStage = stats?.byStage || {};
  return (
    <Shell>
      <Header title="Client Lifecycle" subtitle="Controleaza traseul clientilor de la cerere de acces pana la client activ." />
      <div className="grid gap-3 md:grid-cols-5">
        <Kpi icon={<Kanban />} label="Cereri noi" value={byStage.NEW_REQUEST || 0} />
        <Kpi icon={<UserRoundCheck />} label="In onboarding" value={byStage.ONBOARDING || 0} />
        <Kpi icon={<ListChecks />} label="Clienti activi" value={byStage.ACTIVE || 0} />
        <Kpi icon={<ShieldAlert />} label="In risc" value={stats?.atRisk || 0} tone="red" />
        <Kpi icon={<Clock />} label="Follow-up intarziat" value={stats?.overdueFollowUps || 0} tone="amber" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <QuickCard href={path('/superadmin/clients/pipeline')} title="Client Pipeline" text="Vezi clientii grupati pe etapa CRM." />
        <QuickCard href={path('/superadmin/clients/tasks')} title="Taskuri client" text="Urmareste taskurile deschise si intarziate." />
        <QuickCard href={path('/superadmin/clients/follow-ups')} title="Follow-ups" text="Vezi contactele programate si restante." />
      </div>
    </Shell>
  );
}

function Kpi({ icon, label, value, tone = 'slate' }: { icon: React.ReactNode; label: string; value: number; tone?: 'slate' | 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-700 bg-red-50' : tone === 'amber' ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-100';
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${color}`}>{icon}</div><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="text-sm text-slate-500">{label}</p></div>;
}

function QuickCard({ href, title, text }: { href: string; title: string; text: string }) {
  return <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300"><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Deschide <ArrowRight className="h-4 w-4" /></span></Link>;
}

export function ClientsPipelinePage() {
  const path = useLocalizedPath();
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const res = await superadminClientsApi.pipeline();
    setColumns((res.data || res).columns || []);
    setLoading(false);
  };
  useEffect(() => { load().catch(() => setLoading(false)); }, []);
  const move = async (id: string, stage: string) => {
    const reason = ['ACTIVE', 'SUSPENDED', 'CHURNED', 'CLOSED'].includes(stage) ? window.prompt('Motiv schimbare etapa') : '';
    if (['ACTIVE', 'SUSPENDED', 'CHURNED', 'CLOSED'].includes(stage) && !reason) return;
    await superadminClientsApi.changeStage(id, { stage, reason });
    await load();
  };
  return (
    <Shell>
      <Header title="Client Pipeline" subtitle="Urmareste asociatiile de la cerere de acces pana la client activ." />
      {loading ? <p className="text-sm text-slate-500">Se incarca pipeline-ul...</p> : null}
      <div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {columns.map((column) => (
          <section key={column.stage} className="min-h-60 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-950">{column.label}</h2>
              <Badge value={String(column.items?.length || 0)} />
            </div>
            <div className="mt-3 space-y-3">
              {(column.items || []).map((client: any) => (
                <article key={client.id} className="rounded-lg border border-slate-200 p-3">
                  <Link href={path(`/superadmin/clients/${client.id}`)} className="font-semibold text-slate-950 hover:text-emerald-700">{client.displayName}</Link>
                  <p className="mt-1 text-xs text-slate-500">{client.contactName || 'Contact nesetat'} · {client.contactPhone || client.contactEmail || '-'}</p>
                  <div className="mt-3 flex flex-wrap gap-1"><Badge value={priorityLabels[client.priority] || client.priority} tone={client.priority === 'URGENT' || client.priority === 'HIGH' ? 'red' : 'slate'} /><Badge value={riskLabels[client.riskLevel] || client.riskLevel} tone={riskTone(client.riskLevel)} /></div>
                  <p className="mt-2 text-xs text-slate-500">Follow-up: {fmt(client.nextFollowUpAt)}</p>
                  <select onChange={(e) => e.target.value && move(client.id, e.target.value)} defaultValue="" className="mt-3 h-9 w-full rounded-md border border-slate-200 px-2 text-xs">
                    <option value="">Muta in etapa...</option>
                    {stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
                  </select>
                </article>
              ))}
              {!column.items?.length ? <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Nu exista clienti in aceasta etapa.</p> : null}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

export function ClientsListPage() {
  const path = useLocalizedPath();
  const [data, setData] = useState<any>({ items: [] });
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const load = useCallback(async () => setData((await superadminClientsApi.list({ search: search || undefined, stage: stage || undefined })).data || {}), [search, stage]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  const items = data.items || [];
  return (
    <Shell>
      <Header title="Clienti" subtitle="Lista operationala pentru client lifecycle." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cauta client, contact, cod..." className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Toate etapele</option>{stages.map((item) => <option key={item} value={item}>{stageLabels[item]}</option>)}</select>
          <button onClick={load} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Filtreaza</button>
        </div>
        {!items.length ? <Empty title="Nu exista clienti inregistrati." /> : <ClientsTable items={items} />}
      </div>
    </Shell>
  );
}

function ClientsTable({ items }: { items: any[] }) {
  const path = useLocalizedPath();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Client</th><th>Cod</th><th>Contact</th><th>Etapa</th><th>Status</th><th>Prioritate</th><th>Risc</th><th>Owner</th><th>Follow-up</th><th>Actiuni</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="p-3 font-semibold text-slate-950">{item.displayName}</td>
              <td>{item.associationCode || '-'}</td>
              <td>{item.contactName || '-'}<br /><span className="text-xs text-slate-500">{item.contactPhone || item.contactEmail || '-'}</span></td>
              <td><Badge value={stageLabels[item.lifecycleStage] || item.lifecycleStage} tone={stageTone(item.lifecycleStage)} /></td>
              <td>{item.status}</td>
              <td><Badge value={priorityLabels[item.priority] || item.priority} tone={item.priority === 'URGENT' || item.priority === 'HIGH' ? 'red' : 'slate'} /></td>
              <td><Badge value={riskLabels[item.riskLevel] || item.riskLevel} tone={riskTone(item.riskLevel)} /></td>
              <td>{item.owner?.fullName || item.owner?.email || '-'}</td>
              <td>{fmt(item.nextFollowUpAt)}</td>
              <td><Link href={path(`/superadmin/clients/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClientDetailPage({ id, tab }: { id: string; tab?: 'activity' | 'tasks' | 'notes' | 'onboarding' | 'subscription' | 'risk' }) {
  const path = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [followTitle, setFollowTitle] = useState('');
  const [followDue, setFollowDue] = useState('');
  const load = useCallback(async () => setData((await superadminClientsApi.get(id)).data || {}), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  if (!data) return <Shell><p className="text-sm text-slate-500">Se incarca clientul...</p></Shell>;
  const client = data.client;
  const addNote = async () => { if (!note.trim()) return; await superadminClientsApi.createNote(id, { note }); setNote(''); await load(); };
  const addTask = async () => { if (!taskTitle.trim()) return; await superadminClientsApi.createTask(id, { title: taskTitle }); setTaskTitle(''); await load(); };
  const addFollow = async () => { if (!followTitle.trim() || !followDue) return; await superadminClientsApi.createFollowUp(id, { title: followTitle, dueAt: followDue }); setFollowTitle(''); setFollowDue(''); await load(); };
  return (
    <Shell>
      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><h1 className="text-2xl font-semibold text-slate-950">{client.displayName}</h1><p className="mt-1 text-sm text-slate-500">{client.contactName || '-'} · {client.contactPhone || client.contactEmail || '-'}</p><div className="mt-3 flex flex-wrap gap-2"><Badge value={stageLabels[client.lifecycleStage] || client.lifecycleStage} tone={stageTone(client.lifecycleStage)} /><Badge value={client.status} /><Badge value={priorityLabels[client.priority] || client.priority} /><Badge value={riskLabels[client.riskLevel] || client.riskLevel} tone={riskTone(client.riskLevel)} /></div></div>
          <div className="flex flex-wrap gap-2">
            {client.associationId ? <Link href={path(`/superadmin/client-navigator/${client.associationId}`)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Client Navigator</Link> : null}
            <button onClick={async () => { await superadminClientsApi.recalculateRisk(id); await load(); }} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Recalculeaza risc</button>
          </div>
        </div>
      </header>
      <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        {['activity', 'tasks', 'notes', 'onboarding', 'subscription', 'risk'].map((item) => <Link key={item} href={path(`/superadmin/clients/${id}/${item}`)} className={`rounded-md px-3 py-2 ${tab === item ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>{item}</Link>)}
      </nav>
      {!tab ? <Overview data={data} onStage={async (stage) => { const reason = ['ACTIVE', 'SUSPENDED', 'CHURNED', 'CLOSED'].includes(stage) ? window.prompt('Motiv') || '' : ''; await superadminClientsApi.changeStage(id, { stage, reason }); await load(); }} /> : null}
      {tab === 'activity' ? <Timeline items={client.activities || []} /> : null}
      {tab === 'tasks' ? <Panel title="Taskuri"><InlineCreate value={taskTitle} onChange={setTaskTitle} onSubmit={addTask} placeholder="Titlu task..." /> <TaskList items={client.tasks || []} onComplete={async (taskId) => { await superadminClientsApi.completeTask(taskId); await load(); }} /></Panel> : null}
      {tab === 'notes' ? <Panel title="Note interne"><textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Adauga nota interna..." /><button onClick={addNote} className="mt-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Adauga nota</button><NoteList items={client.notes || []} /></Panel> : null}
      {tab === 'onboarding' ? <OnboardingTab id={id} /> : null}
      {tab === 'subscription' ? <SubscriptionTab data={data} /> : null}
      {tab === 'risk' ? <RiskTab data={data} /> : null}
      <Panel title="Follow-up rapid"><div className="grid gap-2 md:grid-cols-[1fr_180px_auto]"><input value={followTitle} onChange={(e) => setFollowTitle(e.target.value)} placeholder="Titlu follow-up" className="h-10 rounded-md border border-slate-200 px-3 text-sm" /><input type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" /><button onClick={addFollow} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Seteaza</button></div></Panel>
    </Shell>
  );
}

function Overview({ data, onStage }: { data: any; onStage: (stage: string) => void }) {
  const client = data.client;
  return <div className="grid gap-4 lg:grid-cols-3"><Panel title="Contact"><Info label="Contact" value={client.contactName} /><Info label="Telefon" value={client.contactPhone} /><Info label="Email" value={client.contactEmail} /><Info label="Adresa" value={client.address} /></Panel><Panel title="Asociatie"><Info label="Nume" value={client.associationName} /><Info label="Cod" value={client.associationCode} /><Info label="Apartamente" value={client.apartmentsCount} /><Info label="Association ID" value={client.associationId} /></Panel><Panel title="Actiuni"><select onChange={(e) => e.target.value && onStage(e.target.value)} defaultValue="" className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option value="">Muta etapa...</option>{stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select><p className="mt-3 text-sm text-slate-500">Taskuri deschise: {data.tasksSummary?.open || 0}. Follow-up-uri intarziate: {data.followUpsSummary?.overdue || 0}.</p></Panel></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="mb-4 font-semibold text-slate-950">{title}</h2>{children}</section>;
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="mb-3"><p className="text-xs uppercase text-slate-400">{label}</p><p className="text-sm font-medium text-slate-800">{value || '-'}</p></div>;
}

function Timeline({ items }: { items: any[] }) {
  return <Panel title="Activity timeline">{items.length ? items.map((item) => <div key={item.id} className="border-l-2 border-slate-200 pb-4 pl-4"><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.message}</p><p className="text-xs text-slate-400">{fmt(item.createdAt)}</p></div>) : <Empty title="Nu exista activitate." />}</Panel>;
}

function TaskList({ items, onComplete }: { items: any[]; onComplete: (id: string) => void }) {
  return <div className="mt-4 space-y-2">{items.length ? items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-xs text-slate-500">{item.status} · {fmt(item.dueAt)}</p></div>{item.status !== 'COMPLETED' ? <button onClick={() => onComplete(item.id)} className="rounded-md border border-slate-200 px-3 py-1 text-xs">Completeaza</button> : null}</div>) : <Empty title="Nu exista taskuri pentru acest client." />}</div>;
}

function NoteList({ items }: { items: any[] }) {
  return <div className="mt-4 space-y-2">{items.length ? items.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><p className="text-sm text-slate-700">{item.note}</p><p className="mt-2 text-xs text-slate-400">{fmt(item.createdAt)} {item.isPinned ? '· pinned' : ''}</p></div>) : <Empty title="Nu exista note interne." />}</div>;
}

function InlineCreate({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (value: string) => void; onSubmit: () => void; placeholder: string }) {
  return <div className="grid gap-2 md:grid-cols-[1fr_auto]"><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 rounded-md border border-slate-200 px-3 text-sm" /><button onClick={onSubmit} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Adauga</button></div>;
}

function OnboardingTab({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { superadminClientsApi.onboarding(id).then((res) => setData(res.data || res)).catch(() => setData({ steps: [] })); }, [id]);
  return <Panel title="Onboarding">{(data?.steps || []).map((step: any) => <div key={step.key} className="mb-2 flex items-center justify-between rounded-md border border-slate-200 p-3"><span className="text-sm font-medium">{step.title}</span><Badge value={step.completed ? 'Trecut' : 'Necompletat'} tone={step.completed ? 'emerald' : 'slate'} /></div>)}</Panel>;
}

function SubscriptionTab({ data }: { data: any }) {
  const subscription = data.subscription;
  const billing = data.saasBilling;
  return <Panel title="Abonament si facturi SaaS"><Info label="Plan" value={subscription?.plan?.name} /><Info label="Status abonament" value={subscription?.status} /><Info label="Total emis" value={billing?._sum?.totalAmount} /><Info label="Sold restant" value={billing?._sum?.balanceAmount} /></Panel>;
}

function RiskTab({ data }: { data: any }) {
  return <Panel title="Risc client">{data.riskReasons?.length ? data.riskReasons.map((item: any) => <div key={item.key} className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">{item.label}</p><p className="text-xs text-amber-700">Score +{item.score}</p></div>) : <Empty title="Nu exista riscuri calculate." />}</Panel>;
}

export function ClientTasksPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { superadminClientsApi.tasks().then((res) => setItems((res.data || res).items || [])).catch(() => undefined); }, []);
  return <Shell><Header title="Taskuri clienti" subtitle="Toate taskurile din pipeline." /><Panel title="Taskuri">{items.length ? <TaskList items={items} onComplete={async (id) => { await superadminClientsApi.completeTask(id); setItems(items.filter((item) => item.id !== id)); }} /> : <Empty title="Nu exista taskuri pentru clienti." />}</Panel></Shell>;
}

export function ClientFollowUpsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { superadminClientsApi.followUps().then((res) => setItems((res.data || res).items || [])).catch(() => undefined); }, []);
  return <Shell><Header title="Follow-ups clienti" subtitle="Contacte programate, intarziate si upcoming." /><Panel title="Follow-ups">{items.length ? items.map((item) => <div key={item.id} className="mb-2 flex items-center justify-between rounded-md border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-xs text-slate-500">{fmt(item.dueAt)} · {item.status}</p></div><button onClick={async () => { await superadminClientsApi.doneFollowUp(item.id); setItems(items.filter((entry) => entry.id !== item.id)); }} className="rounded-md border border-slate-200 px-3 py-1 text-xs">Done</button></div>) : <Empty title="Nu exista follow-up-uri programate." />}</Panel></Shell>;
}

export function ClientReportsPage() {
  return <ClientsDashboardPage />;
}

function Empty({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{title}</div>;
}
