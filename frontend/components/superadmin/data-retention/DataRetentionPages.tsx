'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Archive, FileLock2, Gavel, RefreshCw, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { dataRetentionApi } from '@/lib/api';

function Badge({ value }: { value?: string | boolean }) {
  const text = String(value ?? 'UNKNOWN');
  const color = text.includes('KEEP') || text === 'false' || text === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : text.includes('ARCHIVE') || text.includes('WARNING') || text === 'NEW'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : text.includes('FORBIDDEN') || text === 'true'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${color}`}>{text}</span>;
}

function Shell({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Espace Superadmin</p>
            <h1 className="text-3xl font-bold text-slate-950">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          </div>
          {action}
        </div>
        <nav className="mb-6 flex flex-wrap gap-2 text-sm">
          {[
            ['/ro/superadmin/data-retention', 'Overview'],
            ['/ro/superadmin/data-retention/policies', 'Policies'],
            ['/ro/superadmin/data-retention/archive', 'Archive Center'],
            ['/ro/superadmin/data-retention/legal-holds', 'Legal Holds'],
            ['/ro/superadmin/data-retention/deletion-requests', 'Deletion Requests'],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:border-emerald-300">{label}</Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}

function Kpi({ title, value, icon: Icon }: { title: string; value: ReactNode; icon: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{title}</p><Icon className="h-5 w-5 text-emerald-600" /></div>
      <div className="mt-3 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

export function DataRetentionOverviewPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { dataRetentionApi.overview().then((res) => setData(res.data)); }, []);
  if (!data) return <Shell title="Data Retention" subtitle="Se încarcă politicile de retenție."><Skeleton /></Shell>;
  return (
    <Shell title="Data Retention" subtitle="Controlează politicile de păstrare, arhivare și protecție a datelor în Espace.">
      <section className="grid gap-4 md:grid-cols-4">
        <Kpi title="Politici active" value={data.summary.activePolicies} icon={FileLock2} />
        <Kpi title="Entități protejate" value={data.summary.protectedEntities} icon={ShieldAlert} />
        <Kpi title="Arhivări recente" value={data.summary.recentArchives} icon={Archive} />
        <Kpi title="Legal holds active" value={data.summary.legalHoldsActive} icon={Gavel} />
      </section>
      <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
        <h2 className="font-bold text-red-900">Hard delete este blocat în producție</h2>
        <p className="mt-2 text-sm text-red-800">Facturile, plățile, audit log-ul, indicii aprobați și evenimentele critice sunt păstrate. Folosește arhivarea sau cereri controlate de retention.</p>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Arhivări recente" empty="Nu există date arhivate."><ArchiveTable items={data.archiveRecords || []} /></Card>
        <Card title="Politici protejate" empty="Nu există politici configurate."><PolicyTable items={data.protectedPolicies || []} compact /></Card>
      </section>
    </Shell>
  );
}

export function RetentionPoliciesPage() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const load = useCallback(() => dataRetentionApi.policies({ search }).then((res) => setData(res.data)), [search]);
  useEffect(() => { load(); }, [load]);
  return (
    <Shell title="Retention Policies" subtitle="Politici system pentru păstrare, arhivare și blocarea hard delete." action={<button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Refresh</button>}>
      <div className="mb-4 flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută politici..." className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" /><button onClick={load} className="rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold">Caută</button></div>
      <Card title="Politici" empty="Nu există politici configurate."><PolicyTable items={data?.items || []} /></Card>
    </Shell>
  );
}

export function RetentionPolicyDetailsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const load = useCallback(() => dataRetentionApi.policy(params.id).then((res) => { setData(res.data); setNotes(res.data.policy?.notes || ''); }), [params.id]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Shell title="Retention policy" subtitle="Se încarcă politica."><Skeleton /></Shell>;
  const policy = data.policy;
  return (
    <Shell title={policy.title} subtitle={policy.description}>
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-2"><Badge value={policy.entityType} /><Badge value={policy.retentionAction} /><Badge value={`hardDelete=${policy.hardDeleteAllowed}`} /></div>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <Info label="Archive allowed" value={String(policy.archiveAllowed)} />
            <Info label="Restore allowed" value={String(policy.restoreAllowed)} />
            <Info label="Anonymization" value={String(policy.anonymizationAllowed)} />
            <Info label="Legal hold" value={String(policy.legalHoldSupported)} />
          </dl>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-5 min-h-32 w-full rounded-md border border-slate-200 p-3 text-sm" placeholder="Note interne..." />
          <button onClick={() => dataRetentionApi.updatePolicy(policy.id, { notes }).then(load)} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Salvează note</button>
        </div>
        <Card title="Archive records" empty="Nu există arhivări pentru această politică."><ArchiveTable items={data.archiveRecords || []} /></Card>
      </section>
    </Shell>
  );
}

export function RetentionArchivePage() {
  const [data, setData] = useState<any>(null);
  const load = () => dataRetentionApi.archive().then((res) => setData(res.data));
  useEffect(() => { load(); }, []);
  return <Shell title="Archive Center" subtitle="Toate arhivările logice din platformă." action={<button onClick={load} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Refresh</button>}><Card title="Archive records" empty="Nu există date arhivate."><ArchiveTable items={data?.items || []} onRestore={load} /></Card></Shell>;
}

export function RetentionArchiveDetailsPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [reason, setReason] = useState('');
  const load = useCallback(() => dataRetentionApi.archiveRecord(params.id).then((res) => setItem(res.data)), [params.id]);
  useEffect(() => { load(); }, [load]);
  if (!item) return <Shell title="Archive record" subtitle="Se încarcă arhivarea."><Skeleton /></Shell>;
  return (
    <Shell title={item.entityDisplayName || item.entityId} subtitle="Detalii arhivare și timeline retention.">
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-2"><Badge value={item.entityType} /><Badge value={item.status} /></div>
          <p className="mt-4 text-sm text-slate-600">{item.archiveReason}</p>
          {item.canRestore && <div className="mt-5 flex gap-2"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motiv restaurare" className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" /><button onClick={() => dataRetentionApi.restoreArchive(item.id, { reason }).then(load)} className="rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white">Restore</button></div>}
        </div>
        <Card title="Events" empty="Nu există evenimente."><ul className="space-y-2 text-sm">{(item.events || []).map((event: any) => <li key={event.id} className="rounded-md border border-slate-100 p-3"><b>{event.title}</b><p className="text-slate-500">{event.message}</p></li>)}</ul></Card>
      </section>
    </Shell>
  );
}

export function LegalHoldsPage() {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ title: '', reason: '', associationId: '', entityType: '', entityId: '' });
  const load = () => dataRetentionApi.legalHolds().then((res) => setData(res.data));
  useEffect(() => { load(); }, []);
  const create = async () => { await dataRetentionApi.createLegalHold(Object.fromEntries(Object.entries(form).filter(([, v]) => v))); setForm({ title: '', reason: '', associationId: '', entityType: '', entityId: '' }); await load(); };
  return (
    <Shell title="Legal Holds" subtitle="Blochează arhivarea sau cererile sensibile pentru date aflate sub legal hold.">
      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Aplică legal hold</h2>
          {['title', 'reason', 'associationId', 'entityType', 'entityId'].map((key) => <input key={key} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={key} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />)}
          <button onClick={create} className="mt-4 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Aplică</button>
        </div>
        <Card title="Legal holds" empty="Nu există legal holds active."><LegalHoldTable items={data?.items || []} onChange={load} /></Card>
      </section>
    </Shell>
  );
}

export function DeletionRequestsPage() {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ requestType: 'DELETE', reason: '', associationId: '', entityType: '', entityId: '' });
  const load = () => dataRetentionApi.deletionRequests().then((res) => setData(res.data));
  useEffect(() => { load(); }, []);
  const create = async () => { await dataRetentionApi.createDeletionRequest(Object.fromEntries(Object.entries(form).filter(([, v]) => v))); setForm({ requestType: 'DELETE', reason: '', associationId: '', entityType: '', entityId: '' }); await load(); };
  return (
    <Shell title="Deletion & anonymization requests" subtitle="Cereri înregistrate manual. Execuția nu este automată în ES-147.">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Execuția ștergerii/anonymizării nu este automată în acest task.</section>
      <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Cerere nouă</h2>
          <select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"><option>DELETE</option><option>ANONYMIZE</option><option>EXPORT</option><option>CORRECT</option></select>
          {['reason', 'associationId', 'entityType', 'entityId'].map((key) => <input key={key} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={key} className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />)}
          <button onClick={create} className="mt-4 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Înregistrează</button>
        </div>
        <Card title="Cereri" empty="Nu există cereri de ștergere/anonymizare."><DeletionTable items={data?.items || []} onChange={load} /></Card>
      </section>
    </Shell>
  );
}

function Card({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-950">{title}</h2><div className="mt-4">{children || <p className="text-sm text-slate-500">{empty}</p>}</div></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-900">{value}</dd></div>;
}

function PolicyTable({ items, compact = false }: { items: any[]; compact?: boolean }) {
  if (!items.length) return <p className="text-sm text-slate-500">Nu există politici configurate.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Entity</th><th className="p-2">Action</th>{!compact && <><th className="p-2">Archive</th><th className="p-2">Restore</th><th className="p-2">Hard delete</th></>}<th className="p-2">Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 font-semibold">{item.title}<p className="text-xs text-slate-500">{item.entityType}</p></td><td className="p-2"><Badge value={item.retentionAction} /></td>{!compact && <><td className="p-2"><Badge value={item.archiveAllowed} /></td><td className="p-2"><Badge value={item.restoreAllowed} /></td><td className="p-2"><Badge value={item.hardDeleteAllowed} /></td></>}<td className="p-2"><Link href={`/ro/superadmin/data-retention/policies/${item.id}`} className="font-semibold text-emerald-700">Deschide</Link></td></tr>)}</tbody></table></div>;
}

function ArchiveTable({ items, onRestore }: { items: any[]; onRestore?: () => void }) {
  if (!items.length) return <p className="text-sm text-slate-500">Nu există date arhivate.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Entitate</th><th className="p-2">Status</th><th className="p-2">Motiv</th><th className="p-2">Data</th><th className="p-2">Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 font-semibold">{item.entityDisplayName || item.entityId}<p className="text-xs text-slate-500">{item.entityType}</p></td><td className="p-2"><Badge value={item.status} /></td><td className="p-2 text-slate-600">{item.archiveReason}</td><td className="p-2">{item.archivedAt ? new Date(item.archivedAt).toLocaleDateString('ro-RO') : '-'}</td><td className="p-2"><div className="flex gap-2"><Link href={`/ro/superadmin/data-retention/archive/${item.id}`} className="font-semibold text-emerald-700">Detalii</Link>{onRestore && item.canRestore && <button onClick={() => { const reason = window.prompt('Motiv restaurare'); if (reason) dataRetentionApi.restoreArchive(item.id, { reason }).then(onRestore); }} className="inline-flex items-center gap-1 font-semibold text-blue-700"><RotateCcw className="h-3 w-3" /> Restore</button>}</div></td></tr>)}</tbody></table></div>;
}

function LegalHoldTable({ items, onChange }: { items: any[]; onChange: () => void }) {
  if (!items.length) return <p className="text-sm text-slate-500">Nu există legal holds active.</p>;
  return <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-md border border-slate-100 p-3 text-sm"><div className="flex items-center justify-between"><b>{item.title}</b><Badge value={item.status} /></div><p className="mt-1 text-slate-600">{item.reason}</p><p className="mt-1 text-xs text-slate-500">{item.entityType || 'ASSOCIATION'} {item.entityId || item.associationId || ''}</p>{item.status === 'ACTIVE' && <button onClick={() => { const reason = window.prompt('Motiv release'); if (reason) dataRetentionApi.releaseLegalHold(item.id, { reason }).then(onChange); }} className="mt-2 text-sm font-semibold text-emerald-700">Release</button>}</div>)}</div>;
}

function DeletionTable({ items, onChange }: { items: any[]; onChange: () => void }) {
  if (!items.length) return <p className="text-sm text-slate-500">Nu există cereri de ștergere/anonymizare.</p>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2"><Trash2 className="inline h-4 w-4 text-slate-400" /> {item.requestType}<p className="text-xs text-slate-500">{item.reason}</p></td><td className="p-2"><Badge value={item.status} /></td><td className="p-2"><select value={item.status} onChange={(e) => dataRetentionApi.updateDeletionRequestStatus(item.id, { status: e.target.value, decisionNote: 'Actualizat din UI.' }).then(onChange)} className="h-9 rounded-md border border-slate-200 px-2 text-xs"><option>NEW</option><option>IN_REVIEW</option><option>APPROVED</option><option>REJECTED</option><option>COMPLETED</option><option>CANCELLED</option></select></td></tr>)}</tbody></table></div>;
}

function Skeleton() {
  return <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-white" />)}</div>;
}
