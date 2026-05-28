'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle, Archive, Database, Download, Plus, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import { backupApi } from '@/lib/api';

const scopes = ['DATABASE', 'FILE_STORAGE', 'ENVIRONMENT_CONFIG', 'SOURCE_CODE', 'DEPLOYMENT_CONFIG', 'LEGAL_DOCS', 'EXPORTS', 'FULL_PLATFORM'];
const checkStatuses = ['NOT_CHECKED', 'PASSED', 'WARNING', 'FAILED', 'NOT_APPLICABLE'];
const drillStatuses = ['PLANNED', 'IN_PROGRESS', 'PASSED', 'PARTIAL', 'FAILED', 'CANCELLED'];
const incidentStatuses = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'];
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const scenarios = ['DATABASE_DOWN', 'BACKEND_DOWN', 'FRONTEND_DOWN', 'FAILED_DEPLOY', 'FAILED_MIGRATION', 'ACCIDENTAL_DATA_CHANGE', 'EXTERNAL_PROVIDER_DOWN', 'DOMAIN_DNS_ISSUE', 'SECURITY_INCIDENT', 'PAYMENT_PROVIDER_ISSUE', 'NOTIFICATION_PROVIDER_ISSUE'];

function useLocale() {
  const params = useParams<{ locale?: string; id?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function localized(locale: string, href: string) {
  return `/${locale}${href}`;
}

function Badge({ value }: { value?: string | null }) {
  const text = value || 'UNKNOWN';
  const color =
    ['READY', 'VERIFIED', 'PASSED', 'RESOLVED', 'CLOSED'].includes(text)
      ? 'bg-emerald-50 text-emerald-700'
      : ['CRITICAL', 'FAILED', 'OPEN', 'NOT_CONFIGURED'].includes(text)
        ? 'bg-red-50 text-red-700'
        : ['WARNING', 'PARTIALLY_READY', 'NEEDS_ATTENTION', 'HIGH', 'INVESTIGATING', 'MITIGATED', 'PARTIAL'].includes(text)
          ? 'bg-amber-50 text-amber-700'
          : ['PLANNED', 'IN_PROGRESS', 'MEDIUM'].includes(text)
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{text}</span>;
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

export function BackupOverviewPage() {
  const locale = useLocale();
  const [data, setData] = useState<any>(null);
  useEffect(() => { backupApi.overview().then((res) => setData(res.data)); }, []);
  if (!data) return <Shell title="Backup & Recovery" subtitle="Se incarca..."><div className="rounded-lg bg-white p-5">Se incarca...</div></Shell>;
  return (
    <Shell title="Backup & Recovery" subtitle="Monitorizeaza pregatirea pentru backup, restore si incidente de productie.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Backup readiness" value={`${data.readiness?.score || 0}/100`} icon={Archive} tone={(data.readiness?.score || 0) >= 90 ? 'emerald' : (data.readiness?.score || 0) >= 70 ? 'amber' : 'red'} />
        <Kpi label="Critical blockers" value={data.readiness?.criticalBlockers || 0} icon={AlertTriangle} tone={data.readiness?.criticalBlockers ? 'red' : 'emerald'} />
        <Kpi label="Backup checks" value={data.recentBackupChecks?.length || 0} icon={Database} tone="slate" />
        <Kpi label="Open incidents" value={data.openIncidents?.length || 0} icon={ShieldAlert} tone={data.openIncidents?.length ? 'red' : 'emerald'} />
        <Kpi label="Critical services" value={`${data.services?.criticalActive || 0}/${data.services?.criticalServices || 0}`} icon={Wrench} tone="amber" />
      </div>

      <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
        <h2 className="text-lg font-semibold text-red-900">Comenzi interzise in production</h2>
        <p className="mt-1 text-sm text-red-700">Aceste comenzi pot sterge date reale. Nu le rula in production.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">{(data.dangerousCommands || []).map((command: string) => <code key={command} className="rounded-md bg-white px-3 py-2 text-sm text-red-800">{command}</code>)}</div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">Backup strategy summary</h2><Badge value={data.readiness?.status} /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(data.checklistSummary || []).map((item: any) => <div key={item.category} className="rounded-md bg-slate-50 p-3 text-sm"><div className="flex justify-between"><span>{item.category}</span><span className="font-semibold">{item.passed}/{item.total}</span></div>{item.failed ? <p className="mt-1 text-red-600">{item.failed} esuate</p> : item.warnings ? <p className="mt-1 text-amber-600">{item.warnings} warnings</p> : null}</div>)}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Critical data map</h2>
          <div className="mt-3 space-y-3">{(data.criticalDataMap || []).map((item: any) => <div key={item.name} className="rounded-md border border-slate-100 p-3"><p className="font-medium">{item.name}</p><p className="text-sm text-slate-500">{item.reason}</p></div>)}</div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/backup/checklist')}>Backup checklist</Link>
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/backup/recovery-plan')}>Recovery plan</Link>
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/backup/backup-checks')}>Backup checks</Link>
        <Link className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200" href={localized(locale, '/superadmin/backup/incidents')}>Incidente</Link>
      </div>
    </Shell>
  );
}

export function BackupChecklistPage() {
  const [data, setData] = useState<any>(null);
  const load = () => backupApi.checklist().then((res) => setData(res.data));
  useEffect(() => { load(); }, []);
  const update = (id: string, status: string) => backupApi.updateChecklistItem(id, { status }).then(load);
  return (
    <Shell title="Backup checklist" subtitle="Verificari operationale pentru backup, restore, deployment si environment." action={<button onClick={() => backupApi.runChecklist().then(load)} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Ruleaza checks</button>}>
      <div className="space-y-4">{(data?.grouped || []).map((group: any) => (
        <section key={group.category} className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">{group.category}</h2>
          <div className="mt-4 divide-y divide-slate-100">{group.items.map((item: any) => <div key={item.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"><div><p className="font-medium text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.description}</p></div><div className="flex items-center gap-2"><Badge value={item.severity} /><select value={item.status} onChange={(event) => update(item.id, event.target.value)} className="h-9 rounded-md border border-slate-200 px-2 text-sm">{checkStatuses.map((status) => <option key={status}>{status}</option>)}</select></div></div>)}</div>
        </section>
      ))}</div>
    </Shell>
  );
}

export function RecoveryPlanPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { backupApi.recoveryPlan().then((res) => setData(res.data)); }, []);
  return (
    <Shell title="Recovery plan" subtitle="Runbooks pentru incidente production. Restore-ul automat nu este disponibil din UI.">
      <section className="rounded-lg border border-red-200 bg-red-50 p-5"><h2 className="font-semibold text-red-900">Nu rula reset in production</h2><div className="mt-3 flex flex-wrap gap-2">{(data?.dangerousCommands || []).map((command: string) => <code key={command} className="rounded-md bg-white px-2 py-1 text-xs text-red-800">{command}</code>)}</div></section>
      <div className="mt-6 space-y-4">{(data?.runbooks || []).map((runbook: any) => <section key={runbook.id} className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-950">{runbook.title}</h2><p className="text-sm text-slate-500">{runbook.description}</p></div><div className="flex gap-2"><Badge value={runbook.scenario} /><Badge value={runbook.severity} /></div></div><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">{(runbook.steps || []).map((step: string) => <li key={step}>{step}</li>)}</ol></section>)}</div>
    </Shell>
  );
}

export function BackupChecksPage() {
  const locale = useLocale();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { backupApi.backupChecks().then((res) => setItems(res.data)); }, []);
  return (
    <Shell title="Backup checks" subtitle="Ultimele verificari manuale de backup." action={<Link href={localized(locale, '/superadmin/backup/backup-checks/new')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Check nou</Link>}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">CheckedAt</th><th className="p-3">Scope</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3">Backup date</th><th className="p-3">Restore tested</th><th className="p-3">Notes</th></tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={7} className="p-4 text-slate-500">Nu exista verificari de backup.</td></tr> : items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3">{new Date(item.checkedAt).toLocaleString('ro-RO')}</td><td className="p-3">{item.scope}</td><td className="p-3"><Badge value={item.status} /></td><td className="p-3">{item.providerName || '-'}</td><td className="p-3">{item.backupDate ? new Date(item.backupDate).toLocaleDateString('ro-RO') : '-'}</td><td className="p-3">{item.restoreTested ? 'Da' : 'Nu'}</td><td className="p-3 text-slate-500">{item.notes || '-'}</td></tr>)}</tbody></table></div>
    </Shell>
  );
}

export function BackupCheckNewPage() {
  const router = useRouter();
  const locale = useLocale();
  const [form, setForm] = useState({ scope: 'DATABASE', status: 'PASSED', title: '', description: '', providerName: '', backupLocation: '', backupReference: '', backupDate: '', restoreTested: false, restoreTestedAt: '', notes: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await backupApi.createBackupCheck(form);
    router.push(localized(locale, '/superadmin/backup/backup-checks'));
  };
  return (
    <Shell title="Verificare backup noua" subtitle="Nu salva URL-uri secrete, dump-uri DB sau credentiale.">
      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <select value={form.scope} onChange={(event) => setForm((p) => ({ ...p, scope: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{scopes.map((scope) => <option key={scope}>{scope}</option>)}</select>
          <select value={form.status} onChange={(event) => setForm((p) => ({ ...p, status: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{checkStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          <input required placeholder="Titlu" value={form.title} onChange={(event) => setForm((p) => ({ ...p, title: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Provider" value={form.providerName} onChange={(event) => setForm((p) => ({ ...p, providerName: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
          <input type="date" value={form.backupDate} onChange={(event) => setForm((p) => ({ ...p, backupDate: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
          <input placeholder="Backup reference" value={form.backupReference} onChange={(event) => setForm((p) => ({ ...p, backupReference: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        </div>
        <textarea required placeholder="Descriere" value={form.description} onChange={(event) => setForm((p) => ({ ...p, description: event.target.value }))} className="mt-4 min-h-[90px] w-full rounded-md border border-slate-200 p-3 text-sm" />
        <textarea placeholder="Backup location descriptiv, fara URL secret" value={form.backupLocation} onChange={(event) => setForm((p) => ({ ...p, backupLocation: event.target.value }))} className="mt-4 min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.restoreTested} onChange={(event) => setForm((p) => ({ ...p, restoreTested: event.target.checked }))} /> Restore testat</label>
        {form.restoreTested ? <input type="date" value={form.restoreTestedAt} onChange={(event) => setForm((p) => ({ ...p, restoreTestedAt: event.target.value }))} className="mt-3 h-11 rounded-md border border-slate-200 px-3 text-sm" /> : null}
        <textarea placeholder="Notes" value={form.notes} onChange={(event) => setForm((p) => ({ ...p, notes: event.target.value }))} className="mt-4 min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
        <button className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Salveaza</button>
      </form>
    </Shell>
  );
}

export function RecoveryDrillsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { backupApi.recoveryDrills().then((res) => setItems(res.data)); }, []);
  return <Shell title="Recovery drills" subtitle="Documenteaza teste de recovery fara restore automat." action={<Link href={localized(locale, '/superadmin/backup/recovery-drills/new')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Drill nou</Link>}><CardListEmpty items={items} empty="Nu exista recovery drills." render={(item) => <Link key={item.id} href={localized(locale, `/superadmin/backup/recovery-drills/${item.id}`)} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200"><div className="flex items-center justify-between"><h2 className="font-semibold">{item.title}</h2><Badge value={item.status} /></div><p className="mt-2 text-sm text-slate-500">{item.scope} {item.scenario ? `- ${item.scenario}` : ''}</p></Link>} /></Shell>;
}

export function RecoveryDrillNewPage() {
  const router = useRouter();
  const locale = useLocale();
  const [form, setForm] = useState({ title: '', description: '', scope: 'DATABASE', scenario: 'DATABASE_DOWN', plannedAt: '', notes: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await backupApi.createRecoveryDrill(form);
    router.push(localized(locale, '/superadmin/backup/recovery-drills'));
  };
  return <Shell title="Recovery drill nou" subtitle="Planifica un test de recovery pe environment separat."><SimpleForm form={form} setForm={setForm} submit={submit} kind="drill" /></Shell>;
}

export function RecoveryDrillDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const load = () => {
    if (!params?.id) return Promise.resolve();
    return backupApi.getRecoveryDrill(params.id).then((res) => setItem(res.data));
  };
  useEffect(() => { load(); }, [params?.id]);
  const complete = (status: string) => {
    if (!item) return;
    return backupApi.completeRecoveryDrill(item.id, { status, resultSummary: `Marcat ${status} din UI.` }).then(() => load());
  };
  if (!item) return <Shell title="Recovery drill" subtitle="Se incarca..."><div className="rounded-lg bg-white p-5">Se incarca...</div></Shell>;
  return <Shell title={item.title} subtitle={item.description}><section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-wrap gap-2"><Badge value={item.status} /><Badge value={item.scope} /><Badge value={item.scenario} /></div><p className="mt-4 text-sm text-slate-600">{item.notes || 'Fara note.'}</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => backupApi.startRecoveryDrill(item.id).then(() => load())} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Start drill</button>{['PASSED', 'PARTIAL', 'FAILED', 'CANCELLED'].map((status) => <button key={status} onClick={() => complete(status)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">Mark {status}</button>)}</div></section></Shell>;
}

export function IncidentsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { backupApi.incidents().then((res) => setItems(res.data)); }, []);
  return <Shell title="Production incidents" subtitle="Incidente operationale si timeline." action={<Link href={localized(locale, '/superadmin/backup/incidents/new')} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Incident nou</Link>}><CardListEmpty items={items} empty="Nu exista incidente deschise." render={(item) => <Link key={item.id} href={localized(locale, `/superadmin/backup/incidents/${item.id}`)} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200"><div className="flex items-center justify-between"><h2 className="font-semibold">{item.title}</h2><div className="flex gap-2"><Badge value={item.severity} /><Badge value={item.status} /></div></div><p className="mt-2 text-sm text-slate-500">{new Date(item.startedAt).toLocaleString('ro-RO')}</p></Link>} /></Shell>;
}

export function IncidentNewPage() {
  const router = useRouter();
  const locale = useLocale();
  const [form, setForm] = useState({ title: '', description: '', severity: 'MEDIUM', affectedServices: '', startedAt: '' });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await backupApi.createIncident({ ...form, affectedServices: form.affectedServices.split('\n').map((x) => x.trim()).filter(Boolean) });
    router.push(localized(locale, '/superadmin/backup/incidents'));
  };
  return <Shell title="Incident nou" subtitle="Documenteaza incidentul fara a executa actiuni destructive."><SimpleForm form={form} setForm={setForm} submit={submit} kind="incident" /></Shell>;
}

export function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [message, setMessage] = useState('');
  const load = () => {
    if (!params?.id) return Promise.resolve();
    return backupApi.getIncident(params.id).then((res) => setItem(res.data));
  };
  useEffect(() => { load(); }, [params?.id]);
  const addUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    await backupApi.addIncidentUpdate(item.id, { message });
    setMessage('');
    load();
  };
  const setStatus = (status: string) => {
    if (!item) return;
    return backupApi.updateIncident(item.id, { status }).then(() => load());
  };
  if (!item) return <Shell title="Incident" subtitle="Se incarca..."><div className="rounded-lg bg-white p-5">Se incarca...</div></Shell>;
  return <Shell title={item.title} subtitle={item.description}><div className="grid gap-4 lg:grid-cols-[1fr_360px]"><section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex gap-2"><Badge value={item.severity} /><Badge value={item.status} /></div><h2 className="mt-6 font-semibold">Timeline</h2><div className="mt-3 space-y-3">{(item.updates || []).map((update: any) => <div key={update.id} className="border-l-2 border-slate-200 pl-3 text-sm"><p className="font-medium">{update.message}</p><p className="text-slate-500">{new Date(update.createdAt).toLocaleString('ro-RO')} {update.status || ''}</p></div>)}</div></section><aside className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">Actiuni</h2><div className="mt-3 grid gap-2">{incidentStatuses.map((status) => <button key={status} onClick={() => setStatus(status)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">Mark {status}</button>)}</div><form onSubmit={addUpdate} className="mt-5"><textarea required placeholder="Update" value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[90px] w-full rounded-md border border-slate-200 p-3 text-sm" /><button className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Add update</button></form></aside></div></Shell>;
}

export function ExportCenterPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { backupApi.exportCenter().then((res) => setData(res.data)); }, []);
  return <Shell title="Export center" subtitle="Exporturi administrative utile pentru recovery. Nu sunt dump-uri DB."><p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data?.note || 'Exporturile de recovery vor aparea aici dupa configurare.'}</p><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{(data?.items || []).map((item: any) => <div key={item.fileName} className="rounded-lg border border-slate-200 bg-white p-5"><Download className="h-5 w-5 text-slate-500" /><h2 className="mt-3 font-semibold">{item.title}</h2><p className="mt-1 font-mono text-xs text-slate-500">{item.fileName}</p><p className="mt-2 text-sm text-slate-600">{item.description}</p><Badge value={item.available ? 'AVAILABLE' : 'PLACEHOLDER'} /></div>)}</div></Shell>;
}

function CardListEmpty({ items, empty, render }: { items: any[]; empty: string; render: (item: any) => ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">{empty}</div> : items.map(render)}</div>;
}

function SimpleForm({ form, setForm, submit, kind }: { form: any; setForm: any; submit: (event: FormEvent) => void; kind: 'drill' | 'incident' }) {
  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <input required placeholder="Titlu" value={form.title} onChange={(event) => setForm((p: any) => ({ ...p, title: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        {kind === 'drill' ? <select value={form.scope} onChange={(event) => setForm((p: any) => ({ ...p, scope: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{scopes.map((scope) => <option key={scope}>{scope}</option>)}</select> : <select value={form.severity} onChange={(event) => setForm((p: any) => ({ ...p, severity: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{severities.map((severity) => <option key={severity}>{severity}</option>)}</select>}
        {kind === 'drill' ? <select value={form.scenario} onChange={(event) => setForm((p: any) => ({ ...p, scenario: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm">{scenarios.map((scenario) => <option key={scenario}>{scenario}</option>)}</select> : null}
        <input type="datetime-local" value={kind === 'drill' ? form.plannedAt : form.startedAt} onChange={(event) => setForm((p: any) => ({ ...p, [kind === 'drill' ? 'plannedAt' : 'startedAt']: event.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <textarea required placeholder="Descriere" value={form.description} onChange={(event) => setForm((p: any) => ({ ...p, description: event.target.value }))} className="mt-4 min-h-[100px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      {kind === 'incident' ? <textarea placeholder="Affected services, unul pe linie" value={form.affectedServices} onChange={(event) => setForm((p: any) => ({ ...p, affectedServices: event.target.value }))} className="mt-4 min-h-[90px] w-full rounded-md border border-slate-200 p-3 text-sm" /> : <textarea placeholder="Notes" value={form.notes} onChange={(event) => setForm((p: any) => ({ ...p, notes: event.target.value }))} className="mt-4 min-h-[90px] w-full rounded-md border border-slate-200 p-3 text-sm" />}
      <button className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Salveaza</button>
    </form>
  );
}
