'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleOff, ExternalLink } from 'lucide-react';
import { billingSaasApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const featureLabels: Record<string, string> = {
  apartmentsCrm: 'Apartamente CRM',
  residentsCrm: 'Locatari CRM',
  internalInvoices: 'Facturi interne',
  manualPayments: 'Plăți manuale',
  meterReadings: 'Indici contoare',
  meterBasedTariffs: 'Tarife pe consum',
  billingRun: 'Proces facturare',
  dataQuality: 'Calitatea datelor',
  announcements: 'Anunțuri',
  requests: 'Solicitări',
  financialReports: 'Rapoarte financiare',
  consumptionReports: 'Rapoarte consum',
  csvImport: 'Import CSV',
  csvExport: 'Export CSV',
  staffRoles: 'Roluri staff',
  auditLog: 'Audit log',
  supportAccess: 'Support access',
  duplicateDetection: 'Duplicate detection',
  advancedSecurity: 'Securitate avansată',
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value));
}

function statusClass(status?: string) {
  if (status === 'ACTIVE' || status === 'OK') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'WARNING' || status === 'NEAR_LIMIT' || status === 'TRIALING' || status === 'PAST_DUE') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'OVER_LIMIT' || status === 'SUSPENDED' || status === 'CANCELLED' || status === 'EXPIRED') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function Badge({ status, children }: { status?: string; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{children}</span>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-border/70 bg-card p-5">{children}</section>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function Loading() {
  return <Card><p className="text-sm text-muted-foreground">Se încarcă...</p></Card>;
}

function Empty() {
  return (
    <Card>
      <p className="font-semibold text-foreground">Abonament neconfigurat</p>
      <p className="mt-1 text-sm text-muted-foreground">Asociația nu are încă un abonament configurat. Contactează Superadmin.</p>
    </Card>
  );
}

function Progress({ item }: { item: any }) {
  const pct = item.percent ?? 0;
  return (
    <div className="space-y-2 rounded-xl border border-border/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{item.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
        </div>
        <Badge status={item.status}>{item.status}</Badge>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{item.limit === null ? `${item.used ?? 0} / nelimitat` : `${item.used ?? 0} / ${item.limit}`}</p>
    </div>
  );
}

function useSubscriptionData(loader: () => Promise<any>) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loader().then((res) => active && setData(res.data ?? res)).finally(() => active && setLoading(false));
    return () => { active = false; };
    // The caller intentionally supplies a stable route-level loader for first paint only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading };
}

export function AdminSaasSubscriptionPage() {
  const localizedPath = useLocalizedPath();
  const { data, loading } = useSubscriptionData(() => billingSaasApi.getAdminSubscription());
  const subscription = data?.subscription;
  const limits = data?.limits || [];
  const warnings = data?.warnings || [];
  const features = data?.features || {};
  if (loading) return <Loading />;
  if (!subscription) return <div className="space-y-5"><Header title="Abonament" subtitle="Vezi planul curent, limitele și utilizarea asociației." /><Empty /></div>;
  return (
    <div className="space-y-5">
      <Header title="Abonament" subtitle="Vezi planul curent, limitele și utilizarea asociației." />
      {warnings.length ? <Card><div className="space-y-2">{warnings.map((warning: any) => <p key={`${warning.key}-${warning.message}`} className="flex gap-2 text-sm text-amber-700"><AlertTriangle className="mt-0.5 h-4 w-4" />{warning.message}</p>)}</div></Card> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-semibold text-foreground">Plan curent</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Plan: <span className="font-medium text-foreground">{subscription.planName}</span></p>
            <p>Status: <Badge status={subscription.status}>{subscription.status}</Badge></p>
            <p>Billing cycle: <span className="font-medium text-foreground">{subscription.billingCycle}</span></p>
            <p>Trial: <span className="font-medium text-foreground">{fmtDate(subscription.trialEndsAt)}</span></p>
            <p>Perioada curentă: <span className="font-medium text-foreground">{fmtDate(subscription.currentPeriodEnd)}</span></p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={localizedPath('/admin/subscription/limits')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">Vezi limite</Link>
            <Link href={localizedPath('/admin/subscription/upgrade')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Cere upgrade <ExternalLink className="h-4 w-4" /></Link>
            <Link href={localizedPath('/admin/subscription/upgrade-requests')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">Cererile mele</Link>
            <Link href={localizedPath('/admin/subscription/invoices')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">Facturi abonament</Link>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground">Utilizare</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {limits.slice(0, 4).map((item: any) => <Progress key={item.limitKey} item={item} />)}
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold text-foreground">Features</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(features).map(([key, enabled]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              {enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleOff className="h-4 w-4 text-muted-foreground" />}
              <span className={enabled ? 'text-foreground' : 'text-muted-foreground'}>{featureLabels[key] || key}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-foreground">Facturi abonament</h2>
        <p className="mt-1 text-sm text-muted-foreground">Vezi facturile SaaS emise de Espace către asociație, statusul și soldul restant.</p>
        <Link href={localizedPath('/admin/subscription/invoices')} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">Vezi facturi</Link>
      </Card>
      <Card>
        <h2 className="font-semibold text-foreground">Ai nevoie de mai multe resurse?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Trimite o cerere către Superadmin pentru modificarea planului asociației.</p>
        <Link href={localizedPath('/admin/subscription/upgrade')} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Cere upgrade</Link>
      </Card>
    </div>
  );
}

export function AdminSaasUsagePage() {
  const localizedPath = useLocalizedPath();
  const { data, loading } = useSubscriptionData(() => billingSaasApi.getAdminSubscriptionUsage());
  const limits = data?.limits || [];
  const hasRisk = limits.some((item: any) => item.status === 'NEAR_LIMIT' || item.status === 'OVER_LIMIT');
  if (loading) return <Loading />;
  return (
    <div className="space-y-5">
      <Header title="Utilizare abonament" subtitle="Vezi utilizarea detaliată a planului pentru luna curentă." />
      {hasRisk ? (
        <Card>
          <p className="font-semibold text-amber-700">Te apropii de limita planului.</p>
          <p className="mt-1 text-sm text-muted-foreground">Poți cere upgrade pentru resurse suplimentare.</p>
          <Link href={localizedPath('/admin/subscription/upgrade')} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Cere upgrade</Link>
        </Card>
      ) : null}
      {!limits.length ? <Card><p className="font-semibold text-foreground">Nu există date de utilizare</p><p className="mt-1 text-sm text-muted-foreground">Datele de utilizare vor apărea după adăugarea apartamentelor, locatarilor și activității în sistem.</p></Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">{limits.map((item: any) => <div key={item.limitKey} className="space-y-2"><Progress item={item} />{item.status === 'NEAR_LIMIT' || item.status === 'OVER_LIMIT' ? <Link href={localizedPath(`/admin/subscription/upgrade?limit=${item.limitKey}`)} className="inline-flex min-h-9 items-center rounded-lg border border-border/70 px-3 text-sm font-semibold">Cere upgrade pentru această limită</Link> : null}</div>)}</div>
    </div>
  );
}

export function AdminSaasLimitsPage() {
  const { data, loading } = useSubscriptionData(() => billingSaasApi.getAdminSubscription());
  const inactive = useMemo(() => Object.entries(data?.features || {}).filter(([, enabled]) => !enabled), [data]);
  if (loading) return <Loading />;
  return (
    <div className="space-y-5">
      <Header title="Limite plan" subtitle="Vezi limitele planului, features disponibile și ce nu este inclus." />
      {!data?.subscription ? <Empty /> : null}
      <div className="grid gap-4 lg:grid-cols-2">{(data?.limits || []).map((item: any) => <Progress key={item.limitKey} item={item} />)}</div>
      <Card>
        <h2 className="font-semibold text-foreground">Neincluse în plan</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inactive.map(([key]) => <p key={key} className="flex items-center gap-2 text-sm text-muted-foreground"><CircleOff className="h-4 w-4" />{featureLabels[key] || key}</p>)}
          {!inactive.length ? <p className="text-sm text-muted-foreground">Toate features urmărite sunt active în plan.</p> : null}
        </div>
      </Card>
    </div>
  );
}
