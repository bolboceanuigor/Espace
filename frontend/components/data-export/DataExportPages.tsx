'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Download, FileJson, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { dataExportApi } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/runtime-config';
import { getToken } from '@/lib/auth';

type Scope = 'superadmin' | 'admin' | 'resident';

const requestTypes = ['ACCESS', 'PORTABILITY', 'CORRECTION', 'EXPORT', 'OTHER'];
const requestScopes = ['RESIDENT_PERSONAL_DATA', 'INVOICE_PAYMENT_DATA', 'METER_DATA', 'ACCOUNT_ACCESS_DATA', 'FULL_RESIDENT_EXPORT', 'ASSOCIATION_DATA', 'FULL_ASSOCIATION_EXPORT'];
const adminExportTypes = ['ASSOCIATION_APARTMENTS_EXPORT', 'ASSOCIATION_RESIDENTS_EXPORT', 'ASSOCIATION_FINANCIAL_EXPORT', 'ASSOCIATION_METERS_EXPORT', 'ASSOCIATION_FULL_EXPORT'];
const residentExportTypes = ['RESIDENT_PERSONAL_EXPORT', 'RESIDENT_FINANCIAL_EXPORT', 'RESIDENT_METER_EXPORT'];

function Badge({ value }: { value?: string }) {
  const text = value || 'UNKNOWN';
  const color = ['APPROVED', 'COMPLETED', 'READY'].includes(text)
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : ['FAILED', 'REJECTED'].includes(text)
      ? 'bg-red-50 text-red-700 border-red-200'
      : ['IN_REVIEW', 'WAITING_FOR_INFO', 'PROCESSING'].includes(text)
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${color}`}>{text}</span>;
}

function Shell({ scope, title, subtitle, children, action }: { scope: Scope; title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  const base = scope === 'superadmin' ? '/ro/superadmin' : scope === 'admin' ? '/ro/admin' : '/ro/resident';
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm font-semibold text-emerald-700">Espace {scope}</p><h1 className="text-3xl font-bold text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-600">{subtitle}</p></div>
          {action}
        </div>
        <nav className="mb-6 flex flex-wrap gap-2 text-sm">
          {scope !== 'resident' && <Link className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold" href={`${base}/data-exports`}>Exporturi</Link>}
          {scope !== 'superadmin' && scope !== 'resident' && <Link className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold" href={`${base}/data-exports/new`}>Export nou</Link>}
          <Link className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold" href={`${base}/data-requests`}>Cereri de date</Link>
          {scope === 'resident' && <Link className="rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold" href="/ro/resident/profile/data">Datele mele</Link>}
        </nav>
        {children}
      </div>
    </main>
  );
}

export function DataRequestsPage({ scope }: { scope: Scope }) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => {
    const api = scope === 'superadmin' ? dataExportApi.superadminRequests : scope === 'admin' ? dataExportApi.adminRequests : dataExportApi.residentRequests;
    return api().then((res) => setData(res.data));
  }, [scope]);
  useEffect(() => { load(); }, [load]);
  return (
    <Shell scope={scope} title="Cereri de date" subtitle="Acces, portabilitate, export și corectare date." action={<button onClick={load} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" /> Refresh</button>}>
      <Warning />
      {scope === 'resident' && <Link href="/ro/resident/data-requests/new" className="mb-4 mt-4 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Cerere nouă</Link>}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">Cereri</h2>
        <RequestTable items={data?.items || []} scope={scope} onChange={load} />
      </section>
    </Shell>
  );
}

export function DataRequestDetailsPage({ scope, params }: { scope: Scope; params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [note, setNote] = useState('');
  const load = useCallback(() => {
    const api = scope === 'superadmin' ? dataExportApi.superadminRequest : scope === 'admin' ? dataExportApi.adminRequest : dataExportApi.residentRequest;
    return api(params.id).then((res) => setItem(res.data));
  }, [scope, params.id]);
  useEffect(() => { load(); }, [load]);
  if (!item) return <Shell scope={scope} title="Cerere de date" subtitle="Se încarcă..."><Skeleton /></Shell>;
  return (
    <Shell scope={scope} title={item.title} subtitle={item.message}>
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-2"><Badge value={item.type} /><Badge value={item.scope} /><Badge value={item.status} /></div>
          {item.retentionWarning && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{item.retentionWarning}</div>}
          <p className="mt-4 text-sm text-slate-600">{item.reason || 'Fără motiv separat.'}</p>
          {scope !== 'resident' && <div className="mt-5 flex flex-wrap gap-2">
            {['IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'].map((status) => <button key={status} onClick={() => dataExportApi[scope === 'superadmin' ? 'superadminUpdateRequestStatus' : 'adminUpdateRequestStatus'](item.id, { status, decisionNote: note || `Marcat ${status}` }).then(load)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">{status}</button>)}
            {scope === 'superadmin' && <button onClick={() => dataExportApi.superadminCreateExportForRequest(item.id).then(load)} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Creează export</button>}
          </div>}
          {scope !== 'resident' && <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note..." className="mt-4 min-h-24 w-full rounded-md border border-slate-200 p-3 text-sm" />}
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold">Export asociat</h2>{item.relatedExport ? <ExportCard item={item.relatedExport} scope={scope} /> : <p className="mt-3 text-sm text-slate-500">Nu există export asociat.</p>}</section>
      </section>
    </Shell>
  );
}

export function NewResidentDataRequestPage() {
  return <RequestForm scope="resident" />;
}

export function AdminDataExportsPage({ scope = 'admin' }: { scope?: 'admin' | 'superadmin' }) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(() => {
    const api = scope === 'superadmin' ? dataExportApi.superadminExports : dataExportApi.adminExports;
    return api().then((res) => setData(res.data));
  }, [scope]);
  useEffect(() => { load(); }, [load]);
  return (
    <Shell scope={scope} title="Exporturi date" subtitle="Exporturi controlate, autentificate și auditate." action={scope === 'admin' ? <Link href="/ro/admin/data-exports/new" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Export nou</Link> : undefined}>
      <Warning />
      <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold">Export jobs</h2><ExportTable items={data?.items || []} scope={scope} onChange={load} /></section>
    </Shell>
  );
}

export function NewAdminDataExportPage() {
  const [form, setForm] = useState({ exportType: 'ASSOCIATION_APARTMENTS_EXPORT', format: 'CSV' });
  const [created, setCreated] = useState<any>(null);
  const submit = async () => setCreated((await dataExportApi.adminCreateExport(form)).data);
  return (
    <Shell scope="admin" title="Export nou" subtitle="Alege datele și formatul exportului.">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Exportul poate conține date personale și financiare. Păstrează fișierul în siguranță.</section>
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <select value={form.exportType} onChange={(e) => setForm({ ...form, exportType: e.target.value })} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm">{adminExportTypes.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="mt-3 h-11 w-full rounded-md border border-slate-200 px-3 text-sm"><option>CSV</option><option>JSON</option></select>
        <button onClick={submit} className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Generează job</button>
        {created && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Export pregătit: <Link className="font-bold underline" href={`/ro/admin/data-exports/${created.id}`}>{created.fileName}</Link></div>}
      </section>
    </Shell>
  );
}

export function DataExportDetailsPage({ scope, params }: { scope: Scope; params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const load = useCallback(() => {
    const api = scope === 'superadmin' ? dataExportApi.superadminExport : scope === 'admin' ? dataExportApi.adminExport : dataExportApi.residentExport;
    return api(params.id).then((res) => setItem(res.data));
  }, [scope, params.id]);
  useEffect(() => { load(); }, [load]);
  if (!item) return <Shell scope={scope} title="Export" subtitle="Se încarcă..."><Skeleton /></Shell>;
  return (
    <Shell scope={scope} title={item.fileName} subtitle="Detalii export și timeline.">
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-2"><Badge value={item.exportType} /><Badge value={item.format} /><Badge value={item.status} /></div>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <Info label="Asociație" value={item.association?.name || item.associationId || '-'} />
            <Info label="Resident" value={item.resident ? `${item.resident.firstName} ${item.resident.lastName}` : '-'} />
            <Info label="Expires" value={item.expiresAt ? new Date(item.expiresAt).toLocaleString('ro-RO') : '-'} />
            <Info label="File size" value={item.fileSize ? `${item.fileSize} bytes` : 'generat la download'} />
          </dl>
          {item.status === 'READY' && <button onClick={() => downloadExport(scope, item.id)} className="mt-5 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4" /> Download</button>}
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold">Timeline</h2><ul className="mt-3 space-y-2 text-sm">{(item.events || []).map((event: any) => <li key={event.id} className="rounded-md border border-slate-100 p-3"><b>{event.title}</b><p className="text-slate-500">{event.message}</p></li>)}</ul></section>
      </section>
    </Shell>
  );
}

export function ResidentProfileDataPage() {
  return (
    <Shell scope="resident" title="Datele mele" subtitle="Vezi ce categorii de date pot exista în portalul tău.">
      <section className="grid gap-4 md:grid-cols-2">
        {['Profil și date contact', 'Apartamente asociate', 'Facturi și plăți', 'Contoare și indici', 'Solicitări și comentarii', 'Notificări in-app'].map((title) => <div key={title} className="rounded-lg border border-slate-200 bg-white p-5"><FileJson className="h-5 w-5 text-emerald-600" /><h2 className="mt-3 font-bold">{title}</h2><p className="mt-2 text-sm text-slate-500">Disponibil prin cerere de acces/export controlată.</p></div>)}
      </section>
      <div className="mt-5 flex flex-wrap gap-2"><Link href="/ro/resident/data-requests/new" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Cere exportul datelor mele</Link><Link href="/ro/resident/data-requests" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Vezi cererile mele</Link></div>
    </Shell>
  );
}

function RequestForm({ scope }: { scope: Scope }) {
  const [form, setForm] = useState({ type: 'ACCESS', scope: 'RESIDENT_PERSONAL_DATA', title: '', message: '', reason: '' });
  const [created, setCreated] = useState<any>(null);
  const submit = async () => setCreated((await dataExportApi.residentCreateRequest(form)).data);
  return (
    <Shell scope={scope} title="Cerere nouă" subtitle="Cererea va fi analizată de administrator/Superadmin.">
      <Warning />
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm">{requestTypes.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="mt-3 h-11 w-full rounded-md border border-slate-200 px-3 text-sm">{requestScopes.map((x) => <option key={x}>{x}</option>)}</select>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titlu" className="mt-3 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
        <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Mesaj" className="mt-3 min-h-32 w-full rounded-md border border-slate-200 p-3 text-sm" />
        <button onClick={submit} className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Trimite cererea</button>
        {created && <p className="mt-4 text-sm font-semibold text-emerald-700">Cererea a fost creată.</p>}
      </section>
    </Shell>
  );
}

function RequestTable({ items, scope, onChange }: { items: any[]; scope: Scope; onChange: () => void }) {
  if (!items.length) return <p className="mt-4 text-sm text-slate-500">Nu există cereri de date.</p>;
  const base = scope === 'superadmin' ? '/ro/superadmin' : scope === 'admin' ? '/ro/admin' : '/ro/resident';
  return <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3 font-semibold">{item.title}<p className="text-xs text-slate-500">{item.message}</p></td><td className="p-3"><Badge value={item.type} /></td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><Link href={`${base}/data-requests/${item.id}`} className="font-semibold text-emerald-700">Deschide</Link>{scope === 'resident' && item.status === 'NEW' && <button onClick={() => dataExportApi.residentCancelRequest(item.id, { reason: 'Anulată din portal.' }).then(onChange)} className="ml-3 font-semibold text-slate-600">Anulează</button>}</td></tr>)}</tbody></table></div>;
}

function ExportTable({ items, scope, onChange }: { items: any[]; scope: Scope; onChange: () => void }) {
  if (!items.length) return <p className="mt-4 text-sm text-slate-500">Nu există exporturi create.</p>;
  const base = scope === 'superadmin' ? '/ro/superadmin' : '/ro/admin';
  return <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3 font-semibold">{item.fileName}<p className="text-xs text-slate-500">{item.exportType}</p></td><td className="p-3"><Badge value={item.format} /></td><td className="p-3"><Badge value={item.status} /></td><td className="p-3"><Link href={`${base}/data-exports/${item.id}`} className="font-semibold text-emerald-700">Deschide</Link>{item.status === 'READY' && <button onClick={() => downloadExport(scope, item.id)} className="ml-3 font-semibold text-blue-700">Download</button>}</td></tr>)}</tbody></table></div>;
}

function ExportCard({ item, scope }: { item: any; scope: Scope }) {
  return <div className="mt-3 rounded-md border border-slate-100 p-3 text-sm"><div className="flex items-center gap-2"><FileText className="h-4 w-4" /><b>{item.fileName}</b></div><div className="mt-2 flex gap-2"><Badge value={item.status} /><Badge value={item.format} /></div>{item.status === 'READY' && <button onClick={() => downloadExport(scope, item.id)} className="mt-3 font-semibold text-blue-700">Download</button>}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-900">{value}</dd></div>;
}

function Warning() {
  return <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="mr-2 inline h-4 w-4" />Exporturile pot conține date personale sau financiare. Nu includ parole, tokenuri, JWT-uri sau API keys.</section>;
}

function Skeleton() {
  return <div className="h-32 animate-pulse rounded-lg bg-white" />;
}

async function downloadExport(scope: Scope, id: string) {
  const apiBase = getApiBaseUrl();
  const token = getToken();
  const prefix = scope === 'superadmin' ? 'superadmin' : scope === 'admin' ? 'admin' : 'resident';
  const response = await fetch(`${apiBase}/api/${prefix}/data-exports/${id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error('Download failed');
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `export-${id}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
