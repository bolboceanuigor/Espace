'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  History,
  LockKeyhole,
  Play,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow, TableWrapper } from '@/components/ui';
import { auditLogsApi, billingApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type BillingRunStatus = 'NOT_STARTED' | 'PRECHECK' | 'READY_FOR_DRAFT' | 'DRAFT_CALCULATED' | 'IN_REVIEW' | 'DRAFT_LOCKED' | 'FINALIZED' | 'CANCELLED';
type CheckStatus = 'PASSED' | 'WARNING' | 'FAILED' | 'NOT_APPLICABLE';

type BillingCheck = {
  id: string;
  key: string;
  label: string;
  category: string;
  status: CheckStatus;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  actionUrl?: string | null;
};

type BillingRun = {
  id: string;
  billingMonth: string;
  status: BillingRunStatus;
  currency: 'MDL';
  draftId?: string | null;
  totalAmount: number;
  warningsCount: number;
  errorsCount: number;
  invoicesCount: number;
  updatedAt: string;
  checks?: BillingCheck[];
};

type BillingOverview = {
  billingMonth: string;
  association: { id: string; shortName: string; associationCode: string };
  billingRun: BillingRun | null;
  summary: {
    totalApartments: number;
    apartmentsWithoutPrimaryContact: number;
    apartmentsWithoutArea: number;
    activeTariffs: number;
    activeMeterTariffs: number;
    approvedMeterReadings: number;
    missingMeterReadings: number;
    warningsCount: number;
    errorsCount: number;
    draftTotal?: number;
    invoicesGenerated?: number;
  };
  timeline: Array<{ key: string; label: string; status: 'COMPLETE' | 'WARNING' | 'ERROR' | 'PENDING'; description: string; actionUrl: string }>;
  checks: BillingCheck[];
  draft?: { id: string; status: string; totalAmount: number; warningsCount: number; errorsCount: number; invoicesGenerated?: boolean; invoicesCount?: number } | null;
  finalInvoices?: { count: number; totalAmount: number };
  nextAction: { key: string; label: string; description: string; actionUrl: string };
};

type RecentActivity = {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  actionUrl?: string | null;
  actor?: { fullName?: string | null } | null;
  createdAt: string;
};

const statusLabel: Record<BillingRunStatus, string> = {
  NOT_STARTED: 'Nepornit',
  PRECHECK: 'Verificări inițiale',
  READY_FOR_DRAFT: 'Gata pentru draft',
  DRAFT_CALCULATED: 'Draft calculat',
  IN_REVIEW: 'În revizuire',
  DRAFT_LOCKED: 'Draft blocat',
  FINALIZED: 'Finalizat',
  CANCELLED: 'Anulat',
};

const statusVariant: Record<BillingRunStatus, 'neutral' | 'warning' | 'success' | 'error'> = {
  NOT_STARTED: 'neutral',
  PRECHECK: 'warning',
  READY_FOR_DRAFT: 'success',
  DRAFT_CALCULATED: 'warning',
  IN_REVIEW: 'warning',
  DRAFT_LOCKED: 'success',
  FINALIZED: 'success',
  CANCELLED: 'neutral',
};

const checkVariant: Record<CheckStatus, 'neutral' | 'warning' | 'success' | 'error'> = {
  PASSED: 'success',
  WARNING: 'warning',
  FAILED: 'error',
  NOT_APPLICABLE: 'neutral',
};

const checkLabel: Record<CheckStatus, string> = {
  PASSED: 'OK',
  WARNING: 'Avertizare',
  FAILED: 'Problemă',
  NOT_APPLICABLE: 'N/A',
};

const timelineIcon = {
  COMPLETE: CheckCircle2,
  WARNING: TriangleAlert,
  ERROR: XCircle,
  PENDING: CalendarDays,
} as const;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatActivityDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function localizeAction(localizedPath: (path: string) => string, path?: string | null) {
  if (!path) return localizedPath('/admin/billing');
  if (path.startsWith('/ro/') || path.startsWith('/ru/') || path.startsWith('/en/')) return path;
  return localizedPath(path);
}

function monthFromLocation() {
  if (typeof window === 'undefined') return currentMonth();
  return new URLSearchParams(window.location.search).get('billingMonth') || currentMonth();
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground">
      <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <select className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-foreground" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <Card key={item} className="h-28 animate-pulse bg-muted/30" />
      ))}
    </div>
  );
}

function CheckList({ checks, limit }: { checks: BillingCheck[]; limit?: number }) {
  const localizedPath = useLocalizedPath();
  const visibleChecks = limit ? checks.slice(0, limit) : checks;
  if (!visibleChecks.length) {
    return (
      <Card className="p-6">
        <p className="text-sm font-medium text-foreground">Nu există verificări salvate.</p>
        <p className="mt-1 text-sm text-muted-foreground">Rulează verificările inițiale pentru a vedea starea datelor.</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {visibleChecks.map((check) => (
        <Card key={check.id || check.key} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{check.label}</h3>
                <Badge variant={checkVariant[check.status]}>{checkLabel[check.status]}</Badge>
                <span className="text-xs text-muted-foreground">{check.category}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
            </div>
            {check.actionUrl ? (
              <ButtonLink href={localizeAction(localizedPath, check.actionUrl)} variant="secondary" size="sm">
                Deschide
              </ButtonLink>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Timeline({ items }: { items: BillingOverview['timeline'] }) {
  const localizedPath = useLocalizedPath();
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = timelineIcon[item.status] || CalendarDays;
        const tone =
          item.status === 'COMPLETE'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : item.status === 'ERROR'
              ? 'border-red-200 bg-red-50 text-red-700'
              : item.status === 'WARNING'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-border bg-muted/20 text-muted-foreground';
        return (
          <Link key={item.key} href={localizeAction(localizedPath, item.actionUrl)} className={`rounded-2xl border p-4 transition hover:shadow-sm ${tone}`}>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-semibold">{item.label}</span>
            </div>
            <p className="mt-2 text-sm opacity-90">{item.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

function HeaderBadges({ data }: { data: BillingOverview }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">{data.association?.shortName || 'APC'}</Badge>
      <Badge variant="neutral">{data.association?.associationCode || 'Cod APC'}</Badge>
      <Badge variant="neutral">{data.billingMonth}</Badge>
      <Badge variant="neutral">MDL</Badge>
      {data.billingRun ? <Badge variant={statusVariant[data.billingRun.status]}>{statusLabel[data.billingRun.status]}</Badge> : null}
    </div>
  );
}

function Kpis({ data }: { data: BillingOverview }) {
  const summary = data.summary || {};
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total apartamente" value={String(summary.totalApartments || 0)} description="În asociație" icon={<CalendarDays className="h-5 w-5" />} />
      <StatCard label="Fără contact principal" value={String(summary.apartmentsWithoutPrimaryContact || 0)} description="Necesită completare" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.apartmentsWithoutPrimaryContact ? 'warning' : 'success'} />
      <StatCard label="Fără suprafață" value={String(summary.apartmentsWithoutArea || 0)} description="Relevant pentru per m²" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.apartmentsWithoutArea ? 'warning' : 'success'} />
      <StatCard label="Tarife active" value={String(summary.activeTariffs || 0)} description={`${summary.activeMeterTariffs || 0} pe consum`} icon={<ReceiptText className="h-5 w-5" />} tone={summary.activeTariffs ? 'success' : 'danger'} />
      <StatCard label="Indici aprobați" value={String(summary.approvedMeterReadings || 0)} description="Luna selectată" icon={<CheckCircle2 className="h-5 w-5" />} />
      <StatCard label="Indici lipsă" value={String(summary.missingMeterReadings || 0)} description="Pentru tarife consum" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.missingMeterReadings ? 'warning' : 'success'} />
      <StatCard label="Warnings" value={String(summary.warningsCount || 0)} description="Preflight" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.warningsCount ? 'warning' : 'success'} />
      <StatCard label="Errors" value={String(summary.errorsCount || 0)} description="Critice" icon={<XCircle className="h-5 w-5" />} tone={summary.errorsCount ? 'danger' : 'success'} />
      <StatCard label="Draft total" value={formatMdl(summary.draftTotal || data.draft?.totalAmount || 0)} description="Dacă există draft" icon={<WalletCards className="h-5 w-5" />} />
      <StatCard label="Facturi generate" value={String(summary.invoicesGenerated || data.finalInvoices?.count || 0)} description="Finale interne" icon={<FileText className="h-5 w-5" />} />
    </div>
  );
}

export function AdminBillingOverviewPage() {
  const localizedPath = useLocalizedPath();
  const router = useRouter();
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setBillingMonth(monthFromLocation());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await billingApi.overview({ billingMonth });
      setData(res.data || res);
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca procesul lunar.'));
    } finally {
      setLoading(false);
    }
  }, [billingMonth]);

  useEffect(() => {
    load();
  }, [load]);

  async function startRun() {
    setBusy('start');
    setError('');
    try {
      const res = await billingApi.createRun({ billingMonth });
      const payload = (res.data || res) as BillingOverview;
      const run = payload.billingRun;
      router.push(localizedPath(`/admin/billing/runs/${run?.id || ''}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut porni procesul lunar.'));
    } finally {
      setBusy('');
    }
  }

  const nextActionHref = data?.nextAction ? localizeAction(localizedPath, data.nextAction.actionUrl) : localizedPath('/admin/billing');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturare lunară"
        description="Gestionează procesul lunar de verificare, calcul, revizuire și generare a facturilor interne."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={localizedPath('/admin/billing/runs')} variant="secondary">Vezi procese anterioare</ButtonLink>
            <ButtonLink href={localizedPath('/admin/invoices/draft')} variant="secondary">Calculează draft</ButtonLink>
            <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary">Vezi facturi</ButtonLink>
            <ButtonLink href={localizedPath(`/admin/reports/financial/monthly?billingMonth=${billingMonth}`)} variant="secondary">Raport financiar lunar</ButtonLink>
            <ButtonLink href={localizedPath('/admin/payments/reconciliation')} variant="secondary">Reconciliere plăți</ButtonLink>
          </div>
        }
      />

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
          <Input label="Luna facturare" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <div>{data ? <HeaderBadges data={data} /> : null}</div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Actualizează
          </Button>
        </div>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {loading ? <LoadingState /> : null}

      {!loading && data && !data.billingRun ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Procesul lunar nu este pornit</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pornește procesul de facturare pentru luna selectată ca să verifici datele, tarifele și contoarele înainte de calculul draftului.
          </p>
          <Button className="mt-4" onClick={startRun} disabled={busy === 'start'}>
            <Play className="h-4 w-4" /> Pornește proces lunar
          </Button>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Următoarea acțiune recomandată</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{data.nextAction.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{data.nextAction.description}</p>
              </div>
              {data.nextAction.key === 'START_RUN' ? (
                <Button onClick={startRun} disabled={busy === 'start'}><Play className="h-4 w-4" /> Pornește proces lunar</Button>
              ) : (
                <ButtonLink href={nextActionHref}>
                  Deschide
                </ButtonLink>
              )}
            </div>
          </Card>

          <Kpis data={data} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Timeline proces</h2>
            </div>
            <Timeline items={data.timeline || []} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Preflight checks</h2>
              {data.billingRun ? <ButtonLink href={localizedPath(`/admin/billing/runs/${data.billingRun.id}`)} variant="secondary">Deschide proces</ButtonLink> : null}
            </div>
            <CheckList checks={data.checks || data.billingRun?.checks || []} limit={8} />
          </section>
        </>
      ) : null}
    </div>
  );
}

export function BillingRunsListPage() {
  const localizedPath = useLocalizedPath();
  const [billingMonth, setBillingMonth] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<{ items: BillingRun[]; meta: { total: number } }>({ items: [], meta: { total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await billingApi.runs({ billingMonth: billingMonth || undefined, status: status || undefined, limit: 50 });
      setData(res.data || res);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca procesele.'));
    } finally {
      setLoading(false);
    }
  }, [billingMonth, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procese de facturare"
        description="Istoricul proceselor lunare de verificare, draft și finalizare."
        rightSlot={<ButtonLink href={localizedPath('/admin/billing/runs/new')}><Play className="h-4 w-4" /> Pornește proces</ButtonLink>}
      />
      <Card className="grid gap-4 p-5 md:grid-cols-[220px_220px_auto] md:items-end">
        <Input label="Luna" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
        <SelectField label="Status" value={status} onChange={setStatus}>
          <option value="">Toate statusurile</option>
          {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </SelectField>
        <Button variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Actualizează</Button>
      </Card>
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Luna</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Warnings</TableHeaderCell>
              <TableHeaderCell>Errors</TableHeaderCell>
              <TableHeaderCell>Total</TableHeaderCell>
              <TableHeaderCell>Facturi</TableHeaderCell>
              <TableHeaderCell>Actualizat</TableHeaderCell>
              <TableHeaderCell>Acțiuni</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !data.items.length ? (
              <TableEmpty colSpan={8}>
                Nu există procese de facturare. Pornește procesul lunar pentru a urmări verificările și draftul.
              </TableEmpty>
            ) : null}
            {data.items.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{run.billingMonth}</TableCell>
                <TableCell><Badge variant={statusVariant[run.status]}>{statusLabel[run.status]}</Badge></TableCell>
                <TableCell>{run.warningsCount}</TableCell>
                <TableCell>{run.errorsCount}</TableCell>
                <TableCell>{formatMdl(run.totalAmount || 0)}</TableCell>
                <TableCell>{run.invoicesCount || 0}</TableCell>
                <TableCell>{run.updatedAt ? new Date(run.updatedAt).toLocaleDateString('ro-RO') : '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={localizedPath(`/admin/billing/runs/${run.id}`)} size="sm">Deschide</ButtonLink>
                    {run.draftId ? <ButtonLink href={localizedPath(`/admin/invoices/draft/${run.draftId}/review`)} variant="secondary" size="sm">Draft</ButtonLink> : null}
                    <ButtonLink href={localizedPath(`/admin/invoices?billingMonth=${run.billingMonth}`)} variant="secondary" size="sm">Facturi</ButtonLink>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}

export function BillingRunNewPage() {
  const localizedPath = useLocalizedPath();
  const router = useRouter();
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await billingApi.createRun({ billingMonth });
      const payload = (res.data || res) as BillingOverview;
      const run = payload.billingRun;
      router.push(localizedPath(`/admin/billing/runs/${run?.id || ''}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut porni procesul lunar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href={localizedPath('/admin/billing')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la facturare
      </Link>
      <PageHeader title="Pornește proces lunar" description="Creează un Billing Run pentru luna selectată și rulează verificările inițiale." />
      <Card className="max-w-xl space-y-4 p-6">
        <Input label="Luna facturare" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button onClick={submit} disabled={busy}>
          <Play className="h-4 w-4" /> Pornește proces pentru această lună
        </Button>
      </Card>
    </div>
  );
}

export function BillingRunDetailPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const id = String(params?.id || '');
  const [data, setData] = useState<BillingOverview | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [calculateOpen, setCalculateOpen] = useState(false);
  const [includeMeterCharges, setIncludeMeterCharges] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [res, activityRes] = await Promise.all([
        billingApi.getRun(id),
        auditLogsApi.billingRunActivityRecent(id).catch(() => null),
      ]);
      setData(res.data || res);
      setRecentActivity((activityRes?.data || activityRes)?.items || []);
    } catch (err: any) {
      setData(null);
      setRecentActivity([]);
      setError(String(err?.message || 'Nu am putut încărca procesul lunar.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(key: string, action: () => Promise<void>, success: string) {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (err: any) {
      setError(String(err?.message || 'Acțiunea nu a putut fi finalizată.'));
    } finally {
      setBusy('');
    }
  }

  const run = data?.billingRun;

  return (
    <div className="space-y-6">
      <Link href={localizedPath('/admin/billing')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la facturare
      </Link>
      <PageHeader
        title={run ? `Proces ${run.billingMonth}` : 'Proces de facturare'}
        description="Verificări, draft, blocare și finalizare pentru luna selectată."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runAction('preflight', () => billingApi.preflight(id).then(() => undefined), 'Verificările au fost actualizate.')} disabled={busy === 'preflight'}>
              <RefreshCw className="h-4 w-4" /> Rulează verificări
            </Button>
            <ButtonLink href={localizedPath(`/admin/billing/runs/${id}/activity`)} variant="secondary">
              <History className="h-4 w-4" /> Vezi activitatea
            </ButtonLink>
            <Button onClick={() => setCalculateOpen(true)} disabled={!run || run.status === 'CANCELLED' || run.status === 'FINALIZED'}>
              <Play className="h-4 w-4" /> Calculează draft
            </Button>
          </div>
        }
      />
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {message ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</Card> : null}
      {loading ? <LoadingState /> : null}
      {data && run ? (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant[run.status]}>{statusLabel[run.status]}</Badge>
                  <Badge variant="neutral">{data.association?.shortName || 'APC'}</Badge>
                  <Badge variant="neutral">{data.association?.associationCode || 'Cod APC'}</Badge>
                  <Badge variant="neutral">MDL</Badge>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">{data.nextAction.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{data.nextAction.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.draft?.id ? <ButtonLink href={localizedPath(`/admin/invoices/draft/${data.draft.id}/review`)} variant="secondary"><FileText className="h-4 w-4" /> Review draft</ButtonLink> : null}
                {data.draft?.status === 'LOCKED' ? <ButtonLink href={localizedPath(`/admin/invoices/finalize/${data.draft.id}`)}><LockKeyhole className="h-4 w-4" /> Finalizare</ButtonLink> : null}
                {run.status !== 'FINALIZED' && run.status !== 'CANCELLED' ? (
                  <Button variant="secondary" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4" /> Anulează</Button>
                ) : null}
              </div>
            </div>
          </Card>
          <Kpis data={data} />
          <Timeline items={data.timeline || []} />
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Verificări</h2>
              <CheckList checks={data.checks || []} />
            </section>
            <aside className="space-y-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground">Draft</h3>
                {data.draft ? (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>Status: <span className="font-medium text-foreground">{data.draft.status}</span></p>
                    <p>Total: <span className="font-medium text-foreground">{formatMdl(data.draft.totalAmount || 0)}</span></p>
                    <p>Warnings: {data.draft.warningsCount || 0}</p>
                    <p>Errors: {data.draft.errorsCount || 0}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Draftul nu este calculat încă.</p>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground">Facturi finale</h3>
                <p className="mt-2 text-sm text-muted-foreground">{data.finalInvoices?.count || 0} facturi generate</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatMdl(data.finalInvoices?.totalAmount || 0)}</p>
                <ButtonLink href={localizedPath(`/admin/invoices?billingMonth=${run.billingMonth}`)} className="mt-4" variant="secondary">
                  Vezi facturi finale
                </ButtonLink>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-foreground">Raport financiar</h3>
                <p className="mt-2 text-sm text-muted-foreground">După finalizare, raportul lunar agregă facturile, plățile și soldurile pentru această lună.</p>
                <ButtonLink href={localizedPath(`/admin/reports/financial/monthly?billingMonth=${run.billingMonth}`)} className="mt-4" variant="secondary">
                  Vezi raport financiar
                </ButtonLink>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Activitate recentă</h3>
                  <ButtonLink href={localizedPath(`/admin/billing/runs/${run.id}/activity`)} size="sm" variant="secondary">
                    Vezi tot istoricul
                  </ButtonLink>
                </div>
                <div className="mt-4 space-y-3">
                  {recentActivity.length ? recentActivity.map((item) => (
                    <div key={item.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <Badge variant={item.severity === 'SUCCESS' ? 'success' : item.severity === 'WARNING' ? 'warning' : item.severity === 'ERROR' ? 'error' : 'neutral'}>{item.severity}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{item.actor?.fullName || 'Sistem'} · {formatActivityDate(item.createdAt)}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Nu există activitate înregistrată încă.</p>
                  )}
                </div>
              </Card>
            </aside>
          </div>
        </>
      ) : null}

      <Modal isOpen={calculateOpen} onClose={() => setCalculateOpen(false)} maxWidth="md">
        <ModalHeader title="Calculează draft" onClose={() => setCalculateOpen(false)} />
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">Confirmi calculul draftului pentru luna {run?.billingMonth}? Draftul va include tarifele active și, opțional, tarifele pe consum.</p>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input type="checkbox" checked={includeMeterCharges} onChange={(event) => setIncludeMeterCharges(event.target.checked)} />
            Include tarife pe consum
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCalculateOpen(false)}>Renunță</Button>
          <Button
            onClick={() => {
              setCalculateOpen(false);
              runAction('calculate', () => billingApi.calculateDraft(id, { includeMeterCharges }).then(() => undefined), 'Draftul a fost calculat și legat de proces.');
            }}
            disabled={busy === 'calculate'}
          >
            Calculează draft
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="md">
        <ModalHeader title="Anulează procesul lunar" onClose={() => setCancelOpen(false)} />
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">Procesul va fi anulat logic. Draftul asociat rămâne în sistem pentru audit.</p>
          <Input label="Motiv anulare" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>Renunță</Button>
          <Button
            variant="danger"
            onClick={() => {
              setCancelOpen(false);
              runAction('cancel', () => billingApi.cancel(id, cancelReason).then(() => undefined), 'Procesul lunar a fost anulat.');
            }}
            disabled={!cancelReason.trim() || busy === 'cancel'}
          >
            Anulează proces
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
