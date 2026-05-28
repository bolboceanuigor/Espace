'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, Clock, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { superadminRevenueApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type LoadState = {
  data: any;
  loading: boolean;
  reload: () => Promise<void>;
};

function useRevenue(loader: () => Promise<any>): LoadState {
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

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const path = useLocalizedPath();
  const links = [
    ['/superadmin/revenue/dashboard', 'Dashboard'],
    ['/superadmin/revenue/overdue', 'Restante'],
    ['/superadmin/revenue/aging', 'Aging'],
    ['/superadmin/revenue/collections', 'Collections'],
    ['/superadmin/revenue/promises', 'Promisiuni'],
    ['/superadmin/revenue/follow-ups', 'Follow-ups'],
    ['/superadmin/revenue/reports', 'Reports'],
    ['/superadmin/revenue/forecast', 'Forecast'],
    ['/superadmin/revenue/upgrade-opportunities', 'Upgrade'],
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

function Kpi({ label, value, note, icon }: { label: string; value: string | number; note?: string; icon?: React.ReactNode }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon || <Banknote className="h-4 w-4" />}</div><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="text-sm text-slate-500">{label}</p>{note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}</article>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{title}</h2><div className="mt-4">{hasChildren ? children : <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function Badge({ value }: { value?: string | null }) {
  const text = value || 'UNKNOWN';
  const tone = text.includes('URGENT') || text.includes('OVERDUE') || text.includes('MISSED') || text.includes('ESCALATED') || text.includes('SUSPENSION') ? 'border-red-200 bg-red-50 text-red-700'
    : text.includes('PROMISE') || text.includes('HIGH') || text.includes('FOLLOW') ? 'border-amber-200 bg-amber-50 text-amber-700'
      : text.includes('PAID') || text.includes('KEPT') || text.includes('CLOSED') ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
}

export function RevenueHomePage() {
  return <RevenueDashboardPage />;
}

export function RevenueDashboardPage() {
  const { data, loading, reload } = useRevenue(useCallback(() => superadminRevenueApi.dashboard(), []));
  const s = data?.summary || {};
  const sync = async () => { await superadminRevenueApi.syncCollectionCases(); await reload(); };
  return (
    <Shell>
      <Header title="Revenue Operations" subtitle="Urmareste facturile SaaS, incasarile manuale si follow-up-urile comerciale." />
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={sync} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Sync collection cases</button>
      </div>
      {loading ? <p className="text-sm text-slate-500">Se incarca...</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Estimated MRR" value={`${money(s.estimatedMrr)} MDL`} note="Estimare interna, nu raport fiscal." />
        <Kpi label="Estimated ARR" value={`${money(s.estimatedArr)} MDL`} />
        <Kpi label="Total issued" value={`${money(s.totalIssued)} MDL`} />
        <Kpi label="Total paid" value={`${money(s.totalPaid)} MDL`} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Outstanding balance" value={`${money(s.outstandingBalance)} MDL`} />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Overdue balance" value={`${money(s.overdueBalance)} MDL`} />
        <Kpi label="Overdue invoices" value={s.overdueInvoices || 0} />
        <Kpi label="Open collection cases" value={s.openCollectionCases || 0} />
        <Kpi label="Open promises" value={s.openPromises || 0} />
        <Kpi label="Missed promises" value={s.missedPromises || 0} />
        <Kpi label="Follow-ups today" value={s.followUpsDueToday || 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Overdue invoices" empty="Nu exista facturi SaaS restante."><OverdueInvoicesTable items={data?.overdueInvoices || []} onDone={reload} /></Panel>
        <Panel title="Aging summary" empty="Nu exista solduri restante."><AgingBars items={data?.aging || []} /></Panel>
        <Panel title="Collection cases needing follow-up" empty="Nu exista collection cases pentru follow-up."><CollectionCaseTable items={data?.casesNeedingFollowUp || []} /></Panel>
        <Panel title="Payment promises due soon" empty="Nu exista promisiuni de plata active."><PromiseTable items={data?.promisesDueSoon || []} /></Panel>
      </div>
    </Shell>
  );
}

export function RevenueOverduePage() {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.overdue(), []));
  return <Shell><Header title="Facturi SaaS restante" subtitle="Facturi cu sold restant si data scadenta depasita." /><Panel title="Overdue invoices" empty="Nu exista facturi SaaS restante."><OverdueInvoicesTable items={data?.items || []} onDone={reload} /></Panel></Shell>;
}

export function RevenueAgingPage() {
  const { data } = useRevenue(useCallback(() => superadminRevenueApi.aging(), []));
  return <Shell><Header title="Aging Report" subtitle="Grupeaza soldurile restante dupa zile de intarziere." /><Panel title="Aging buckets" empty="Nu exista solduri restante."><AgingBars items={data?.summary || []} /></Panel><Panel title="Aging by client" empty="Nu exista solduri restante."><SimpleRows items={data?.items || []} columns={['client', 'CURRENT', 'DAYS_1_7', 'DAYS_8_15', 'DAYS_16_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90_PLUS', 'totalOutstanding']} /></Panel></Shell>;
}

export function RevenueCollectionsPage({ params }: { params?: Record<string, string | undefined> }) {
  const loader = useCallback(() => superadminRevenueApi.collections(params), [params]);
  const { data } = useRevenue(loader);
  return <Shell><Header title="Collection Cases" subtitle="Urmareste cazurile interne de incasare pentru facturile SaaS." /><Panel title="Cases" empty="Nu exista collection cases."><CollectionCaseTable items={data?.items || []} /></Panel></Shell>;
}

export function RevenueCollectionDetailPage({ id }: { id: string }) {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.collection(id), [id]));
  const c = data?.case || {};
  const path = useLocalizedPath();
  const addNote = async () => {
    const note = window.prompt('Nota collections');
    if (!note) return;
    await superadminRevenueApi.addNote(id, { note, contactMethod: 'INTERNAL' });
    await reload();
  };
  const recordContact = async () => {
    const note = window.prompt('Rezumat contact client');
    if (!note) return;
    const nextFollowUpAt = window.prompt('Next follow-up ISO date optional');
    await superadminRevenueApi.recordContact(id, { contactMethod: 'PHONE', note, nextFollowUpAt: nextFollowUpAt || undefined, nextStep: nextFollowUpAt ? 'Follow-up plata' : undefined });
    await reload();
  };
  const promise = async () => {
    const promisedAmount = Number(window.prompt('Suma promisa') || 0);
    const promisedDate = window.prompt('Data promisa YYYY-MM-DD');
    if (!promisedAmount || !promisedDate) return;
    await superadminRevenueApi.createPromise(id, { promisedAmount, promisedDate, currency: c.currency || 'MDL' });
    await reload();
  };
  const follow = async () => {
    const dueAt = window.prompt('Due date ISO pentru follow-up');
    if (!dueAt) return;
    await superadminRevenueApi.scheduleFollowUp(id, { dueAt, title: 'Follow-up plata' });
    await reload();
  };
  const task = async () => {
    const title = window.prompt('Titlu task');
    if (!title) return;
    await superadminRevenueApi.createTask(id, { title });
    await reload();
  };
  const close = async () => {
    const reason = window.prompt('Motiv inchidere');
    if (!reason) return;
    await superadminRevenueApi.close(id, { reason, status: data?.invoice?.status === 'PAID' ? 'PAID' : 'CLOSED' });
    await reload();
  };
  return (
    <Shell>
      <Header title={c.title || 'Collection case'} subtitle="Timeline intern, promisiuni de plata, taskuri si follow-up-uri." />
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{data?.association?.name || data?.client?.displayName || c.associationId}</p>
            <h2 className="text-xl font-semibold text-slate-950">{c.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2"><Badge value={c.status} /><Badge value={c.priority} /><Badge value={c.agingBucket} /></div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-950">{money(c.amountDue)} {c.currency}</p>
            <p className="text-sm text-slate-500">{c.daysOverdue || 0} zile intarziere</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button onClick={addNote} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Adauga nota</button>
          <button onClick={recordContact} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Inregistreaza contact</button>
          <button onClick={promise} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Promisiune de plata</button>
          <button onClick={follow} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Follow-up plata</button>
          <button onClick={task} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Creeaza task</button>
          <button onClick={async () => { await superadminRevenueApi.escalate(id); await reload(); }} className="rounded-md border border-amber-200 px-3 py-2 font-semibold text-amber-700">Escaladeaza</button>
          <button onClick={async () => { await superadminRevenueApi.recommendSuspension(id); await reload(); }} className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">Recomanda suspendare</button>
          <button onClick={close} className="rounded-md bg-slate-950 px-3 py-2 font-semibold text-white">Inchide case</button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="SaaS invoice" empty="Nu exista factura legata.">{data?.invoice ? <Link href={path(`/superadmin/billing/saas-invoices/${data.invoice.id}`)} className="block rounded-md border border-slate-200 p-3 hover:border-emerald-300"><p className="font-semibold text-slate-950">{data.invoice.invoiceNumber}</p><p className="text-sm text-slate-500">{money(data.invoice.balanceAmount)} {data.invoice.currency} restant</p></Link> : null}</Panel>
        <Panel title="Payment promises" empty="Nu exista promisiuni de plata."><PromiseTable items={data?.promises || []} onDone={reload} /></Panel>
        <Panel title="Notes" empty="Nu exista note collections."><Timeline items={data?.notes || []} titleKey="contactMethod" messageKey="note" /></Panel>
        <Panel title="Events" empty="Nu exista evenimente collections."><Timeline items={data?.events || []} titleKey="title" messageKey="message" /></Panel>
        <Panel title="Tasks" empty="Nu exista taskuri legate."><SimpleRows items={data?.tasks || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Follow-ups" empty="Nu exista follow-up-uri legate."><SimpleRows items={data?.followUps || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
      </div>
    </Shell>
  );
}

export function RevenuePromisesPage() {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.promises(), []));
  return <Shell><Header title="Promisiuni de plata" subtitle="Promisiuni interne de plata, fara modificarea automata a facturilor SaaS." /><Panel title="Promises" empty="Nu exista promisiuni de plata."><PromiseTable items={data?.items || []} onDone={reload} /></Panel></Shell>;
}

export function RevenuePromiseDetailPage({ id }: { id: string }) {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.promise(id), [id]));
  const promise = data?.promise || {};
  return <Shell><Header title="Promisiune de plata" subtitle="Detaliu promisiune si timeline collections." /><section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm text-slate-500">{promise.promisedByName || 'Promisiune interna'}</p><h2 className="text-xl font-semibold text-slate-950">{money(promise.promisedAmount)} {promise.currency}</h2><div className="mt-3"><Badge value={promise.status} /></div></div><p className="text-sm text-slate-500">Promised date: {date(promise.promisedDate)}</p></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={async () => { await superadminRevenueApi.markPromiseKept(id); await reload(); }} className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700">Mark kept</button><button onClick={async () => { await superadminRevenueApi.markPromiseMissed(id); await reload(); }} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Mark missed</button></div></section><Panel title="Events" empty="Nu exista evenimente."><Timeline items={data?.events || []} titleKey="title" messageKey="message" /></Panel></Shell>;
}

export function RevenueProfilePage({ clientId, associationId }: { clientId?: string; associationId?: string }) {
  const loader = useCallback(() => clientId ? superadminRevenueApi.clientProfile(clientId) : superadminRevenueApi.associationProfile(associationId || ''), [clientId, associationId]);
  const { data } = useRevenue(loader);
  const s = data?.summary || {};
  return <Shell><Header title="Revenue client profile" subtitle="Context revenue pentru client/APC: abonament, facturi SaaS, cases si promisiuni." /><div className="grid gap-3 md:grid-cols-4"><Kpi label="Estimated MRR" value={`${money(s.estimatedMrr)} MDL`} /><Kpi label="Total issued" value={`${money(s.totalIssued)} MDL`} /><Kpi label="Total paid" value={`${money(s.totalPaid)} MDL`} /><Kpi label="Outstanding" value={`${money(s.outstandingBalance)} MDL`} /><Kpi label="Overdue" value={`${money(s.overdueBalance)} MDL`} /></div><div className="grid gap-4 lg:grid-cols-2"><Panel title="SaaS invoice history" empty="Nu exista facturi SaaS."><SimpleRows items={data?.invoices || []} columns={['invoiceNumber', 'status', 'dueDate', 'totalAmount', 'paidAmount', 'balanceAmount']} /></Panel><Panel title="Collection cases" empty="Nu exista collection cases."><CollectionCaseTable items={data?.cases || []} /></Panel><Panel title="Promises" empty="Nu exista promisiuni."><PromiseTable items={data?.promises || []} /></Panel><Panel title="Collection notes" empty="Nu exista note."><Timeline items={data?.notes || []} titleKey="contactMethod" messageKey="note" /></Panel></div></Shell>;
}

export function RevenueReportsPage() {
  const { data } = useRevenue(useCallback(() => superadminRevenueApi.reports(), []));
  return <Shell><Header title="Revenue Reports" subtitle="Rezumat operational pentru collections, aging si solduri restante." /><div className="grid gap-3 md:grid-cols-4"><Kpi label="Estimated MRR" value={`${money(data?.dashboard?.estimatedMrr)} MDL`} /><Kpi label="Outstanding" value={`${money(data?.dashboard?.outstandingBalance)} MDL`} /><Kpi label="Overdue" value={`${money(data?.dashboard?.overdueBalance)} MDL`} /><Kpi label="Open cases" value={data?.dashboard?.openCollectionCases || 0} /></div><Panel title="Aging summary" empty="Nu exista solduri restante."><AgingBars items={data?.aging || []} /></Panel></Shell>;
}

export function RevenueForecastPage() {
  return <RevenueForecastDashboardPage />;
}

export function RevenueForecastDashboardPage() {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.forecastDashboard(), []));
  const s = data?.summary || {};
  const generate = async () => { await superadminRevenueApi.generateForecast(); await reload(); };
  return (
    <Shell>
      <Header title="Revenue Forecast" subtitle="Estimeaza veniturile SaaS, oportunitatile de upgrade si riscul de churn." />
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={generate} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Generate snapshot</button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Current MRR" value={`${money(s.currentMrr)} MDL`} note="Estimare interna, nu raport fiscal." />
        <Kpi label="Current ARR" value={`${money(data?.current?.arr || s.currentArr)} MDL`} />
        <Kpi label="Forecast MRR" value={`${money(s.forecastMrr)} MDL`} />
        <Kpi label="Forecast ARR" value={`${money(s.forecastArr)} MDL`} />
        <Kpi label="Upgrade potential" value={`${money(s.upgradePotential)} MDL`} />
        <Kpi label="Trial conversion" value={`${money(s.trialConversionPotential)} MDL`} />
        <Kpi label="Collection recovery" value={`${money(s.collectionRecoveryPotential)} MDL`} />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Revenue at risk" value={`${money(s.revenueAtRisk)} MDL`} />
        <Kpi label="Open opportunities" value={s.openUpgradeOpportunities || 0} />
        <Kpi label="High score" value={s.highScoreOpportunities || 0} />
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Valori estimative interne, nu raport contabil fiscal.</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MRR by plan" empty="Nu exista abonamente active."><SimpleRows items={data?.breakdown?.byPlan || []} columns={['planCode', 'planName', 'subscriptions', 'active', 'trialing', 'mrr']} /></Panel>
        <Panel title="Forecast scenarios" empty="Nu exista scenarii de forecast."><ScenarioCards items={data?.scenarios || []} /></Panel>
        <Panel title="Top upgrade opportunities" empty="Nu exista oportunitati de upgrade."><UpgradeOpportunityTable items={data?.topUpgradeOpportunities || []} /></Panel>
        <Panel title="Opportunity status" empty="Nu exista oportunitati."><AgingBars items={(data?.breakdown?.byOpportunityStatus || []).map((item: any) => ({ bucket: item.key, amount: item.count }))} /></Panel>
      </div>
    </Shell>
  );
}

export function RevenueForecastScenariosPage({ id }: { id?: string }) {
  const loader = useCallback(() => id ? superadminRevenueApi.forecastScenario(id) : superadminRevenueApi.forecastScenarios(), [id]);
  const { data, reload } = useRevenue(loader);
  const items = id ? [data?.scenario].filter(Boolean) : (data?.items || []);
  const create = async () => {
    const name = window.prompt('Nume scenariu');
    if (!name) return;
    await superadminRevenueApi.createForecastScenario({ name, type: 'CUSTOM', status: 'DRAFT', horizon: 'DAYS_90', trialConversionRate: 0.5, upgradeConversionRate: 0.25, collectionRecoveryRate: 0.6, churnRiskLossRate: 0.3 });
    await reload();
  };
  const generate = async (scenarioId: string) => { await superadminRevenueApi.generateForecastScenario(scenarioId); await reload(); };
  return <Shell><Header title="Forecast scenarios" subtitle="Scenarii conservative, base, optimistic sau custom pentru forecast intern." /><div className="flex justify-end"><button onClick={create} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Creeaza scenariu</button></div><Panel title="Scenarios" empty="Nu exista scenarii de forecast."><div className="space-y-2">{items.map((item: any) => <article key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-slate-950">{item.name}</p><p className="text-sm text-slate-500">{item.type} · {item.horizon}</p></div><div className="flex flex-wrap gap-2"><Badge value={item.status} /><button onClick={() => generate(item.id)} className="rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold">Generate</button></div></div><SimpleRows items={[item.assumptions || {}]} columns={['trialConversionRate', 'upgradeConversionRate', 'collectionRecoveryRate', 'churnRiskLossRate']} /></article>)}</div></Panel></Shell>;
}

export function UpgradeOpportunitiesPage({ kanban = false, clientId }: { kanban?: boolean; clientId?: string }) {
  const params = useMemo(() => (clientId ? { clientAccountId: clientId } : undefined), [clientId]);
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.upgradeOpportunities(params), [params]));
  const detect = async () => { await superadminRevenueApi.detectUpgradeOpportunities(); await reload(); };
  const s = data?.summary || {};
  const items = data?.items || [];
  return (
    <Shell>
      <Header title="Oportunitati upgrade" subtitle="Identifica asociatiile care pot trece la un plan superior sau au nevoie de functionalitati avansate." />
      <div className="flex flex-wrap justify-end gap-2"><button onClick={detect} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Detect opportunities</button></div>
      <div className="grid gap-3 md:grid-cols-5">
        <Kpi label="Total opportunities" value={s.total || 0} />
        <Kpi label="New" value={s.new || 0} />
        <Kpi label="Qualified" value={s.qualified || 0} />
        <Kpi label="Monthly increase" value={`${money(s.estimatedMonthlyIncrease)} MDL`} />
        <Kpi label="Annual increase" value={`${money(s.estimatedAnnualIncrease)} MDL`} />
      </div>
      {kanban ? <OpportunityKanban items={items} onDone={reload} /> : <Panel title="Upgrade opportunities" empty="Nu exista oportunitati de upgrade."><UpgradeOpportunityTable items={items} onDone={reload} /></Panel>}
    </Shell>
  );
}

export function UpgradeOpportunityDetailPage({ id }: { id: string }) {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.upgradeOpportunity(id), [id]));
  const opportunity = data?.opportunity || {};
  const status = async (value: string) => { await superadminRevenueApi.updateUpgradeOpportunityStatus(id, { status: value }); await reload(); };
  const note = async () => { const text = window.prompt('Nota interna'); if (!text) return; await superadminRevenueApi.addUpgradeOpportunityNote(id, { note: text }); await reload(); };
  const task = async () => { const title = window.prompt('Titlu task'); await superadminRevenueApi.createUpgradeOpportunityTask(id, title ? { title } : {}); await reload(); };
  const follow = async () => { const dueAt = window.prompt('Due date ISO'); if (!dueAt) return; await superadminRevenueApi.createUpgradeOpportunityFollowUp(id, { dueAt, title: 'Follow-up upgrade' }); await reload(); };
  const convert = async () => {
    const selectedPlanId = window.prompt('Recommended/selected plan id', opportunity.recommendedPlanId || '');
    if (!selectedPlanId) return;
    if (!window.confirm('Confirmi schimbarea controlata a planului? Nu se genereaza factura automat.')) return;
    await superadminRevenueApi.convertUpgradeOpportunity(id, { confirm: true, selectedPlanId });
    await reload();
  };
  return (
    <Shell>
      <Header title={opportunity.title || 'Upgrade opportunity'} subtitle="Scor, evidence, plan recomandat si actiuni manuale pentru upgrade." />
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{data?.association?.name || data?.client?.displayName || opportunity.associationId}</p>
            <h2 className="text-xl font-semibold text-slate-950">{opportunity.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2"><ScoreBadge score={opportunity.score} /><Badge value={opportunity.status} /><Badge value={opportunity.priority} /><Badge value={opportunity.reason} /></div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-950">{money(opportunity.estimatedMonthlyIncrease)} {opportunity.currency}</p>
            <p className="text-sm text-slate-500">monthly increase · {money(opportunity.estimatedAnnualIncrease)} anual</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button onClick={() => status('QUALIFIED')} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Qualify</button>
          <button onClick={() => status('IN_DISCUSSION')} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">In discussion</button>
          <button onClick={() => status('PROPOSAL_SENT')} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Proposal sent</button>
          <button onClick={() => status('ACCEPTED')} className="rounded-md border border-emerald-200 px-3 py-2 font-semibold text-emerald-700">Accepted</button>
          <button onClick={() => status('REJECTED')} className="rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">Rejected</button>
          <button onClick={note} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Add note</button>
          <button onClick={task} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create task</button>
          <button onClick={follow} className="rounded-md border border-slate-200 px-3 py-2 font-semibold">Create follow-up</button>
          <button onClick={convert} className="rounded-md bg-slate-950 px-3 py-2 font-semibold text-white">Convert controlled</button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Plan comparison" empty="Nu exista planuri legate."><SimpleRows items={[{ currentPlan: data?.currentPlan?.name, recommendedPlan: data?.recommendedPlan?.name, currentMonthlyValue: opportunity.currentMonthlyValue, recommendedMonthlyValue: opportunity.recommendedMonthlyValue }]} columns={['currentPlan', 'recommendedPlan', 'currentMonthlyValue', 'recommendedMonthlyValue']} /></Panel>
        <Panel title="Evidence" empty="Nu exista evidence."><pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-white">{JSON.stringify(opportunity.evidence || {}, null, 2)}</pre></Panel>
        <Panel title="Tasks" empty="Nu exista taskuri."><SimpleRows items={data?.tasks || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Follow-ups" empty="Nu exista follow-up-uri."><SimpleRows items={data?.followUps || []} columns={['title', 'status', 'priority', 'dueAt']} /></Panel>
        <Panel title="Events" empty="Nu exista evenimente."><Timeline items={data?.events || []} titleKey="title" messageKey="message" /></Panel>
      </div>
    </Shell>
  );
}

export function ClientRevenueForecastPage({ clientId }: { clientId: string }) {
  const { data } = useRevenue(useCallback(() => superadminRevenueApi.clientForecast(clientId), [clientId]));
  return <Shell><Header title="Client revenue forecast" subtitle="Forecast si oportunitati pentru clientul selectat." /><div className="grid gap-3 md:grid-cols-4"><Kpi label="Current MRR" value={`${money(data?.forecast?.currentMrr)} MDL`} /><Kpi label="Forecast MRR" value={`${money(data?.forecast?.forecastMrr)} MDL`} /><Kpi label="Upgrade potential" value={`${money(data?.forecast?.upgradePotential)} MDL`} /><Kpi label="Revenue at risk" value={`${money(data?.forecast?.revenueAtRisk)} MDL`} /></div><Panel title="Client opportunities" empty="Nu exista oportunitati pentru acest client."><UpgradeOpportunityTable items={data?.opportunities || []} /></Panel></Shell>;
}

function ScenarioCards({ items }: { items: any[] }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  return <div className="space-y-2">{items.map((item) => <Link key={item.id} href={path(`/superadmin/revenue/forecast/scenarios/${item.id}`)} className="block rounded-md border border-slate-200 p-3 hover:border-emerald-300"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-950">{item.name}</p><Badge value={item.type} /></div><p className="mt-1 text-sm text-slate-500">{item.horizon} · trial {item.assumptions?.trialConversionRate ?? '-'}</p></Link>)}</div>;
}

function UpgradeOpportunityTable({ items, onDone }: { items: any[]; onDone?: () => void }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  const setStatus = async (id: string, value: string) => { await superadminRevenueApi.updateUpgradeOpportunityStatus(id, { status: value }); await onDone?.(); };
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Client', 'Reason', 'Score', 'Priority', 'Status', 'Increase', 'Follow-up', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3"><p className="font-semibold text-slate-950">{item.title}</p><p className="text-xs text-slate-500">{item.associationId}</p></td><td className="p-3"><Badge value={item.reason} /></td><td className="p-3"><ScoreBadge score={item.score} /></td><td className="p-3"><Badge value={item.priority} /></td><td className="p-3"><Badge value={item.status} /></td><td className="p-3">{money(item.estimatedMonthlyIncrease)} {item.currency}/lună</td><td className="p-3">{date(item.nextFollowUpAt)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Link href={path(`/superadmin/revenue/upgrade-opportunities/${item.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Open</Link>{onDone ? <button onClick={() => setStatus(item.id, 'QUALIFIED')} className="rounded-md border border-emerald-200 px-2 py-1 font-semibold text-emerald-700">Qualify</button> : null}</div></td></tr>)}</tbody></table></div>;
}

function OpportunityKanban({ items, onDone }: { items: any[]; onDone: () => void }) {
  const columns = ['NEW', 'QUALIFIED', 'IN_DISCUSSION', 'PROPOSAL_SENT', 'ACCEPTED', 'CONVERTED', 'REJECTED'];
  return <div className="grid gap-4 lg:grid-cols-4">{columns.map((status) => <Panel key={status} title={status} empty="Nu exista oportunitati in aceasta etapa."><div className="space-y-2">{items.filter((item) => item.status === status).map((item) => <OpportunityCard key={item.id} item={item} onDone={onDone} />)}</div></Panel>)}</div>;
}

function OpportunityCard({ item, onDone }: { item: any; onDone: () => void }) {
  const path = useLocalizedPath();
  const move = async (status: string) => { await superadminRevenueApi.updateUpgradeOpportunityStatus(item.id, { status }); await onDone(); };
  return <article className="rounded-md border border-slate-200 p-3"><Link href={path(`/superadmin/revenue/upgrade-opportunities/${item.id}`)} className="font-semibold text-slate-950 hover:text-emerald-700">{item.title}</Link><div className="mt-2 flex flex-wrap gap-2"><ScoreBadge score={item.score} /><Badge value={item.priority} /></div><select value={item.status} onChange={(event) => move(event.target.value)} className="mt-3 w-full rounded-md border border-slate-200 px-2 py-1 text-sm">{['NEW', 'QUALIFIED', 'IN_DISCUSSION', 'PROPOSAL_SENT', 'ACCEPTED', 'CONVERTED', 'REJECTED', 'LOST', 'DISMISSED'].map((status) => <option key={status}>{status}</option>)}</select></article>;
}

function ScoreBadge({ score }: { score?: number }) {
  const value = Number(score || 0);
  const tone = value >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : value >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{value}/100</span>;
}

export function InvoiceCollectionsPage({ invoiceId }: { invoiceId: string }) {
  const { data, reload } = useRevenue(useCallback(() => superadminRevenueApi.collections({ saasInvoiceId: invoiceId }), [invoiceId]));
  const create = async () => { await superadminRevenueApi.createCollection({ saasInvoiceId: invoiceId, priority: 'NORMAL' }); await reload(); };
  return <Shell><Header title="Collections factura SaaS" subtitle="Cazuri collections legate de factura SaaS selectata." /><div className="flex justify-end"><button onClick={create} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create collection case</button></div><Panel title="Collection cases" empty="Nu exista collection case pentru aceasta factura."><CollectionCaseTable items={data?.items || []} /></Panel></Shell>;
}

function OverdueInvoicesTable({ items, onDone }: { items: any[]; onDone?: () => void }) {
  const path = useLocalizedPath();
  const createCase = async (invoice: any) => {
    await superadminRevenueApi.createCollection({ saasInvoiceId: invoice.id, priority: invoice.daysOverdue > 15 ? 'HIGH' : 'NORMAL' });
    await onDone?.();
  };
  if (!items.length) return null;
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Invoice', 'Client', 'Due', 'Days', 'Balance', 'Collection', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((invoice) => <tr key={invoice.id}><td className="p-3 font-semibold text-slate-950">{invoice.invoiceNumber}</td><td className="p-3 text-slate-600">{invoice.association?.name || invoice.associationId}</td><td className="p-3 text-slate-600">{date(invoice.dueDate)}</td><td className="p-3 text-slate-600">{invoice.daysOverdue}</td><td className="p-3 text-slate-600">{money(invoice.balanceAmount)} {invoice.currency}</td><td className="p-3"><Badge value={invoice.collectionStatus} /></td><td className="p-3"><div className="flex flex-wrap gap-2"><Link href={path(`/superadmin/billing/saas-invoices/${invoice.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Invoice</Link>{invoice.collectionCase?.id ? <Link href={path(`/superadmin/revenue/collections/${invoice.collectionCase.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Case</Link> : <button onClick={() => createCase(invoice)} className="rounded-md bg-slate-950 px-2 py-1 font-semibold text-white">Create case</button>}</div></td></tr>)}</tbody></table></div>;
}

function CollectionCaseTable({ items }: { items: any[] }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Case', 'Status', 'Priority', 'Amount due', 'Days', 'Next follow-up', 'Promise', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3"><p className="font-semibold text-slate-950">{item.title}</p><p className="text-xs text-slate-500">{item.associationId}</p></td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><Badge value={item.priority} /></td><td className="p-3">{money(item.amountDue)} {item.currency}</td><td className="p-3">{item.daysOverdue || 0}</td><td className="p-3">{date(item.nextFollowUpAt)}</td><td className="p-3">{item.promises?.[0] ? <Badge value={item.promises[0].status} /> : '-'}</td><td className="p-3"><Link href={path(`/superadmin/revenue/collections/${item.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Open</Link></td></tr>)}</tbody></table></div>;
}

function PromiseTable({ items, onDone }: { items: any[]; onDone?: () => void }) {
  const path = useLocalizedPath();
  if (!items.length) return null;
  const kept = async (id: string) => { await superadminRevenueApi.markPromiseKept(id); await onDone?.(); };
  const missed = async (id: string) => { await superadminRevenueApi.markPromiseMissed(id); await onDone?.(); };
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['Client', 'Amount', 'Promised date', 'Status', 'Promised by', 'Actions'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="p-3">{item.collectionCase?.title || item.clientAccountId || '-'}</td><td className="p-3 font-semibold">{money(item.promisedAmount)} {item.currency}</td><td className="p-3">{date(item.promisedDate)}</td><td className="p-3"><Badge value={item.status} /></td><td className="p-3">{item.promisedByName || '-'}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Link href={path(`/superadmin/revenue/promises/${item.id}`)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold">Open</Link>{onDone ? <button onClick={() => kept(item.id)} className="rounded-md border border-emerald-200 px-2 py-1 font-semibold text-emerald-700">Kept</button> : null}{onDone ? <button onClick={() => missed(item.id)} className="rounded-md border border-red-200 px-2 py-1 font-semibold text-red-700">Missed</button> : null}</div></td></tr>)}</tbody></table></div>;
}

function AgingBars({ items }: { items: any[] }) {
  const max = Math.max(1, ...items.map((item) => Number(item.amount || 0)));
  if (!items.length) return null;
  return <div className="space-y-3">{items.map((item) => <div key={item.bucket} className="grid grid-cols-[130px_1fr_120px] items-center gap-3 text-sm"><span className="font-medium text-slate-700">{item.bucket}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (Number(item.amount || 0) / max) * 100)}%` }} /></div><span className="text-right font-semibold text-slate-950">{money(item.amount)} MDL</span></div>)}</div>;
}

function Timeline({ items, titleKey, messageKey }: { items: any[]; titleKey: string; messageKey: string }) {
  if (!items.length) return null;
  return <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-950">{get(item, titleKey) || 'Update'}</p><p className="text-xs text-slate-500">{date(item.createdAt)}</p></div><p className="mt-1 text-sm text-slate-600">{get(item, messageKey) || '-'}</p></article>)}</div>;
}

function SimpleRows({ items, columns }: { items: any[]; columns: string[] }) {
  const rows = useMemo(() => items || [], [items]);
  if (!rows.length) return null;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item, index) => <tr key={item.id || index}>{columns.map((column) => <td key={column} className="p-3 text-slate-700">{formatCell(get(item, column))}</td>)}</tr>)}</tbody></table></div>;
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
