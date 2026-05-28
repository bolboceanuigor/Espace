'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Database, ExternalLink, Gauge, Plus, RefreshCw, Rocket, Server, ShieldCheck } from 'lucide-react';
import { launchApi } from '@/lib/api';

const serviceTypes = ['SOURCE_CONTROL', 'HOSTING_FRONTEND', 'HOSTING_BACKEND', 'DATABASE', 'STORAGE', 'AUTH', 'EMAIL', 'SMS', 'DOMAIN', 'DNS', 'MONITORING', 'ERROR_TRACKING', 'PAYMENT_PROVIDER', 'DESIGN_TOOL', 'DEVELOPMENT_TOOL', 'AI_CODING_TOOL', 'ANALYTICS', 'OTHER'];
const serviceStatuses = ['ACTIVE', 'TRIAL', 'PAYMENT_DUE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'UNKNOWN'];
const criticalities = ['CRITICAL', 'IMPORTANT', 'OPTIONAL'];
const billingCycles = ['MONTHLY', 'YEARLY', 'PAY_AS_YOU_GO', 'FREE', 'UNKNOWN'];

function useLocale() {
  const params = useParams<{ locale?: string; id?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function localized(locale: string, href: string) {
  return `/${locale}${href}`;
}

function Badge({ value }: { value: string }) {
  const color =
    value === 'READY' || value === 'LIVE' || value === 'PASSED' || value === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'CRITICAL' || value === 'BLOCKED' || value === 'PAST_DUE' || value === 'SUSPENDED'
        ? 'bg-red-50 text-red-700'
        : value === 'WARNING' || value === 'PAYMENT_DUE' || value === 'NEEDS_ATTENTION'
          ? 'bg-amber-50 text-amber-700'
          : value === 'TRIAL' || value === 'IN_PROGRESS'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{value}</span>;
}

function Shell({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-2 text-slate-600">{subtitle}</p>
          </div>
          {action}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function Kpi({ label, value, icon: Icon, tone = 'emerald' }: { label: string; value: ReactNode; icon: any; tone?: 'emerald' | 'amber' | 'red' | 'slate' }) {
  const colors = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', slate: 'bg-slate-100 text-slate-700' };
  return <div className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><span className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p></div>;
}

export function LaunchOverviewPage() {
  const locale = useLocale();
  const [data, setData] = useState<any>(null);
  useEffect(() => { launchApi.overview().then((res) => setData(res.data)); }, []);
  if (!data) return <Shell title="Go-Live Control Center" subtitle="Se incarca..."><div className="rounded-lg bg-white p-5">Se incarca...</div></Shell>;
  const summary = data.summary || {};
  return (
    <Shell title="Go-Live Control Center" subtitle="Verifica daca Espace este pregatit pentru lansare si daca toate serviciile critice sunt active.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Readiness score" value={`${data.readinessScore}/100`} icon={Gauge} tone={data.readinessScore >= 90 ? 'emerald' : data.readinessScore >= 70 ? 'amber' : 'red'} />
        <Kpi label="Critical blockers" value={summary.criticalBlockers || 0} icon={AlertTriangle} tone={summary.criticalBlockers ? 'red' : 'emerald'} />
        <Kpi label="Warnings" value={summary.warnings || 0} icon={AlertTriangle} tone="amber" />
        <Kpi label="Cost lunar estimat" value={`${summary.monthlyEstimatedCost || 0} ${summary.currency || 'USD'}`} icon={CreditCard} tone="slate" />
        <Kpi label="Missing ENV" value={summary.missingEnvVars || 0} icon={Server} tone={summary.missingEnvVars ? 'red' : 'emerald'} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">Launch checklist summary</h2><Link href={localized(locale, '/superadmin/launch/checklist')} className="text-sm font-semibold text-emerald-700">Deschide</Link></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(data.checklistSummary || []).map((item: any) => <div key={item.category} className="rounded-md bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span>{item.category}</span><span className="font-semibold">{item.passed}/{item.total}</span></div>{item.blockers ? <p className="mt-1 text-red-600">{item.blockers} blocate</p> : null}</div>)}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Go-live decision</h2>
          <div className="mt-3"><Badge value={data.status} /></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">Aceasta consola nu porneste deploy-uri, plati sau servicii externe. Este un control administrativ de lansare.</p>
          <Link href={localized(locale, '/superadmin/launch/go-live')} className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Deschide decizia <Rocket className="h-4 w-4" /></Link>
        </section>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/launch/services')}>Servicii platforma</Link>
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/launch/costs')}>Costuri lunare</Link>
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/launch/env')}>Environment diagnostics</Link>
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/launch/deployments')}>Deployments</Link>
      </div>
    </Shell>
  );
}

export function LaunchChecklistPage() {
  const [data, setData] = useState<any>(null);
  const load = () => launchApi.checklist().then((res) => setData(res.data));
  useEffect(() => { load(); }, []);
  const update = (id: string, status: string) => launchApi.updateChecklistItem(id, { status }).then(load);
  return (
    <Shell title="Launch readiness checklist" subtitle="Checklist pe categorii pentru lansarea Espace." action={<button onClick={() => launchApi.runChecklist().then(load)} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Ruleaza checks</button>}>
      <div className="space-y-4">
        {(data?.grouped || []).map((group: any) => (
          <section key={group.category} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">{group.category}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {group.items.map((item: any) => <div key={item.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"><div><p className="font-medium text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.description}</p></div><div className="flex items-center gap-2"><Badge value={item.severity} /><select value={item.status} onChange={(e) => update(item.id, e.target.value)} className="h-9 rounded-md border border-slate-200 px-2 text-sm"><option>NOT_STARTED</option><option>IN_PROGRESS</option><option>PASSED</option><option>WARNING</option><option>BLOCKED</option><option>NOT_APPLICABLE</option></select></div></div>)}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

export function LaunchServicesPage() {
  const locale = useLocale();
  const [data, setData] = useState<any>({ items: [] });
  const [filters, setFilters] = useState({ search: '', type: '', status: '', criticality: '', dueSoon: '' });
  const load = () => launchApi.services(filters).then((res) => setData(res.data));
  useEffect(() => { load(); }, [filters.type, filters.status, filters.criticality, filters.dueSoon]);
  return (
    <Shell title="Servicii platforma" subtitle="Urmareste aplicatiile si serviciile externe necesare pentru functionarea Espace." action={<Link href={localized(locale, '/superadmin/launch/services/new')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Serviciu nou</Link>}>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <input placeholder="Cauta" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm md:col-span-2" />
          <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Tip</option>{serviceTypes.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Status</option>{serviceStatuses.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filters.criticality} onChange={(e) => setFilters((p) => ({ ...p, criticality: e.target.value }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">Criticitate</option>{criticalities.map((x) => <option key={x}>{x}</option>)}</select>
          <button onClick={load} className="rounded-md border border-slate-200 px-3 text-sm font-semibold">Refresh</button>
        </div>
      </div>
      <ServiceTable items={data.items || []} locale={locale} />
    </Shell>
  );
}

function ServiceTable({ items, locale }: { items: any[]; locale: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Serviciu</th><th className="p-3">Tip</th><th className="p-3">Criticitate</th><th className="p-3">Status</th><th className="p-3">Cost lunar</th><th className="p-3">Next payment</th><th className="p-3">Actiuni</th></tr></thead>
        <tbody>{items.length === 0 ? <tr><td colSpan={7} className="p-4 text-slate-500">Nu exista servicii.</td></tr> : items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3 font-medium">{item.name}<p className="text-xs text-slate-500">{item.providerName}</p></td><td className="p-3">{item.type}</td><td className="p-3"><Badge value={item.criticality} /></td><td className="p-3"><Badge value={item.status} /></td><td className="p-3">{item.estimatedMonthlyCost ?? '-'} {item.currency}</td><td className="p-3">{item.nextPaymentDate ? new Date(item.nextPaymentDate).toLocaleDateString('ro-RO') : '-'}</td><td className="p-3"><Link href={localized(locale, `/superadmin/launch/services/${item.id}`)} className="font-semibold text-emerald-700">Deschide</Link></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ServiceForm({ initial }: { initial?: any }) {
  const router = useRouter();
  const locale = useLocale();
  const [form, setForm] = useState({
    name: initial?.name || '',
    providerName: initial?.providerName || '',
    type: initial?.type || 'OTHER',
    purpose: initial?.purpose || '',
    criticality: initial?.criticality || 'IMPORTANT',
    status: initial?.status || 'UNKNOWN',
    billingCycle: initial?.billingCycle || 'UNKNOWN',
    currency: initial?.currency || 'USD',
    estimatedMonthlyCost: initial?.estimatedMonthlyCost || '',
    estimatedYearlyCost: initial?.estimatedYearlyCost || '',
    nextPaymentDate: initial?.nextPaymentDate ? initial.nextPaymentDate.slice(0, 10) : '',
    renewalDate: initial?.renewalDate ? initial.renewalDate.slice(0, 10) : '',
    accountEmail: initial?.accountEmail || '',
    dashboardUrl: initial?.dashboardUrl || '',
    documentationUrl: initial?.documentationUrl || '',
    managedBy: initial?.managedBy || '',
    environmentKeys: Array.isArray(initial?.environmentKeys) ? initial.environmentKeys.join('\n') : '',
    dependsOn: Array.isArray(initial?.dependsOn) ? initial.dependsOn.join('\n') : '',
    impactIfDown: initial?.impactIfDown || '',
    notes: initial?.notes || '',
    isRequiredForLaunch: Boolean(initial?.isRequiredForLaunch),
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      estimatedMonthlyCost: form.estimatedMonthlyCost ? Number(form.estimatedMonthlyCost) : undefined,
      estimatedYearlyCost: form.estimatedYearlyCost ? Number(form.estimatedYearlyCost) : undefined,
      nextPaymentDate: form.nextPaymentDate || undefined,
      renewalDate: form.renewalDate || undefined,
      environmentKeys: form.environmentKeys.split('\n').map((x: string) => x.trim()).filter(Boolean),
      dependsOn: form.dependsOn.split('\n').map((x: string) => x.trim()).filter(Boolean),
      description: undefined,
    };
    if (initial?.id) await launchApi.updateService(initial.id, payload);
    else await launchApi.createService(payload);
    router.push(localized(locale, '/superadmin/launch/services'));
  };
  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input required placeholder="Provider" value={form.providerName} onChange={(e) => setForm((p) => ({ ...p, providerName: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{serviceTypes.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={form.criticality} onChange={(e) => setForm((p) => ({ ...p, criticality: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{criticalities.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{serviceStatuses.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={form.billingCycle} onChange={(e) => setForm((p) => ({ ...p, billingCycle: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{billingCycles.map((x) => <option key={x}>{x}</option>)}</select>
        <input placeholder="Currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Cost lunar estimat" value={form.estimatedMonthlyCost} onChange={(e) => setForm((p) => ({ ...p, estimatedMonthlyCost: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder="Cost anual estimat" value={form.estimatedYearlyCost} onChange={(e) => setForm((p) => ({ ...p, estimatedYearlyCost: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="date" value={form.nextPaymentDate} onChange={(e) => setForm((p) => ({ ...p, nextPaymentDate: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="date" value={form.renewalDate} onChange={(e) => setForm((p) => ({ ...p, renewalDate: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Account email" value={form.accountEmail} onChange={(e) => setForm((p) => ({ ...p, accountEmail: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Dashboard URL" value={form.dashboardUrl} onChange={(e) => setForm((p) => ({ ...p, dashboardUrl: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Documentation URL" value={form.documentationUrl} onChange={(e) => setForm((p) => ({ ...p, documentationUrl: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <textarea required placeholder="Purpose" value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} className="mt-4 min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      <textarea required placeholder="Impact if down" value={form.impactIfDown} onChange={(e) => setForm((p) => ({ ...p, impactIfDown: e.target.value }))} className="mt-4 min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <textarea placeholder="ENV keys, unul pe linie. Nu pune valori/secrete." value={form.environmentKeys} onChange={(e) => setForm((p) => ({ ...p, environmentKeys: e.target.value }))} className="min-h-[120px] rounded-md border border-slate-200 p-3 font-mono text-sm" />
        <textarea placeholder="Depends on, unul pe linie" value={form.dependsOn} onChange={(e) => setForm((p) => ({ ...p, dependsOn: e.target.value }))} className="min-h-[120px] rounded-md border border-slate-200 p-3 text-sm" />
      </div>
      <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="mt-4 min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isRequiredForLaunch} onChange={(e) => setForm((p) => ({ ...p, isRequiredForLaunch: e.target.checked }))} /> Required for launch</label>
      <button className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Salveaza</button>
    </form>
  );
}

export function LaunchServiceNewPage() {
  return <Shell title="Serviciu platforma nou" subtitle="Nu salva parole, API keys sau tokenuri brute."><ServiceForm /></Shell>;
}

export function LaunchServiceEditPage() {
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<any>(null);
  useEffect(() => { if (params?.id) launchApi.getService(params.id).then((res) => setService(res.data)); }, [params?.id]);
  return <Shell title="Editeaza serviciu" subtitle="Actualizeaza status, costuri si date de plata.">{service ? <ServiceForm initial={service} /> : <div className="rounded-lg bg-white p-5">Se incarca...</div>}</Shell>;
}

export function LaunchServiceDetailPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<any>(null);
  const [payment, setPayment] = useState({ amount: '', currency: 'USD', paymentDate: '', nextPaymentDate: '', note: '' });
  const load = () => {
    if (!params?.id) return;
    launchApi.getService(params.id).then((res) => setService(res.data));
  };
  useEffect(() => { load(); }, [params?.id]);
  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!service) return;
    await launchApi.recordPayment(service.id, { ...payment, amount: payment.amount ? Number(payment.amount) : undefined });
    setPayment({ amount: '', currency: service.currency || 'USD', paymentDate: '', nextPaymentDate: '', note: '' });
    load();
  };
  if (!service) return <Shell title="Serviciu platforma" subtitle="Se incarca..."><div className="rounded-lg bg-white p-5">Se incarca...</div></Shell>;
  return (
    <Shell title={service.name} subtitle={`${service.providerName} - ${service.purpose}`} action={<Link href={localized(locale, `/superadmin/launch/services/${service.id}/edit`)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Editeaza</Link>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-2"><Badge value={service.criticality} /><Badge value={service.status} /><Badge value={service.billingCycle} /></div>
          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <div><dt className="text-sm text-slate-500">Cost lunar</dt><dd className="font-semibold">{service.estimatedMonthlyCost ?? '-'} {service.currency}</dd></div>
            <div><dt className="text-sm text-slate-500">Urmatoarea plata</dt><dd className="font-semibold">{service.nextPaymentDate ? new Date(service.nextPaymentDate).toLocaleDateString('ro-RO') : '-'}</dd></div>
            <div><dt className="text-sm text-slate-500">Account email</dt><dd>{service.accountEmail || '-'}</dd></div>
            <div><dt className="text-sm text-slate-500">Managed by</dt><dd>{service.managedBy || '-'}</dd></div>
          </dl>
          <h3 className="mt-6 font-semibold">ENV keys</h3>
          <div className="mt-2 flex flex-wrap gap-2">{(service.environmentKeys || []).map((key: string) => <span key={key} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs">{key}</span>)}</div>
          <h3 className="mt-6 font-semibold">Impact if down</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{service.impactIfDown}</p>
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">Backup relevance & recovery impact</h3>
            <p className="mt-2 text-sm leading-6 text-amber-800">Serviciile critice trebuie incluse in planul de recovery. Pentru database, hosting, domain, DNS si source control, verifica runbook-urile si backup checks in Backup & Recovery.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={localized(locale, '/superadmin/backup/recovery-plan')} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-amber-800">Runbooks</Link>
              <Link href={localized(locale, '/superadmin/backup/backup-checks')} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-amber-800">Backup checks</Link>
            </div>
          </div>
          {service.dashboardUrl ? <a href={service.dashboardUrl} target="_blank" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">Dashboard extern <ExternalLink className="h-4 w-4" /></a> : null}
        </section>
        <aside className="space-y-4">
          <form onSubmit={submitPayment} className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Marcheaza achitat</h3>
            <input type="number" placeholder="Amount" value={payment.amount} onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            <input placeholder="Currency" value={payment.currency} onChange={(e) => setPayment((p) => ({ ...p, currency: e.target.value }))} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            <input type="date" value={payment.paymentDate} onChange={(e) => setPayment((p) => ({ ...p, paymentDate: e.target.value }))} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            <input type="date" value={payment.nextPaymentDate} onChange={(e) => setPayment((p) => ({ ...p, nextPaymentDate: e.target.value }))} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            <textarea placeholder="Note" value={payment.note} onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))} className="mt-3 min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
            <button className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Inregistreaza plata</button>
          </form>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Timeline</h3>
            <div className="mt-3 space-y-3 text-sm">{(service.paymentEvents || []).map((event: any) => <div key={event.id} className="border-l-2 border-slate-200 pl-3"><p className="font-medium">{event.eventType}</p><p className="text-slate-500">{event.amount || ''} {event.currency || ''} {event.paymentDate ? new Date(event.paymentDate).toLocaleDateString('ro-RO') : ''}</p><p className="text-slate-500">{event.note}</p></div>)}</div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

export function LaunchCostsPage() {
  const locale = useLocale();
  const [data, setData] = useState<any>(null);
  useEffect(() => { launchApi.costs().then((res) => setData(res.data)); }, []);
  if (!data) return <Shell title="Costuri lunare platforma" subtitle="Se incarca..."><div className="rounded-lg bg-white p-5">Se incarca...</div></Shell>;
  return (
    <Shell title="Costuri lunare platforma" subtitle="Vezi serviciile care trebuie achitate ca Espace sa functioneze.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Cost lunar estimat" value={`${data.monthlyEstimatedCost} ${data.currency}`} icon={CreditCard} />
        <Kpi label="Cost anual estimat" value={`${data.yearlyEstimatedCost} ${data.currency}`} icon={CreditCard} />
        <Kpi label="De achitat in 7 zile" value={data.dueSoon?.length || 0} icon={AlertTriangle} tone="amber" />
        <Kpi label="Restante" value={data.overdue?.length || 0} icon={AlertTriangle} tone={data.overdue?.length ? 'red' : 'emerald'} />
      </div>
      <ServiceTable items={data.services || []} locale={locale} />
    </Shell>
  );
}

export function LaunchEnvPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { launchApi.env().then((res) => setData(res.data)); }, []);
  return (
    <Shell title="Environment diagnostics" subtitle="Nu afisam valori secrete, doar status present/missing.">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Environment: <span className="font-semibold text-slate-950">{data?.environment || '-'}</span></p>
        <div className="mt-4 divide-y divide-slate-100">{(data?.items || []).map((item: any) => <div key={item.key} className="flex items-center justify-between py-3"><div><p className="font-mono text-sm">{item.key}</p><p className="text-xs text-slate-500">{item.service}</p></div><Badge value={item.status} /></div>)}</div>
      </div>
    </Shell>
  );
}

export function LaunchDeploymentsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { launchApi.deployments().then((res) => setData(res.data)); }, []);
  return (
    <Shell title="Deployment diagnostics" subtitle="Verificari manuale pentru Vercel, Render, Supabase si GitHub.">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">Expected</h2><pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{JSON.stringify(data?.expected || {}, null, 2)}</pre></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">Current metadata</h2><pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{JSON.stringify(data?.current || {}, null, 2)}</pre></section>
      </div>
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">Manual checklist</h2><div className="mt-3 space-y-2">{(data?.checklist || []).map((item: string) => <p key={item} className="text-sm text-slate-600">- {item}</p>)}</div></section>
    </Shell>
  );
}

export function LaunchGoLivePage() {
  const [data, setData] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const load = () => launchApi.goLive().then((res) => setData(res.data));
  useEffect(() => { load(); }, []);
  const markReady = () => launchApi.markReady({ confirmed, notes }).then(load);
  const markLive = () => launchApi.markLive({ confirmed, notes }).then(load);
  return (
    <Shell title="Go-live decision" subtitle="Marcheaza administrativ platforma ca pregatita pentru lansare.">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Readiness score</p>
          <p className="mt-2 text-6xl font-semibold text-slate-950">{data?.readinessScore ?? '-'}/100</p>
          <div className="mt-4"><Badge value={data?.status || 'UNKNOWN'} /></div>
          <h3 className="mt-6 font-semibold">Blockers</h3>
          <div className="mt-3 space-y-2">{(data?.blockers || []).length === 0 ? <p className="text-sm text-slate-500">Nu exista blockere critice detectate.</p> : data.blockers.map((item: any) => <p key={item.id} className="rounded-md bg-red-50 p-3 text-sm text-red-700">{item.title}</p>)}</div>
        </section>
        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Confirmare</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Aceasta actiune marcheaza platforma ca pregatita pentru lansare. Nu porneste automat plati, deploy-uri sau servicii externe.</p>
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" /> Confirm ca am verificat checklist-ul si serviciile critice.</label>
          <textarea placeholder="Note" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-4 min-h-[90px] w-full rounded-md border border-slate-200 p-3 text-sm" />
          <button disabled={!confirmed} onClick={markReady} className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark as Go-Live Ready</button>
          <button disabled={!confirmed} onClick={markLive} className="mt-3 w-full rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">Mark LIVE</button>
        </aside>
      </div>
    </Shell>
  );
}
