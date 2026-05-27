'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Send, XCircle } from 'lucide-react';
import { billingSaasApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const reasons = [
  ['LIMIT_REACHED', 'Limită atinsă'],
  ['NEAR_LIMIT', 'Aproape de limită'],
  ['FEATURE_NEEDED', 'Funcționalitate necesară'],
  ['MORE_STAFF', 'Mai mulți membri în echipă'],
  ['MORE_APARTMENTS', 'Mai multe apartamente'],
  ['MORE_METERS', 'Mai multe contoare'],
  ['MORE_INVOICES', 'Mai multe facturi'],
  ['ADVANCED_REPORTS', 'Rapoarte avansate'],
  ['DATA_QUALITY', 'Calitatea datelor'],
  ['SUPPORT_ACCESS', 'Acces suport'],
  ['OTHER', 'Alt motiv'],
];

const statusLabels: Record<string, string> = {
  PENDING: 'În așteptare',
  IN_REVIEW: 'În verificare',
  APPROVED: 'Aprobată',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
};

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-border/70 bg-card p-5">{children}</section>;
}

function Badge({ status }: { status?: string }) {
  const tone = status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'REJECTED' || status === 'CANCELLED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{statusLabels[status || ''] || status || '—'}</span>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p></div>;
}

function fmt(value?: string | null) {
  return value ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}

function reasonLabel(value?: string) {
  return reasons.find(([key]) => key === value)?.[1] || value || '—';
}

export function AdminUpgradeRequestPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ requestedPlanId: '', reason: 'NEAR_LIMIT', message: '', confirmSeparateRequest: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    billingSaasApi.getAdminUpgradeOptions().then((res) => setData(res.data));
  }, []);

  const plans = data?.availablePlans || [];
  const warnings = data?.usageWarnings || [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await billingSaasApi.createAdminUpgradeRequest({
        ...form,
        requestedPlanId: form.requestedPlanId || undefined,
      });
      const id = res.data?.request?.id || res.data?.id;
      window.location.href = localizedPath(`/admin/subscription/upgrade-requests/${id}?created=1`);
    } catch (err: any) {
      setError(err?.message || 'Cererea nu a putut fi trimisă.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Header title="Cere upgrade" subtitle="Trimite o cerere către Superadmin pentru modificarea planului asociației." />
      {data?.hasOpenRequest ? (
        <Card>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Cererea ta este în verificare.</p>
          <Link href={localizedPath(`/admin/subscription/upgrade-requests/${data.openRequestId}`)} className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-border/70 px-4 text-sm font-semibold">Deschide cererea</Link>
        </Card>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <h2 className="font-semibold text-foreground">Plan curent</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data?.currentSubscription?.planName || 'Abonament neconfigurat'} · {data?.currentSubscription?.status || '—'}</p>
          <div className="mt-4 space-y-2">
            {warnings.slice(0, 4).map((warning: any) => <p key={`${warning.key}-${warning.message}`} className="text-sm text-amber-700">{warning.message}</p>)}
            {!warnings.length ? <p className="text-sm text-muted-foreground">Nu există warnings active.</p> : null}
          </div>
        </Card>
        <Card>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-foreground">Plan dorit</label>
            <select className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={form.requestedPlanId} onChange={(e) => setForm({ ...form, requestedPlanId: e.target.value })}>
              <option value="">Alege un plan</option>
              {plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.monthlyPrice} {plan.currency}/lună</option>)}
            </select>
            {!plans.length ? <p className="text-sm text-muted-foreground">Nu există planuri disponibile pentru upgrade. Contactează echipa Espace pentru configurarea unui plan potrivit.</p> : null}
            <label className="block text-sm font-medium text-foreground">Motiv</label>
            <select className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
              {reasons.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <label className="block text-sm font-medium text-foreground">Mesaj</label>
            <textarea className="min-h-32 w-full rounded-xl border border-border bg-background p-3 text-sm" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Descrie pe scurt ce resurse sau funcționalități sunt necesare." />
            {data?.hasOpenRequest ? <label className="flex gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.confirmSeparateRequest} onChange={(e) => setForm({ ...form, confirmSeparateRequest: e.target.checked })} /> Creează o cerere separată</label> : null}
            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
            <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Send className="h-4 w-4" /> Cere upgrade</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function AdminUpgradeRequestsListPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = () => billingSaasApi.listAdminUpgradeRequests().then((res) => setData(res.data));
  useEffect(() => {
    load();
    // First paint only; subsequent refreshes are explicit after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items = data?.items || [];
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Header title="Cererile mele de upgrade" subtitle="Urmărește cererile trimise către Superadmin." />
        <Link href={localizedPath('/admin/subscription/upgrade')} className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Cere upgrade</Link>
      </div>
      <Card>
        {!items.length ? <div><p className="font-semibold text-foreground">Nu ai cereri de upgrade</p><p className="mt-1 text-sm text-muted-foreground">Cererile de modificare a planului vor apărea aici după trimitere.</p></div> : null}
        <div className="grid gap-3">
          {items.map((item: any) => <RequestRow key={item.id} item={item} href={localizedPath(`/admin/subscription/upgrade-requests/${item.id}`)} onChanged={load} />)}
        </div>
      </Card>
    </div>
  );
}

function RequestRow({ item, href, onChanged }: { item: any; href: string; onChanged?: () => void }) {
  const cancel = async () => {
    if (!window.confirm('Anulezi cererea de upgrade?')) return;
    await billingSaasApi.cancelAdminUpgradeRequest(item.id);
    onChanged?.();
  };
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-medium text-foreground">{fmt(item.createdAt)} · {reasonLabel(item.reason)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.currentPlan?.name || '—'} → {item.requestedPlan?.name || 'Plan nespecificat'}</p>
          {item.adminResponse ? <p className="mt-2 text-sm text-muted-foreground">Răspuns: {item.adminResponse}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge status={item.status} />
          <Link href={href} className="inline-flex min-h-9 items-center rounded-lg border border-border/70 px-3 text-sm font-semibold">Deschide</Link>
          {item.status === 'PENDING' ? <button onClick={cancel} className="inline-flex min-h-9 items-center rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700">Anulează</button> : null}
        </div>
      </div>
    </div>
  );
}

export function AdminUpgradeRequestDetailPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = () => billingSaasApi.getAdminUpgradeRequest(id).then((res) => setData(res.data));
  useEffect(() => {
    load();
    // First paint and id switch only; cancel reloads explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const request = data?.request;
  const limits = data?.usageSnapshot || [];
  if (!request) return <Card><p className="text-sm text-muted-foreground">Se încarcă...</p></Card>;
  return (
    <div className="space-y-5">
      {new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('created') ? <Card><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Cererea a fost trimisă către Superadmin.</p></Card> : null}
      <Link href={localizedPath('/admin/subscription/upgrade-requests')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Înapoi</Link>
      <Header title="Detalii cerere upgrade" subtitle="Superadminul va analiza cererea și te va contacta." />
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Status" value={<Badge status={request.status} />} />
          <Info label="Data trimiterii" value={fmt(request.createdAt)} />
          <Info label="Plan curent" value={data.currentPlan?.name || '—'} />
          <Info label="Plan dorit" value={data.requestedPlan?.name || 'Plan nespecificat'} />
          <Info label="Motiv" value={reasonLabel(request.reason)} />
          <Info label="Plan schimbat" value={request.appliedPlanChange ? 'Da' : 'Nu'} />
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <p><span className="font-semibold text-foreground">Mesaj Admin:</span> <span className="text-muted-foreground">{request.message || '—'}</span></p>
          <p><span className="font-semibold text-foreground">Răspuns Superadmin:</span> <span className="text-muted-foreground">{request.adminResponse || '—'}</span></p>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-foreground">Usage snapshot</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.isArray(limits) ? limits.map((item: any) => <p key={item.limitKey} className="rounded-xl border border-border/70 p-3 text-sm text-muted-foreground">{item.label}: {item.used ?? 0}/{item.limit ?? 'nelimitat'} · {item.status}</p>) : null}
        </div>
      </Card>
      {request.status === 'PENDING' ? <button onClick={async () => { await billingSaasApi.cancelAdminUpgradeRequest(id); await load(); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700"><XCircle className="h-4 w-4" /> Anulează cererea</button> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><div className="mt-1 text-sm font-medium text-foreground">{value}</div></div>;
}
