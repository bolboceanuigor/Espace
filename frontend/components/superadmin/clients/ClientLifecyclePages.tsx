'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bell, CalendarDays, ClipboardList, Clock, Kanban, ListChecks, MessageSquare, RefreshCw, ShieldAlert, UserRoundCheck } from 'lucide-react';
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
          <Link href={path('/superadmin/clients/my-work')} className="rounded-md border border-slate-200 px-3 py-2">Munca mea</Link>
          <Link href={path('/superadmin/clients/calendar')} className="rounded-md border border-slate-200 px-3 py-2">Calendar</Link>
          <Link href={path('/superadmin/clients/reminders')} className="rounded-md border border-slate-200 px-3 py-2">Reminders</Link>
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
        <QuickCard href={path('/superadmin/clients/my-work')} title="Munca mea" text="Agenda personala cu taskuri, follow-up-uri si reminders." />
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

export function ClientDetailPage({ id, tab }: { id: string; tab?: 'activity' | 'tasks' | 'follow-ups' | 'calendar' | 'notes' | 'onboarding' | 'subscription' | 'risk' }) {
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
        {['activity', 'tasks', 'follow-ups', 'calendar', 'notes', 'onboarding', 'subscription', 'risk'].map((item) => <Link key={item} href={path(`/superadmin/clients/${id}/${item}`)} className={`rounded-md px-3 py-2 ${tab === item ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>{item}</Link>)}
      </nav>
      {!tab ? <Overview data={data} onStage={async (stage) => { const reason = ['ACTIVE', 'SUSPENDED', 'CHURNED', 'CLOSED'].includes(stage) ? window.prompt('Motiv') || '' : ''; await superadminClientsApi.changeStage(id, { stage, reason }); await load(); }} /> : null}
      {tab === 'activity' ? <Timeline items={client.activities || []} /> : null}
      {tab === 'tasks' ? <Panel title="Taskuri"><InlineCreate value={taskTitle} onChange={setTaskTitle} onSubmit={addTask} placeholder="Titlu task..." /> <TaskList items={client.tasks || []} onComplete={async (taskId) => { await superadminClientsApi.completeTask(taskId); await load(); }} /></Panel> : null}
      {tab === 'follow-ups' ? <FollowUpsPanel clientId={id} /> : null}
      {tab === 'calendar' ? <ClientCalendarPanel clientId={id} /> : null}
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
  return <Shell><Header title="Taskuri clienti" subtitle="Gestioneaza taskurile interne pentru clienti si onboarding." /><Panel title="Taskuri">{items.length ? <TaskTable items={items} onComplete={async (id) => { await superadminClientsApi.completeTask(id); setItems(items.filter((item) => item.id !== id)); }} /> : <Empty title="Nu exista taskuri." />}</Panel></Shell>;
}

export function ClientTaskCreatePage() {
  const path = useLocalizedPath();
  const [form, setForm] = useState({ clientAccountId: '', title: '', category: 'GENERAL', priority: 'NORMAL', dueAt: '', reminderAt: '' });
  const submit = async () => {
    if (!form.clientAccountId || !form.title.trim()) return;
    const res = await superadminClientsApi.createGlobalTask({ ...form, dueAt: form.dueAt || undefined, reminderAt: form.reminderAt || undefined });
    const task = res.data || res;
    window.location.href = path(`/superadmin/clients/tasks/${task.id}`);
  };
  return <Shell><Header title="Task nou" subtitle="Creeaza un task intern legat de un client." /><Panel title="Detalii task"><div className="grid gap-3 md:grid-cols-2"><Field label="ClientAccount ID" value={form.clientAccountId} onChange={(v) => setForm({ ...form, clientAccountId: v })} /><Field label="Titlu" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><SelectField label="Categorie" value={form.category} options={['GENERAL','CONTACT','ONBOARDING','DATA_IMPORT','BILLING_SETUP','SUBSCRIPTION','SAAS_INVOICE','SUPPORT','SECURITY','BACKUP','LEGAL','PLATFORM_SERVICE','FOLLOW_UP']} onChange={(v) => setForm({ ...form, category: v })} /><SelectField label="Prioritate" value={form.priority} options={['LOW','NORMAL','HIGH','URGENT']} onChange={(v) => setForm({ ...form, priority: v })} /><Field label="Due date" type="datetime-local" value={form.dueAt} onChange={(v) => setForm({ ...form, dueAt: v })} /><Field label="Reminder" type="datetime-local" value={form.reminderAt} onChange={(v) => setForm({ ...form, reminderAt: v })} /></div><button onClick={submit} className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Creeaza task</button></Panel></Shell>;
}

export function ClientTaskDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<any>(null);
  const [newDue, setNewDue] = useState('');
  const load = useCallback(async () => setItem((await superadminClientsApi.getTask(id)).data || {}), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  if (!item) return <Shell><p className="text-sm text-slate-500">Se incarca taskul...</p></Shell>;
  return <Shell><Header title={item.title} subtitle="Detalii task CRM intern." /><div className="grid gap-4 lg:grid-cols-3"><Panel title="Task"><Info label="Status" value={item.status} /><Info label="Prioritate" value={item.priority} /><Info label="Categorie" value={item.category} /><Info label="Due" value={fmt(item.dueAt)} /><Info label="Reminder" value={fmt(item.reminderAt)} /></Panel><Panel title="Client"><Info label="Client" value={item.clientAccount?.displayName} /><Info label="Asociatie" value={item.clientAccount?.associationName} /><Link href={`/superadmin/clients/${item.clientAccountId}`} className="text-sm font-semibold text-emerald-700">Deschide client</Link></Panel><Panel title="Actiuni"><div className="space-y-2"><button onClick={async () => { await superadminClientsApi.startTask(id); await load(); }} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">Marcheaza in lucru</button><button onClick={async () => { await superadminClientsApi.completeTask(id); await load(); }} className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Completeaza</button><input type="datetime-local" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /><button onClick={async () => { if (newDue) { await superadminClientsApi.rescheduleTask(id, { dueAt: newDue }); await load(); } }} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">Reprogrameaza</button></div></Panel></div></Shell>;
}

export function ClientFollowUpsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { superadminClientsApi.followUps().then((res) => setItems((res.data || res).items || [])).catch(() => undefined); }, []);
  return <Shell><Header title="Follow-up-uri" subtitle="Urmareste clientii care trebuie contactati sau verificati." /><Panel title="Follow-up-uri">{items.length ? <FollowUpTable items={items} onDone={async (id) => { await superadminClientsApi.doneFollowUp(id); setItems(items.filter((entry) => entry.id !== id)); }} /> : <Empty title="Nu exista follow-up-uri." />}</Panel></Shell>;
}

export function ClientFollowUpDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<any>(null);
  const [newDue, setNewDue] = useState('');
  const load = useCallback(async () => setItem((await superadminClientsApi.getFollowUp(id)).data || {}), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  if (!item) return <Shell><p className="text-sm text-slate-500">Se incarca follow-up-ul...</p></Shell>;
  return <Shell><Header title={item.title} subtitle="Detalii follow-up client." /><div className="grid gap-4 lg:grid-cols-3"><Panel title="Follow-up"><Info label="Status" value={item.status} /><Info label="Prioritate" value={item.priority} /><Info label="Due" value={fmt(item.dueAt)} /><Info label="Reminder" value={fmt(item.reminderAt)} /></Panel><Panel title="Client"><Info label="Client" value={item.clientAccount?.displayName} /><Info label="Contact" value={item.clientAccount?.contactName} /><Link href={`/superadmin/clients/${item.clientAccountId}`} className="text-sm font-semibold text-emerald-700">Deschide client</Link></Panel><Panel title="Actiuni"><button onClick={async () => { await superadminClientsApi.doneFollowUp(id); await load(); }} className="mb-2 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Mark done</button><input type="datetime-local" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /><button onClick={async () => { if (newDue) { await superadminClientsApi.rescheduleFollowUp(id, { dueAt: newDue }); await load(); } }} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">Reprogrameaza</button></Panel></div></Shell>;
}

export function ClientMyWorkPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { superadminClientsApi.myWork().then((res) => setData(res.data || res)).catch(() => setData({ summary: {}, overdue: [], today: [], upcoming: [] })); }, []);
  const summary = data?.summary || {};
  return <Shell><Header title="Munca mea" subtitle="Taskurile, follow-up-urile si reminder-ele asignate tie." /><div className="grid gap-3 md:grid-cols-4"><Kpi icon={<ClipboardList />} label="Taskuri deschise" value={summary.openTasks || 0} /><Kpi icon={<Clock />} label="Taskuri intarziate" value={summary.overdueTasks || 0} tone="amber" /><Kpi icon={<CalendarDays />} label="Follow-up-uri azi" value={summary.followUpsToday || 0} /><Kpi icon={<Bell />} label="Reminder-e due" value={summary.dueReminders || 0} tone="amber" /></div><AgendaSection title="Intarziate" items={data?.overdue || []} /><AgendaSection title="Azi" items={data?.today || []} /><AgendaSection title="Urmatoarele 7 zile" items={data?.upcoming || []} /></Shell>;
}

export function ClientCalendarPage({ view = 'agenda', clientId }: { view?: 'agenda' | 'day' | 'week' | 'month'; clientId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => {
    const api = clientId ? superadminClientsApi.clientCalendar(clientId, { view }) : view === 'day' ? superadminClientsApi.calendarDay() : view === 'week' ? superadminClientsApi.calendarWeek() : view === 'month' ? superadminClientsApi.calendarMonth() : superadminClientsApi.calendar({ view });
    const res = await api;
    setItems((res.data || res).items || []);
  }, [clientId, view]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return <Shell><Header title="Calendar CRM" subtitle="Vezi taskurile, follow-up-urile si reminder-ele intr-un calendar operational." /><Panel title={view === 'month' ? 'Luna' : view === 'week' ? 'Saptamana' : view === 'day' ? 'Zi' : 'Agenda'}>{items.length ? <CalendarList items={items} /> : <Empty title="Nu exista activitati in perioada selectata." />}</Panel></Shell>;
}

export function ClientRemindersPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => setItems(((await superadminClientsApi.reminders()).data || {}).items || []), []);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return <Shell><Header title="Reminder Center" subtitle="Vezi reminder-ele active pentru clienti, taskuri si follow-up-uri." /><Panel title="Reminder-e">{items.length ? <ReminderTable items={items} onComplete={async (id) => { await superadminClientsApi.completeReminder(id); await load(); }} onDismiss={async (id) => { await superadminClientsApi.dismissReminder(id); await load(); }} /> : <Empty title="Nu exista reminder-e active." />}</Panel></Shell>;
}

export function ClientReminderDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<any>(null);
  const [snooze, setSnooze] = useState('');
  const load = useCallback(async () => setItem((await superadminClientsApi.getReminder(id)).data || {}), [id]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  if (!item) return <Shell><p className="text-sm text-slate-500">Se incarca reminder-ul...</p></Shell>;
  return <Shell><Header title={item.title} subtitle="Detalii reminder CRM." /><div className="grid gap-4 lg:grid-cols-3"><Panel title="Reminder"><Info label="Status" value={item.status} /><Info label="Prioritate" value={item.priority} /><Info label="Remind at" value={fmt(item.remindAt)} /><Info label="Snoozed until" value={fmt(item.snoozedUntil)} /></Panel><Panel title="Client"><Info label="Client" value={item.clientAccount?.displayName} /><Info label="Mesaj" value={item.message} /></Panel><Panel title="Actiuni"><button onClick={async () => { await superadminClientsApi.completeReminder(id); await load(); }} className="mb-2 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Completeaza</button><input type="datetime-local" value={snooze} onChange={(e) => setSnooze(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /><button onClick={async () => { if (snooze) { await superadminClientsApi.snoozeReminder(id, snooze); await load(); } }} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">Snooze</button><button onClick={async () => { await superadminClientsApi.dismissReminder(id); await load(); }} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">Dismiss</button></Panel></div></Shell>;
}

function FollowUpsPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { superadminClientsApi.clientFollowUps(clientId).then((res) => setItems((res.data || res).items || [])).catch(() => undefined); }, [clientId]);
  return <Panel title="Follow-up-uri client">{items.length ? <FollowUpTable items={items} onDone={async (id) => { await superadminClientsApi.doneFollowUp(id); setItems(items.filter((item) => item.id !== id)); }} /> : <Empty title="Nu exista follow-up-uri programate." />}</Panel>;
}

function ClientCalendarPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { superadminClientsApi.clientCalendar(clientId).then((res) => setItems((res.data || res).items || [])).catch(() => undefined); }, [clientId]);
  return <Panel title="Agenda client">{items.length ? <CalendarList items={items} /> : <Empty title="Nu exista activitati pentru acest client." />}</Panel>;
}

function TaskTable({ items, onComplete }: { items: any[]; onComplete: (id: string) => void }) {
  const path = useLocalizedPath();
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Task</th><th>Client</th><th>Categorie</th><th>Prioritate</th><th>Status</th><th>Due</th><th>Actiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3 font-semibold text-slate-950">{item.title}</td><td>{item.clientAccount?.displayName || item.clientAccountId || '-'}</td><td>{item.category || 'GENERAL'}</td><td><Badge value={item.priority || 'NORMAL'} tone={item.priority === 'URGENT' || item.priority === 'HIGH' ? 'red' : 'slate'} /></td><td>{item.status}</td><td>{fmt(item.dueAt)}</td><td className="space-x-2"><Link href={path(`/superadmin/clients/tasks/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link>{item.status !== 'COMPLETED' ? <button onClick={() => onComplete(item.id)} className="text-slate-600 hover:underline">Completeaza</button> : null}</td></tr>)}</tbody></table></div>;
}

function FollowUpTable({ items, onDone }: { items: any[]; onDone: (id: string) => void }) {
  const path = useLocalizedPath();
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Follow-up</th><th>Client</th><th>Prioritate</th><th>Status</th><th>Due</th><th>Actiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3 font-semibold text-slate-950">{item.title}</td><td>{item.clientAccount?.displayName || item.clientAccountId || '-'}</td><td><Badge value={item.priority || 'NORMAL'} tone={item.priority === 'URGENT' || item.priority === 'HIGH' ? 'red' : 'slate'} /></td><td>{item.status}</td><td>{fmt(item.dueAt)}</td><td className="space-x-2"><Link href={path(`/superadmin/clients/follow-ups/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link>{item.status === 'OPEN' ? <button onClick={() => onDone(item.id)} className="text-slate-600 hover:underline">Done</button> : null}</td></tr>)}</tbody></table></div>;
}

function ReminderTable({ items, onComplete, onDismiss }: { items: any[]; onComplete: (id: string) => void; onDismiss: (id: string) => void }) {
  const path = useLocalizedPath();
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Reminder</th><th>Client</th><th>Status</th><th>Prioritate</th><th>Remind at</th><th>Actiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3 font-semibold text-slate-950">{item.title}</td><td>{item.clientAccount?.displayName || item.clientAccountId || '-'}</td><td>{item.status}</td><td>{item.priority}</td><td>{fmt(item.snoozedUntil || item.remindAt)}</td><td className="space-x-2"><Link href={path(`/superadmin/clients/reminders/${item.id}`)} className="text-emerald-700 hover:underline">Deschide</Link><button onClick={() => onComplete(item.id)} className="text-slate-600 hover:underline">Completeaza</button><button onClick={() => onDismiss(item.id)} className="text-slate-600 hover:underline">Dismiss</button></td></tr>)}</tbody></table></div>;
}

function CalendarList({ items }: { items: any[] }) {
  const path = useLocalizedPath();
  return <div className="space-y-2">{items.map((item) => <Link key={item.id} href={path(item.url || '/superadmin/clients/calendar')} className="flex items-center justify-between rounded-md border border-slate-200 p-3 hover:border-emerald-300"><div><p className="text-sm font-semibold text-slate-950">{item.title}</p><p className="text-xs text-slate-500">{item.type} · {item.client?.displayName || 'Platforma'} · {fmt(item.startAt)}</p></div><Badge value={item.priority || 'NORMAL'} tone={item.priority === 'URGENT' || item.priority === 'HIGH' ? 'red' : 'slate'} /></Link>)}</div>;
}

function AgendaSection({ title, items }: { title: string; items: any[] }) {
  return <Panel title={title}>{items.length ? <CalendarList items={items} /> : <Empty title="Nu exista activitati in aceasta sectiune." />}</Panel>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-400">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function ClientReportsPage() {
  return <ClientsDashboardPage />;
}

function Empty({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{title}</div>;
}
