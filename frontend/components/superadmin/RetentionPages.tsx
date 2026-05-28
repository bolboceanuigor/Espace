'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks, RefreshCw, ShieldAlert, TrendingDown } from 'lucide-react';
import { superadminRetentionApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type LoadState = {
  data: any;
  loading: boolean;
  reload: () => Promise<void>;
};

function useRetention(loader: () => Promise<any>): LoadState {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData((await loader()).data);
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useEffect(() => { reload().catch(() => undefined); }, [reload]);
  return { data, loading, reload };
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const path = useLocalizedPath();
  const links = [
    ['/superadmin/retention/dashboard', 'Dashboard'],
    ['/superadmin/retention/churn-risk', 'Churn risk'],
    ['/superadmin/retention/renewals', 'Renewals'],
    ['/superadmin/retention/plans', 'Plans'],
    ['/superadmin/retention/reasons', 'Reasons'],
    ['/superadmin/retention/reports', 'Reports'],
  ];
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {links.map(([href, label]) => <Link key={href} href={path(href)} className="rounded-md border border-slate-200 px-3 py-2 hover:border-emerald-200 hover:text-emerald-700">{label}</Link>)}
        </nav>
      </div>
    </header>
  );
}

function Kpi({ label, value, note, icon }: { label: string; value: string | number; note?: string; icon?: ReactNode }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon || <TrendingDown className="h-4 w-4" />}</div><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="text-sm text-slate-500">{label}</p>{note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}</article>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{title}</h2><div className="mt-4">{hasChildren ? children : <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function Badge({ value }: { value?: string | null }) {
  const text = value || 'UNKNOWN';
  const tone = text.includes('CRITICAL') || text.includes('LOST') || text.includes('OVERDUE') || text.includes('SUSPENDED') ? 'border-red-200 bg-red-50 text-red-700'
    : text.includes('HIGH') || text.includes('WAITING') || text.includes('TRIAL') || text.includes('EXPIRING') ? 'border-amber-200 bg-amber-50 text-amber-700'
      : text.includes('SAVED') || text.includes('RENEWED') || text.includes('COMPLETED') || text.includes('ACTIVE') ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
}

export function RetentionHomePage() {
  return <RetentionDashboardPage />;
}

export function RetentionDashboardPage() {
  const { data, loading, reload } = useRetention(useCallback(() => superadminRetentionApi.dashboard(), []));
  const s = data?.summary || {};
  const detect = async () => { await superadminRetentionApi.detectRisks(); await reload(); };
  const generateRenewals = async () => { await superadminRetentionApi.generateRenewals(); await reload(); };
  return (
    <Shell>
      <Header title="Retention & Renewals" subtitle="Previno churn-ul, urmareste renovarile si prioritizeaza clientii care au nevoie de atentie." />
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={generateRenewals} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"><CalendarClock className="h-4 w-4" /> Generate renewals</button>
        <button onClick={detect} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Detect churn risk</button>
      </div>
      {loading ? <p className="text-sm text-slate-500">Se incarca...</p> : null}
      <div className="grid gap-3 md:grid-cols-5">
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Clienti cu risc" value={s.clientsAtRisk || 0} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Risc critic" value={s.criticalRisks || 0} />
        <Kpi label="Risc ridicat" value={s.highRisks || 0} />
        <Kpi icon={<CalendarClock className="h-4 w-4" />} label="Renewals 30 zile" value={s.upcomingRenewals30Days || 0} />
        <Kpi label="Trialuri expira" value={s.trialEndingSoon || 0} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Salvati luna aceasta" value={s.savedThisMonth || 0} />
        <Kpi label="Pierduti luna aceasta" value={s.lostThisMonth || 0} />
        <Kpi icon={<ListChecks className="h-4 w-4" />} label="Plans active" value={s.activeRetentionPlans || 0} />
        <Kpi label="Follow-up overdue" value={s.overdueFollowUps || 0} />
        <Kpi label="Revenue at risk" value={`${money(s.revenueAtRisk)} MDL`} note="Estimare interna." />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Critical churn risks" empty="Nu exista clienti cu risc de churn."><RiskTable items={data?.criticalRisks || []} onDone={reload} /></Panel>
        <Panel title="Upcoming renewals" empty="Nu exista reinnoiri programate."><RenewalTable items={data?.upcomingRenewals || []} onDone={reload} /></Panel>
        <Panel title="Retention plans active" empty="Nu exista planuri de retentie active."><PlanTable items={data?.activePlans || []} onDone={reload} /></Panel>
        <Panel title="Follow-up overdue" empty="Nu exista follow-up-uri overdue."><SimpleRows items={data?.overdueFollowUps || []} columns={['title', 'dueAt', 'priority', 'relatedEntityType']} /></Panel>
      </div>
    </Shell>
  );
}

export function ChurnRiskListPage({ clientId }: { clientId?: string }) {
  const params = useMemo(() => clientId ? { clientAccountId: clientId } : undefined, [clientId]);
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.risks(params), [params]));
  const detect = async () => {
    if (clientId) await superadminRetentionApi.detectClientRisks(clientId);
    else await superadminRetentionApi.detectRisks();
    await reload();
  };
  return (
    <Shell>
      <Header title="Churn risk" subtitle="Clienti cu risc de plecare, motive, severitate, owner si urmatorul follow-up." />
      <div className="flex justify-end"><button onClick={detect} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Detect risks</button></div>
      <Panel title="Risks" empty="Nu exista clienti cu risc de churn."><RiskTable items={data?.items || []} onDone={reload} /></Panel>
    </Shell>
  );
}

export function ChurnRiskDetailPage({ id }: { id: string }) {
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.risk(id), [id]));
  const risk = data?.risk || {};
  const note = async () => { const text = window.prompt('Nota interna'); if (!text) return; await superadminRetentionApi.addRiskNote(id, { note: text }); await reload(); };
  const task = async () => { const title = window.prompt('Titlu task'); await superadminRetentionApi.riskTask(id, title ? { title } : {}); await reload(); };
  const follow = async () => { const dueAt = window.prompt('Due date ISO'); if (!dueAt) return; await superadminRetentionApi.riskFollowUp(id, { dueAt, title: 'Follow-up retentie' }); await reload(); };
  return (
    <Shell>
      <Header title={risk.title || 'Churn risk'} subtitle="Evidence, health, subscription, timeline si planuri de retentie." />
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{data?.client?.displayName || data?.association?.name || risk.clientAccountId}</p>
            <h2 className="text-xl font-semibold text-slate-950">{risk.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2"><Badge value={risk.reason} /><Badge value={risk.severity} /><Badge value={risk.status} /><ScoreBadge score={risk.score} /></div>
          </div>
          <div className="text-right"><p className="text-2xl font-semibold text-slate-950">{money(data?.evidence?.revenueAtRisk)} MDL</p><p className="text-sm text-slate-500">revenue at risk</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button onClick={async () => { await superadminRetentionApi.updateRiskStatus(id, { status: 'IN_REVIEW' }); await reload(); }} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">In review</button>
          <button onClick={async () => { await superadminRetentionApi.startRetentionPlan(id); await reload(); }} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Start plan</button>
          <button onClick={task} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create task</button>
          <button onClick={follow} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create follow-up</button>
          <button onClick={note} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Add note</button>
          <button onClick={async () => { await superadminRetentionApi.markRiskSaved(id); await reload(); }} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Mark saved</button>
          <button onClick={async () => { await superadminRetentionApi.markRiskLost(id); await reload(); }} className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">Mark lost</button>
          <button onClick={async () => { await superadminRetentionApi.dismissRisk(id); await reload(); }} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Dismiss</button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Evidence" empty="Nu exista evidence."><SimpleRows items={[data?.evidence || {}]} columns={['healthStatus', 'healthScore', 'subscriptionStatus', 'revenueAtRisk']} /></Panel>
        <Panel title="Retention plans" empty="Nu exista planuri de retentie active."><PlanTable items={data?.retentionPlans || []} onDone={reload} /></Panel>
        <Panel title="Tasks" empty="Nu exista taskuri legate."><SimpleRows items={data?.tasks || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Follow-ups" empty="Nu exista follow-up-uri legate."><SimpleRows items={data?.followUps || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Events" empty="Nu exista evenimente."><Timeline items={data?.events || []} /></Panel>
      </div>
    </Shell>
  );
}

export function RetentionRenewalsPage({ clientId }: { clientId?: string }) {
  const params = useMemo(() => clientId ? { clientAccountId: clientId } : undefined, [clientId]);
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.renewals(params), [params]));
  const generate = async () => { await superadminRetentionApi.generateRenewals(); await reload(); };
  return (
    <Shell>
      <Header title="Renewals" subtitle="Renewal date, status, outcome, valori curente si follow-up pentru abonamente." />
      <div className="flex justify-end"><button onClick={generate} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Generate from subscriptions</button></div>
      <Panel title="Renewals" empty="Nu exista reinnoiri programate."><RenewalTable items={data?.items || []} onDone={reload} /></Panel>
    </Shell>
  );
}

export function RetentionRenewalDetailPage({ id }: { id: string }) {
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.renewal(id), [id]));
  const renewal = data?.renewal || {};
  const task = async () => { const title = window.prompt('Titlu task'); await superadminRetentionApi.renewalTask(id, title ? { title } : {}); await reload(); };
  const follow = async () => { const dueAt = window.prompt('Due date ISO'); if (!dueAt) return; await superadminRetentionApi.renewalFollowUp(id, { dueAt, title: 'Follow-up renewal' }); await reload(); };
  const complete = async (outcome: string) => {
    const outcomeNotes = window.prompt('Outcome notes optional') || undefined;
    await superadminRetentionApi.completeRenewal(id, { outcome, outcomeNotes });
    await reload();
  };
  return (
    <Shell>
      <Header title="Renewal detail" subtitle="Context renewal, plan propus, churn risk asociat si timeline." />
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{data?.client?.displayName || data?.association?.name || renewal.clientAccountId}</p>
            <h2 className="text-xl font-semibold text-slate-950">{date(renewal.renewalDate)}</h2>
            <div className="mt-3 flex flex-wrap gap-2"><Badge value={renewal.status} /><Badge value={renewal.outcome} /></div>
          </div>
          <div className="text-right"><p className="text-2xl font-semibold text-slate-950">{money(renewal.currentMonthlyValue)} {renewal.currency}</p><p className="text-sm text-slate-500">current value</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button onClick={async () => { await superadminRetentionApi.startRenewal(id); await reload(); }} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Start renewal</button>
          <button onClick={async () => { await superadminRetentionApi.startRenewalRetentionPlan(id); await reload(); }} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Start retention plan</button>
          <button onClick={task} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create task</button>
          <button onClick={follow} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create follow-up</button>
          <button onClick={() => complete('RENEWED_SAME_PLAN')} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Renewed same plan</button>
          <button onClick={() => complete('RENEWED_UPGRADED')} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Renewed upgraded</button>
          <button onClick={() => complete('CANCELLED_BY_CLIENT')} className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">Not renewed</button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Related churn risks" empty="Nu exista churn risks legate."><RiskTable items={data?.relatedChurnRisks || []} onDone={reload} /></Panel>
        <Panel title="Retention plans" empty="Nu exista planuri de retentie."><PlanTable items={data?.retentionPlans || []} onDone={reload} /></Panel>
        <Panel title="Tasks" empty="Nu exista taskuri."><SimpleRows items={data?.tasks || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Follow-ups" empty="Nu exista follow-up-uri."><SimpleRows items={data?.followUps || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Events" empty="Nu exista evenimente."><Timeline items={data?.events || []} /></Panel>
      </div>
    </Shell>
  );
}

export function RetentionPlansPage({ clientId }: { clientId?: string }) {
  const params = useMemo(() => clientId ? { clientAccountId: clientId } : undefined, [clientId]);
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.plans(params), [params]));
  return <Shell><Header title="Retention plans" subtitle="Checklist-uri de retentie, owner, due date, outcome si actiuni." /><Panel title="Plans" empty="Nu exista planuri de retentie active."><PlanTable items={data?.items || []} onDone={reload} /></Panel></Shell>;
}

export function RetentionPlanDetailPage({ id }: { id: string }) {
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.plan(id), [id]));
  const plan = data?.plan || {};
  const action = async () => {
    const title = window.prompt('Titlu actiune');
    if (!title) return;
    await superadminRetentionApi.createAction(id, { title, actionType: 'ADD_NOTE', priority: plan.priority || 'NORMAL' });
    await reload();
  };
  const task = async () => { const title = window.prompt('Titlu task'); await superadminRetentionApi.planTask(id, title ? { title } : {}); await reload(); };
  const follow = async () => { const dueAt = window.prompt('Due date ISO'); if (!dueAt) return; await superadminRetentionApi.planFollowUp(id, { dueAt, title: 'Follow-up plan retentie' }); await reload(); };
  return (
    <Shell>
      <Header title={plan.title || 'Retention plan'} subtitle="Checklist, timeline, tasks si outcome pentru planul de retentie." />
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{data?.client?.displayName || data?.association?.name || plan.clientAccountId}</p>
            <h2 className="text-xl font-semibold text-slate-950">{plan.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{plan.goal}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Badge value={plan.status} /><Badge value={plan.priority} /><Badge value={plan.outcome} /></div>
          </div>
          <div className="text-right"><p className="text-2xl font-semibold text-slate-950">{data?.plan?.actions?.filter?.((item: any) => item.status === 'COMPLETED').length || 0}/{data?.plan?.actions?.length || 0}</p><p className="text-sm text-slate-500">actions done</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button onClick={action} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Add action</button>
          <button onClick={task} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create task</button>
          <button onClick={follow} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create follow-up</button>
          <button onClick={async () => { await superadminRetentionApi.completePlan(id, { outcome: 'SAVED' }); await reload(); }} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Complete saved</button>
          <button onClick={async () => { await superadminRetentionApi.completePlan(id, { outcome: 'LOST' }); await reload(); }} className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">Complete lost</button>
          <button onClick={async () => { await superadminRetentionApi.cancelPlan(id); await reload(); }} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Cancel</button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Actions checklist" empty="Nu exista actiuni."><ActionList planId={id} items={data?.actions || []} onDone={reload} /></Panel>
        <Panel title="Related risk" empty="Nu exista churn risk legat.">{data?.churnRisk ? <RiskTable items={[data.churnRisk]} onDone={reload} /> : null}</Panel>
        <Panel title="Related renewal" empty="Nu exista renewal legat.">{data?.renewal ? <RenewalTable items={[data.renewal]} onDone={reload} /> : null}</Panel>
        <Panel title="Tasks" empty="Nu exista taskuri."><SimpleRows items={data?.tasks || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Follow-ups" empty="Nu exista follow-up-uri."><SimpleRows items={data?.followUps || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Events" empty="Nu exista evenimente."><Timeline items={data?.events || []} /></Panel>
      </div>
    </Shell>
  );
}

export function RetentionReasonsPage() {
  const { data } = useRetention(useCallback(() => superadminRetentionApi.reasons(), []));
  return <Shell><Header title="Retention reasons" subtitle="Motive de churn si reguli de detectie folosite de workflow." /><div className="grid gap-4 lg:grid-cols-2"><Panel title="Churn reasons" empty="Nu exista motive configurate."><SimpleRows items={(data?.churnReasons || []).map((reason: string) => ({ reason }))} columns={['reason']} /></Panel><Panel title="Detection rules" empty="Nu exista reguli."><SimpleRows items={(data?.detectionRules || []).map((rule: string) => ({ rule }))} columns={['rule']} /></Panel></div></Shell>;
}

export function RetentionReportsPage() {
  const { data } = useRetention(useCallback(() => superadminRetentionApi.reports(), []));
  const s = data?.summary || {};
  return (
    <Shell>
      <Header title="Retention reports" subtitle="Raport intern pentru churn risk, renewals, retention plans si revenue at risk." />
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Open risks" value={s.openRisks || 0} />
        <Kpi label="Saved risks" value={s.savedRisks || 0} />
        <Kpi label="Lost risks" value={s.lostRisks || 0} />
        <Kpi label="Revenue at risk" value={`${money(s.revenueAtRisk)} MDL`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By reason" empty="Nu exista date suficiente pentru raportul de retentie."><Bars items={data?.byReason || []} /></Panel>
        <Panel title="By severity" empty="Nu exista date suficiente pentru raportul de retentie."><Bars items={data?.bySeverity || []} /></Panel>
        <Panel title="Renewal status" empty="Nu exista renewals."><Bars items={data?.byRenewalStatus || []} /></Panel>
        <Panel title="Recent activity" empty="Nu exista activitate."><Timeline items={data?.recentEvents || []} /></Panel>
      </div>
    </Shell>
  );
}

export function ClientRetentionPage({ clientId, view = 'overview' }: { clientId: string; view?: 'overview' | 'renewal' | 'churn-risk' }) {
  const { data, reload } = useRetention(useCallback(() => superadminRetentionApi.clientRetention(clientId), [clientId]));
  if (view === 'renewal') return <RetentionRenewalsPage clientId={clientId} />;
  if (view === 'churn-risk') return <ChurnRiskListPage clientId={clientId} />;
  return (
    <Shell>
      <Header title="Client retention" subtitle="Tab intern pentru churn risk, renewal status si planuri de retentie ale clientului." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Active churn risks" empty="Nu exista churn risks active."><RiskTable items={data?.risks || []} onDone={reload} /></Panel>
        <Panel title="Renewals" empty="Nu exista renewals."><RenewalTable items={data?.renewals || []} onDone={reload} /></Panel>
        <Panel title="Retention plans" empty="Nu exista planuri."><PlanTable items={data?.plans || []} onDone={reload} /></Panel>
      </div>
    </Shell>
  );
}

function RiskTable({ items, onDone }: { items: any[]; onDone?: () => void }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  const startPlan = async (id: string) => { await superadminRetentionApi.startRetentionPlan(id); await onDone?.(); };
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Client', 'Reason', 'Severity', 'Status', 'Score', 'Revenue at risk', 'Follow-up', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3"><Link href={path(`/superadmin/retention/churn-risk/${item.id}`)} className="font-semibold text-slate-950 hover:text-emerald-700">{item.client?.displayName || item.title}</Link><p className="text-xs text-slate-500">{item.client?.associationCode || item.associationId || '-'}</p></td><td className="p-3"><Badge value={item.reason} /></td><td className="p-3"><Badge value={item.severity} /></td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><ScoreBadge score={item.score} /></td><td className="p-3">{money(item.revenueAtRisk || item.metadata?.revenueAtRisk)} MDL</td><td className="p-3">{date(item.nextFollowUpAt)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Link href={path(`/superadmin/retention/churn-risk/${item.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Open</Link>{onDone ? <button onClick={() => startPlan(item.id)} className="rounded-md border border-emerald-200 px-2 py-1 font-semibold text-emerald-700">Start plan</button> : null}</div></td></tr>)}</tbody></table></div>;
}

function RenewalTable({ items, onDone }: { items: any[]; onDone?: () => void }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  const start = async (id: string) => { await superadminRetentionApi.startRenewal(id); await onDone?.(); };
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Client', 'Renewal date', 'Status', 'Outcome', 'Current value', 'Days', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3"><Link href={path(`/superadmin/retention/renewals/${item.id}`)} className="font-semibold text-slate-950 hover:text-emerald-700">{item.client?.displayName || item.clientAccountId}</Link><p className="text-xs text-slate-500">{item.subscription?.plan?.name || item.subscriptionId || '-'}</p></td><td className="p-3">{date(item.renewalDate)}</td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><Badge value={item.outcome} /></td><td className="p-3">{money(item.currentMonthlyValue)} {item.currency}/luna</td><td className="p-3">{item.daysRemaining ?? '-'}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Link href={path(`/superadmin/retention/renewals/${item.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Open</Link>{onDone ? <button onClick={() => start(item.id)} className="rounded-md border border-emerald-200 px-2 py-1 font-semibold text-emerald-700">Start</button> : null}</div></td></tr>)}</tbody></table></div>;
}

function PlanTable({ items, onDone }: { items: any[]; onDone?: () => void }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Plan', 'Client', 'Status', 'Priority', 'Due', 'Progress', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3"><Link href={path(`/superadmin/retention/plans/${item.id}`)} className="font-semibold text-slate-950 hover:text-emerald-700">{item.title}</Link><p className="text-xs text-slate-500">{item.goal}</p></td><td className="p-3">{item.client?.displayName || item.clientAccountId}</td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><Badge value={item.priority} /></td><td className="p-3">{date(item.dueAt)}</td><td className="p-3">{item.progress?.percent ?? 0}%</td><td className="p-3"><Link href={path(`/superadmin/retention/plans/${item.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Open</Link></td></tr>)}</tbody></table></div>;
}

function ActionList({ planId, items, onDone }: { planId: string; items: any[]; onDone: () => void }) {
  if (!items.length) return null;
  const complete = async (actionId: string) => { await superadminRetentionApi.completeAction(planId, actionId); await onDone(); };
  return <div className="space-y-2">{items.map((item) => <article key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.actionType} · {date(item.dueAt)}</p></div><div className="flex flex-wrap gap-2"><Badge value={item.status} />{item.status !== 'COMPLETED' ? <button onClick={() => complete(item.id)} className="rounded-md border border-emerald-200 px-2 py-1 text-sm font-semibold text-emerald-700">Complete</button> : null}</div></div></article>)}</div>;
}

function Timeline({ items }: { items: any[] }) {
  if (!items.length) return null;
  return <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-950">{item.title || item.eventType || 'Update'}</p><p className="text-xs text-slate-500">{date(item.createdAt)}</p></div><p className="mt-1 text-sm text-slate-600">{item.message || '-'}</p></article>)}</div>;
}

function Bars({ items }: { items: any[] }) {
  const max = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  if (!items.length) return null;
  return <div className="space-y-3">{items.map((item) => <div key={item.key} className="grid grid-cols-[170px_1fr_60px] items-center gap-3 text-sm"><span className="font-medium text-slate-700">{item.key}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (Number(item.count || 0) / max) * 100)}%` }} /></div><span className="text-right font-semibold text-slate-950">{item.count}</span></div>)}</div>;
}

function SimpleRows({ items, columns }: { items: any[]; columns: string[] }) {
  const rows = useMemo(() => items || [], [items]);
  if (!rows.length) return null;
  return <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item, index) => <tr key={item.id || index}>{columns.map((column) => <td key={column} className="p-3 text-slate-700">{formatCell(get(item, column))}</td>)}</tr>)}</tbody></table></div>;
}

function ScoreBadge({ score }: { score?: number }) {
  const value = Number(score || 0);
  const tone = value >= 80 ? 'border-red-200 bg-red-50 text-red-700' : value >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{value}/100</span>;
}

function get(value: any, path: string) {
  return path.split('.').reduce((current, part) => current?.[part], value);
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return date(value);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function date(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ro-MD');
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('ro-MD', { maximumFractionDigits: 0 });
}
