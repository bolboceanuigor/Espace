'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, RefreshCw, Send } from 'lucide-react';
import { notificationProvidersApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

function fmt(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function badgeClass(status?: string) {
  if (status === 'SENT' || status === 'DELIVERED' || status === 'OK' || status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'FAILED' || status === 'ERROR') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'PENDING' || status === 'QUEUED') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function Badge({ status }: { status?: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(status)}`}>{status || '—'}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function Header({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</div>;
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">{children}</Link>;
}

export function SuperadminNotificationsOverviewPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  useEffect(() => { notificationProvidersApi.overview().then((res) => setData(res.data ?? res)).catch(() => undefined); }, []);
  const kpi = data?.kpi || {};
  return (
    <div className="space-y-5 bg-slate-50">
      <Header title="Notificări" subtitle="Monitorizează providerii, templates și livrările email/SMS." actions={<><ButtonLink href={localizedPath('/superadmin/notifications/providers')}>Provideri</ButtonLink><ButtonLink href={localizedPath('/superadmin/notifications/templates')}>Templates</ButtonLink><ButtonLink href={localizedPath('/superadmin/notifications/deliveries')}>Livrări</ButtonLink></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Emailuri trimise azi</p><p className="mt-2 text-2xl font-semibold">{kpi.emailSentToday || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">SMS-uri trimise azi</p><p className="mt-2 text-2xl font-semibold">{kpi.smsSentToday || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Failed deliveries</p><p className="mt-2 text-2xl font-semibold">{kpi.failed || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Skipped deliveries</p><p className="mt-2 text-2xl font-semibold">{kpi.skipped || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Email provider</p><div className="mt-2"><Badge status={kpi.emailProvider?.status} /></div></Card>
        <Card><p className="text-sm text-slate-500">SMS provider</p><div className="mt-2"><Badge status={kpi.smsProvider?.status} /></div></Card>
        <Card><p className="text-sm text-slate-500">Templates active</p><p className="mt-2 text-2xl font-semibold">{kpi.templatesActive || 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Ultima eroare</p><p className="mt-2 truncate text-sm font-semibold">{kpi.lastError || '—'}</p></Card>
      </div>
      <DeliveriesTable items={data?.recentDeliveries || []} empty="Nu există livrări recente." />
    </div>
  );
}

export function ProvidersPage() {
  const [data, setData] = useState<any>(null);
  const load = () => notificationProvidersApi.providers().then((res) => setData(res.data ?? res));
  useEffect(() => { load().catch(() => undefined); }, []);
  const testEmail = async () => { const to = prompt('Email test'); if (to) await notificationProvidersApi.testEmail(to); await load(); };
  const testSms = async () => { const to = prompt('Telefon test'); if (to) await notificationProvidersApi.testSms(to); await load(); };
  return (
    <div className="space-y-5 bg-slate-50">
      <Header title="Provideri notificări" subtitle="Secretele se configurează în environment variables. Cheile nu sunt afișate în UI." actions={<button onClick={load} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {['email', 'sms'].map((key) => <Card key={key}><h2 className="font-semibold uppercase text-slate-950">{key}</h2><div className="mt-4 space-y-2 text-sm text-slate-600"><p>Provider: <b>{data?.[key]?.providerType || '—'}</b></p><p>Status: <Badge status={data?.[key]?.status} /></p><p>Configurat: <b>{data?.[key]?.configured ? 'Configurat' : 'Lipsă config'}</b></p><p>From: <b>{data?.[key]?.fromAddress || data?.[key]?.from || '—'}</b></p></div><button onClick={key === 'email' ? testEmail : testSms} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"><Send className="h-4 w-4" /> Trimite test {key}</button></Card>)}
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  useEffect(() => { notificationProvidersApi.templates().then((res) => setData(res.data ?? res)).catch(() => undefined); }, []);
  const items = data?.items || [];
  return <div className="space-y-5 bg-slate-50"><Header title="Templates notificări" subtitle="Templates reutilizabile pentru notificări tranzacționale." /><Card>{!items.length ? <Empty title="Nu există templates" text="Templates de notificări vor fi create automat sau pot fi adăugate manual." /> : <table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Type</th><th>Channel</th><th>Locale</th><th>Name</th><th>Subject</th><th>Status</th><th>System</th><th>Updated</th><th>Acțiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item: any) => <tr key={item.id}><td className="py-3">{item.type}</td><td>{item.channel}</td><td>{item.locale}</td><td>{item.name}</td><td>{item.subject || '—'}</td><td><Badge status={item.status} /></td><td>{item.isSystem ? 'Da' : 'Nu'}</td><td>{fmt(item.updatedAt)}</td><td><ButtonLink href={localizedPath(`/superadmin/notifications/templates/${item.id}`)}><Eye className="h-4 w-4" /> Deschide</ButtonLink></td></tr>)}</tbody></table>}</Card></div>;
}

export function TemplateDetailPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => { notificationProvidersApi.template(id).then((res) => setData(res.data ?? res)).catch(() => undefined); notificationProvidersApi.previewTemplate(id).then((res) => setPreview(res.data ?? res)).catch(() => undefined); }, [id]);
  const save = async () => { await notificationProvidersApi.updateTemplate(id, data); const fresh = await notificationProvidersApi.template(id); setData(fresh.data ?? fresh); };
  if (!data) return <Card><p className="text-sm text-slate-500">Se încarcă...</p></Card>;
  return <div className="space-y-5 bg-slate-50"><Header title={data.name} subtitle={`${data.type} · ${data.channel} · ${data.locale}`} actions={<ButtonLink href={localizedPath('/superadmin/notifications/templates')}><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>} /><Card><div className="grid gap-4"><label className="text-sm font-medium">Subject<input value={data.subject || ''} onChange={(e) => setData({ ...data, subject: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-medium">Body<textarea value={data.body || ''} onChange={(e) => setData({ ...data, body: e.target.value })} className="mt-1 min-h-40 w-full rounded-xl border border-slate-200 px-3 py-2" /></label><label className="text-sm font-medium">Status<select value={data.status} onChange={(e) => setData({ ...data, status: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></label></div><button onClick={save} className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salvează</button></Card><Card><h2 className="font-semibold">Preview</h2><p className="mt-2 text-sm font-medium">{preview?.subject}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{preview?.body}</p></Card></div>;
}

export function DeliveriesPage({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { (admin ? notificationProvidersApi.adminDeliveries() : notificationProvidersApi.deliveries()).then((res) => setData(res.data ?? res)).catch(() => undefined); }, [admin]);
  return <div className="space-y-5 bg-slate-50"><Header title="Livrări notificări" subtitle={admin ? 'Livrări relevante pentru asociația ta.' : 'Istoric email/SMS tranzacțional.'} /><DeliveriesTable items={data?.items || []} admin={admin} empty="Nu există livrări" /></div>;
}

function DeliveriesTable({ items, admin, empty }: { items: any[]; admin?: boolean; empty: string }) {
  const localizedPath = useLocalizedPath();
  return <Card>{!items.length ? <Empty title={empty} text="Emailurile și SMS-urile trimise vor apărea aici." /> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Data</th><th>Channel</th><th>Type</th><th>Recipient</th><th>Asociație</th><th>Status</th><th>Provider</th><th>Reason</th><th>Related</th><th>Acțiuni</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="py-3">{fmt(item.createdAt)}</td><td>{item.channel}</td><td>{item.type}</td><td>{item.recipientEmail || item.recipientPhone || item.recipientUser?.email || '—'}</td><td>{item.association?.legalName || item.association?.name || '—'}</td><td><Badge status={item.status} /></td><td>{item.providerType}</td><td>{item.reasonCode || '—'}</td><td>{[item.relatedEntityType, item.relatedEntityId].filter(Boolean).join(':') || '—'}</td><td><ButtonLink href={localizedPath(`${admin ? '/admin' : '/superadmin'}/notifications/deliveries/${item.id}`)}><Eye className="h-4 w-4" /> Deschide</ButtonLink></td></tr>)}</tbody></table></div>}</Card>;
}

export function DeliveryDetailPage({ id, admin = false }: { id: string; admin?: boolean }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  useEffect(() => { (admin ? notificationProvidersApi.adminDelivery(id) : notificationProvidersApi.delivery(id)).then((res) => setData(res.data ?? res)).catch(() => undefined); }, [id, admin]);
  if (!data) return <Card><p className="text-sm text-slate-500">Se încarcă...</p></Card>;
  return <div className="space-y-5 bg-slate-50"><Header title="Detalii livrare" subtitle={`${data.channel} · ${data.type}`} actions={<ButtonLink href={localizedPath(`${admin ? '/admin' : '/superadmin'}/notifications/deliveries`)}><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>} /><Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><p>Status<br /><Badge status={data.status} /></p><p>Provider<br /><b>{data.providerType}</b></p><p>Recipient<br /><b>{data.recipientEmail || data.recipientPhone || '—'}</b></p><p>Reason<br /><b>{data.reasonCode || '—'}</b></p><p>Provider message<br /><b>{data.providerMessageId || '—'}</b></p><p>Related<br /><b>{[data.relatedEntityType, data.relatedEntityId].filter(Boolean).join(':') || '—'}</b></p></div></Card><Card><h2 className="font-semibold">Conținut</h2><p className="mt-2 text-sm font-medium">{data.subject}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{data.bodyPreview}</p>{data.errorMessage ? <p className="mt-3 text-sm text-red-700">{data.errorMessage}</p> : null}</Card></div>;
}

export function AdminNotificationSettingsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { notificationProvidersApi.adminSettings().then((res) => setData(res.data ?? res)).catch(() => undefined); }, []);
  const save = async () => { const res = await notificationProvidersApi.updateAdminSettings(data); setData(res.data ?? res); };
  if (!data) return <Card><p className="text-sm text-slate-500">Se încarcă...</p></Card>;
  return <div className="space-y-5"><Header title="Setări notificări" subtitle="Configurează ce notificări externe pot fi trimise pentru asociație." /><Card><div className="space-y-3">{Object.keys(data).map((key) => <label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 text-sm font-medium"><span>{key}</span><input type="checkbox" checked={Boolean(data[key])} onChange={(e) => setData({ ...data, [key]: e.target.checked })} /></label>)}</div><button onClick={save} className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Salvează</button></Card></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div><p className="font-semibold text-slate-950">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>;
}
