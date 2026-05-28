'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText, HeartPulse, LineChart, RefreshCw, Save, TrendingUp, Users } from 'lucide-react';
import { superadminCustomerSuccessReportsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const reportLabels: Record<string, string> = {
  PORTFOLIO_OVERVIEW: 'Portfolio Overview',
  HEALTH_DISTRIBUTION: 'Health Distribution',
  ONBOARDING_PIPELINE: 'Onboarding Pipeline',
  REVENUE_ESTIMATE: 'Revenue Estimate',
  FOLLOW_UP_PERFORMANCE: 'Follow-up Performance',
  PLAYBOOK_PERFORMANCE: 'Playbook Performance',
  USAGE_BY_PLAN: 'Usage by Plan',
  CHURN_RISK: 'Churn Risk',
};

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">{children}</div></main>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const path = useLocalizedPath();
  const links = [
    ['/superadmin/customer-success/reports/portfolio', 'Portfolio'],
    ['/superadmin/customer-success/reports/health', 'Health'],
    ['/superadmin/customer-success/reports/onboarding', 'Onboarding'],
    ['/superadmin/customer-success/reports/revenue', 'Revenue'],
    ['/superadmin/customer-success/reports/follow-ups', 'Follow-ups'],
    ['/superadmin/customer-success/reports/playbooks', 'Playbooks'],
    ['/superadmin/customer-success/reports/usage', 'Usage'],
    ['/superadmin/customer-success/reports/churn-risk', 'Churn risk'],
    ['/superadmin/customer-success/reports/saved', 'Saved'],
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
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon || <BarChart3 className="h-4 w-4" />}</div><p className="text-2xl font-semibold text-slate-950">{value ?? '-'}</p><p className="text-sm text-slate-500">{label}</p>{note ? <p className="mt-2 text-xs text-slate-400">{note}</p> : null}</article>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">{title}</h2><div className="mt-4 space-y-3">{has ? children : <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function BarList({ items, labelKey = 'status', valueKey = 'count' }: { items: any[]; labelKey?: string; valueKey?: string }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  return <div className="space-y-2">{items.map((item) => <div key={String(item[labelKey])} className="grid grid-cols-[160px_1fr_52px] items-center gap-3 text-sm"><span className="truncate text-slate-600">{String(item[labelKey])}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (Number(item[valueKey] || 0) / max) * 100)}%` }} /></div><span className="text-right font-semibold text-slate-900">{item[valueKey] || 0}</span></div>)}</div>;
}

function Actions({ reportType, onDone }: { reportType: string; onDone?: () => void }) {
  const save = async () => {
    const name = window.prompt('Nume raport salvat');
    if (!name) return;
    await superadminCustomerSuccessReportsApi.createSaved({ name, reportType, filters: {}, isFavorite: false });
    await onDone?.();
  };
  const snapshot = async () => {
    await superadminCustomerSuccessReportsApi.saveSnapshot({ reportType, period: 'LAST_30_DAYS' });
    await onDone?.();
  };
  const exportCsv = async () => {
    const res = await superadminCustomerSuccessReportsApi.createExport({ reportType, format: 'CSV', filters: {} });
    const id = (res.data || res).id;
    if (id) window.location.href = superadminCustomerSuccessReportsApi.exportDownloadUrl(id);
  };
  return <div className="flex flex-wrap justify-end gap-2"><button onClick={snapshot} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Save className="h-4 w-4" /> Snapshot</button><button onClick={save} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><FileText className="h-4 w-4" /> Save report</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4" /> Export CSV</button></div>;
}

function useReport(loader: () => Promise<any>) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setData((await loader()).data); } finally { setLoading(false); } }, [loader]);
  useEffect(() => { load().catch(() => undefined); }, [load]);
  return { data, load, loading };
}

export function ReportsHomePage() {
  return <PortfolioReportPage />;
}

export function PortfolioReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.portfolio(), []);
  const { data, load, loading } = useReport(loader);
  const s = data?.summary || {};
  return (
    <Shell>
      <Header title="Portfolio Overview" subtitle="Vedere globala asupra clientilor Espace, starii lor si riscurilor operationale." />
      <Actions reportType="PORTFOLIO_OVERVIEW" onDone={load} />
      {loading ? <p className="text-sm text-slate-500">Se incarca...</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Users className="h-4 w-4" />} label="Total clienti" value={s.totalClients || 0} />
        <Kpi label="Clienti activi" value={s.activeClients || 0} />
        <Kpi label="In onboarding" value={s.onboardingClients || 0} />
        <Kpi icon={<HeartPulse className="h-4 w-4" />} label="In risc / critici" value={`${s.atRiskClients || 0}/${s.criticalClients || 0}`} />
        <Kpi label="Trial ending soon" value={s.trialEndingSoon || 0} />
        <Kpi label="Facturi SaaS restante" value={s.overdueSaasInvoices || 0} />
        <Kpi label="Follow-up-uri intarziate" value={s.overdueFollowUps || 0} />
        <Kpi label="Taskuri intarziate" value={s.overdueTasks || 0} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Estimated MRR" value={`${money(s.estimatedMrr)} MDL`} note="Estimare interna, nu raport fiscal." />
        <Kpi label="Estimated ARR" value={`${money(s.estimatedArr)} MDL`} note="Estimare interna." />
        <Kpi label="Planuri active" value={s.activePlans || 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Health distribution" empty="Nu exista health score calculat."><BarList items={data?.healthDistribution || []} /></Panel>
        <Panel title="Lifecycle distribution" empty="Nu exista clienti."><BarList items={data?.lifecycleDistribution || []} labelKey="stage" /></Panel>
        <Panel title="At-risk clients" empty="Nu exista clienti in risc."><ClientList items={data?.atRiskClients || []} /></Panel>
        <Panel title="Playbook performance" empty="Nu exista interventii."><SimpleRows items={data?.playbookPerformance || []} columns={['name', 'started', 'completed', 'completionRate']} /></Panel>
      </div>
    </Shell>
  );
}

export function HealthReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.health(), []);
  const { data, load } = useReport(loader);
  return <ReportPage title="Health Report" subtitle="Distributie health score, top risk reasons si clienti fara snapshot." reportType="HEALTH_DISTRIBUTION" onDone={load}>
    <div className="grid gap-3 md:grid-cols-4"><Kpi label="Average score" value={data?.summary?.averageScore ?? '-'} /><Kpi label="Median score" value={data?.summary?.medianScore ?? '-'} /><Kpi label="Fara snapshot" value={data?.summary?.withoutSnapshot || 0} /><Kpi label="Total clienti" value={data?.summary?.totalClients || 0} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Panel title="Health distribution" empty="Nu exista health score calculat."><BarList items={data?.distribution || []} /></Panel><Panel title="Top risk reasons" empty="Nu exista motive de risc."><BarList items={data?.topRiskReasons || []} labelKey="key" /></Panel></div>
    <Panel title="Health clients" empty="Nu exista clienti."><SimpleRows items={data?.items || []} columns={['displayName', 'lifecycleStage', 'healthScore', 'healthStatus', 'lastCalculatedAt']} /></Panel>
  </ReportPage>;
}

export function OnboardingReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.onboarding(), []);
  const { data, load } = useReport(loader);
  const s = data?.summary || {};
  return <ReportPage title="Onboarding Report" subtitle="Pipeline onboarding, clienti blocati si clienti fara owner/follow-up." reportType="ONBOARDING_PIPELINE" onDone={load}>
    <div className="grid gap-3 md:grid-cols-6"><Kpi label="In onboarding" value={s.onboarding || 0} /><Kpi label="Blocati" value={s.stuck || 0} /><Kpi label="Gata activare" value={s.readyToActivate || 0} /><Kpi label="Fara owner" value={s.noOwner || 0} /><Kpi label="Fara follow-up" value={s.noFollowUp || 0} /><Kpi label="Medie zile" value={s.averageDaysInOnboarding || 0} /></div>
    <Panel title="Lifecycle distribution" empty="Nu exista clienti."><BarList items={data?.lifecycleDistribution || []} labelKey="stage" /></Panel>
    <Panel title="Stuck onboarding clients" empty="Nu exista clienti blocati."><ClientList items={data?.stuckClients || []} /></Panel>
  </ReportPage>;
}

export function RevenueReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.revenue(), []);
  const { data, load } = useReport(loader);
  const s = data?.summary || {};
  return <ReportPage title="Revenue Estimate" subtitle="Estimare interna MRR/ARR si facturi SaaS restante. Nu este raport contabil fiscal." reportType="REVENUE_ESTIMATE" onDone={load}>
    <div className="grid gap-3 md:grid-cols-4"><Kpi label="Estimated MRR" value={`${money(s.estimatedMrr)} MDL`} /><Kpi label="Estimated ARR" value={`${money(s.estimatedArr)} MDL`} /><Kpi label="Outstanding balance" value={`${money(s.outstandingBalance)} MDL`} /><Kpi label="Overdue balance" value={`${money(s.overdueBalance)} MDL`} /><Kpi label="Active subscriptions" value={s.activeSubscriptions || 0} /><Kpi label="Trialing" value={s.trialing || 0} /><Kpi label="Suspended" value={s.suspended || 0} /><Kpi label="Cancelled" value={s.cancelled || 0} /></div>
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Venit estimat, nu raport contabil fiscal.</div>
    <Panel title="Revenue by plan" empty="Nu exista abonamente active."><SimpleRows items={data?.byPlan || []} columns={['planCode', 'planName', 'clients', 'estimatedMrr']} /></Panel>
    <Panel title="Overdue SaaS invoices" empty="Nu exista facturi SaaS restante."><SimpleRows items={data?.overdueInvoices || []} columns={['invoiceNumber', 'status', 'dueDate', 'balanceAmount', 'association.shortName']} /></Panel>
  </ReportPage>;
}

export function FollowUpsReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.followUps(), []);
  const { data, load } = useReport(loader);
  const s = data?.summary || {};
  return <ReportPage title="Follow-up Performance" subtitle="Follow-up-uri, taskuri, overdue si performanta pe owner." reportType="FOLLOW_UP_PERFORMANCE" onDone={load}>
    <div className="grid gap-3 md:grid-cols-4"><Kpi label="Follow-ups" value={s.totalFollowUps || 0} /><Kpi label="Completed" value={s.completedFollowUps || 0} /><Kpi label="Overdue" value={s.overdueFollowUps || 0} /><Kpi label="Completion rate" value={`${s.completionRate || 0}%`} /><Kpi label="Tasks" value={s.totalTasks || 0} /><Kpi label="Tasks completed" value={s.completedTasks || 0} /><Kpi label="Tasks overdue" value={s.overdueTasks || 0} /><Kpi label="Task completion" value={`${s.taskCompletionRate || 0}%`} /></div>
    <Panel title="By owner" empty="Nu exista follow-up-uri."><SimpleRows items={data?.byOwner || []} columns={['ownerUserId', 'open', 'completed', 'overdue', 'completionRate']} /></Panel>
    <Panel title="Overdue follow-ups" empty="Nu exista follow-up-uri intarziate."><SimpleRows items={data?.overdueItems || []} columns={['title', 'dueAt', 'priority', 'status', 'clientAccount.displayName']} /></Panel>
  </ReportPage>;
}

export function PlaybooksReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.playbooks(), []);
  const { data, load } = useReport(loader);
  const s = data?.summary || {};
  return <ReportPage title="Playbook Performance" subtitle="Utilizare, rata de finalizare si interventii active pe playbook." reportType="PLAYBOOK_PERFORMANCE" onDone={load}>
    <div className="grid gap-3 md:grid-cols-5"><Kpi label="Playbooks active" value={s.activePlaybooks || 0} /><Kpi label="Started" value={s.interventionsStarted || 0} /><Kpi label="Completed" value={s.interventionsCompleted || 0} /><Kpi label="Cancelled" value={s.interventionsCancelled || 0} /><Kpi label="Active interventions" value={s.activeInterventions || 0} /></div>
    <Panel title="Playbook table" empty="Nu exista playbook-uri."><SimpleRows items={data?.items || []} columns={['name', 'category', 'started', 'completed', 'cancelled', 'active', 'completionRate']} /></Panel>
  </ReportPage>;
}

export function UsageReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.usage(), []);
  const { data, load } = useReport(loader);
  return <ReportPage title="Usage by Plan" subtitle="Distributie abonamente si utilizare estimata pe planuri." reportType="USAGE_BY_PLAN" onDone={load}>
    <div className="grid gap-3 md:grid-cols-3"><Kpi label="Planuri" value={data?.summary?.plans || 0} /><Kpi label="Subscriptions" value={data?.summary?.subscriptions || 0} /><Kpi label="Active" value={data?.summary?.active || 0} /></div>
    <Panel title="Usage by plan" empty="Nu exista date de usage."><SimpleRows items={data?.items || []} columns={['planCode', 'planName', 'subscriptions', 'active', 'trialing', 'suspended', 'averageApartments']} /></Panel>
  </ReportPage>;
}

export function ChurnRiskReportPage() {
  const loader = useCallback(() => superadminCustomerSuccessReportsApi.churnRisk(), []);
  const { data, load } = useReport(loader);
  const s = data?.summary || {};
  return <ReportPage title="Churn Risk" subtitle="Clienti in risc, facturi restante, follow-up-uri intarziate si clienti fara owner." reportType="CHURN_RISK" onDone={load}>
    <div className="grid gap-3 md:grid-cols-6"><Kpi label="At-risk" value={s.atRiskClients || 0} /><Kpi label="Critical" value={s.criticalClients || 0} /><Kpi label="High churn risk" value={s.highChurnRisk || 0} /><Kpi label="No owner" value={s.noOwner || 0} /><Kpi label="Overdue invoices" value={s.overdueInvoices || 0} /><Kpi label="Overdue follow-ups" value={s.overdueFollowUps || 0} /></div>
    <Panel title="Risk clients" empty="Nu exista clienti in risc."><ClientList items={data?.items || []} /></Panel>
  </ReportPage>;
}

export function SavedReportsPage({ id }: { id?: string }) {
  const path = useLocalizedPath();
  const loader = useCallback(() => id ? superadminCustomerSuccessReportsApi.savedDetail(id) : superadminCustomerSuccessReportsApi.saved(), [id]);
  const { data, load } = useReport(loader);
  const items = id ? [data].filter(Boolean) : (data?.items || []);
  const create = async () => {
    const name = window.prompt('Nume raport');
    if (!name) return;
    await superadminCustomerSuccessReportsApi.createSaved({ name, reportType: 'PORTFOLIO_OVERVIEW', filters: {}, isFavorite: true });
    await load();
  };
  return <Shell><Header title="Saved Reports" subtitle="Rapoarte interne salvate ca filtre si configurari, fara date brute." /><div className="flex justify-end"><button onClick={create} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salveaza raport</button></div><Panel title="Saved reports" empty="Nu exista rapoarte salvate.">{items.map((item: any) => <Link key={item.id} href={path(`/superadmin/customer-success/reports/saved/${item.id}`)} className="block rounded-md border border-slate-200 p-3 hover:border-emerald-300"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-950">{item.name}</p><span className="text-xs text-slate-500">{item.reportType}</span></div><p className="mt-1 text-sm text-slate-500">{item.description || 'Raport salvat intern.'}</p></Link>)}</Panel></Shell>;
}

function ReportPage({ title, subtitle, reportType, onDone, children }: { title: string; subtitle: string; reportType: string; onDone: () => void; children: React.ReactNode }) {
  return <Shell><Header title={title} subtitle={subtitle} /><Actions reportType={reportType} onDone={onDone} />{children}</Shell>;
}

function ClientList({ items }: { items: any[] }) {
  const path = useLocalizedPath();
  return <div className="space-y-2">{items.map((item) => <Link key={item.id} href={path(`/superadmin/clients/${item.id}`)} className="block rounded-md border border-slate-200 p-3 hover:border-emerald-300"><p className="font-semibold text-slate-950">{item.displayName || item.associationName}</p><p className="text-sm text-slate-500">{item.associationCode || item.lifecycleStage || item.healthStatus || '-'}</p></Link>)}</div>;
}

function SimpleRows({ items, columns }: { items: any[]; columns: string[] }) {
  const rows = useMemo(() => items || [], [items]);
  if (!rows.length) return null;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{columns.map((column) => <th key={column} className="p-3">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item, index) => <tr key={item.id || item.playbookId || item.planCode || index}>{columns.map((column) => <td key={column} className="p-3 text-slate-700">{formatCell(get(item, column))}</td>)}</tr>)}</tbody></table></div>;
}

function get(value: any, path: string) {
  return path.split('.').reduce((current, part) => current?.[part], value);
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) return value.toLocaleDateString('ro-MD');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString('ro-MD');
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('ro-MD', { maximumFractionDigits: 0 });
}

