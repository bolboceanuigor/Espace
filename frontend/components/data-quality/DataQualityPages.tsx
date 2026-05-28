'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  FileText,
  Gauge,
  GitMerge,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui';
import EmptyState from '@/components/common/EmptyState';
import { BulkSelectionToolbar } from '@/components/bulk-operations/BulkOperationComponents';
import { dataQualityApi, dataQualityDuplicatesApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';
type IssueStatus = 'OPEN' | 'RESOLVED' | 'IGNORED';

type DataQualityIssue = {
  id: string;
  key: string;
  category: string;
  categoryLabel?: string;
  severity: Severity;
  status: IssueStatus;
  entityType: string;
  entityId?: string | null;
  title: string;
  description: string;
  recommendation: string;
  actionUrl?: string | null;
  billingImpact: 'BLOCKS_BILLING' | 'AFFECTS_BILLING' | 'NO_BILLING_IMPACT';
  metadata?: Record<string, unknown>;
  detectedAt: string;
  resolvedAt?: string | null;
  ignoredAt?: string | null;
  ignoreReason?: string | null;
  quickFixes?: Array<{ type?: string; key: string; label: string; actionUrl?: string | null }>;
};

type Overview = {
  association: { id: string; shortName: string; associationCode?: string | null };
  billingMonth: string;
  summary: {
    score: number;
    statusLabel: string;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    openIssues: number;
    resolvedIssues: number;
    ignoredIssues: number;
    affectedApartments: number;
    affectedResidents: number;
    affectedMeters: number;
    blocksBillingCount: number;
    affectsBillingCount: number;
    lastRunAt?: string | null;
  };
  categories: Array<{ category: string; label: string; criticalCount: number; warningCount: number; infoCount: number; openIssues: number }>;
  topIssues: DataQualityIssue[];
  nextAction: { key: string; label: string; description: string; actionUrl: string };
};

type RunItem = {
  id: string;
  billingMonth?: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  score: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  resolvedCount: number;
  ignoredCount: number;
  startedAt: string;
  completedAt?: string | null;
  actor?: { fullName?: string | null; email?: string | null } | null;
};

type DuplicateStats = {
  openGroups: number;
  highConfidence: number;
  residentGroups: number;
  apartmentGroups: number;
  meterGroups: number;
  lastScanAt?: string | null;
};

const severityLabel: Record<Severity, string> = {
  CRITICAL: 'Critic',
  WARNING: 'Warning',
  INFO: 'Info',
};

const severityVariant: Record<Severity, 'error' | 'warning' | 'neutral'> = {
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'neutral',
};

const statusLabel: Record<IssueStatus, string> = {
  OPEN: 'Deschisă',
  RESOLVED: 'Rezolvată',
  IGNORED: 'Ignorată',
};

const statusVariant: Record<IssueStatus, 'warning' | 'success' | 'neutral'> = {
  OPEN: 'warning',
  RESOLVED: 'success',
  IGNORED: 'neutral',
};

const impactLabel = {
  BLOCKS_BILLING: 'Blochează facturarea',
  AFFECTS_BILLING: 'Afectează facturarea',
  NO_BILLING_IMPACT: 'Fără impact direct',
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function unwrap<T>(res: any): T {
  return res?.data || res;
}

function localizeAction(localizedPath: (path: string) => string, url?: string | null) {
  if (!url) return localizedPath('/admin/data-quality');
  if (url.startsWith('/ro/') || url.startsWith('/ru/') || url.startsWith('/en/')) return url;
  return localizedPath(url);
}

function hasQuickFix(issue: DataQualityIssue) {
  return Boolean(issue.quickFixes?.some((fix) => !['MARK_ISSUE_RESOLVED', 'MARK_ISSUE_IGNORED', 'REOPEN_ISSUE', 'RUN_DATA_QUALITY'].includes(fix.type || fix.key)));
}

function scoreTone(score: number, criticalCount = 0) {
  if (criticalCount > 0 || score < 70) return 'danger' as const;
  if (score < 90) return 'warning' as const;
  return 'success' as const;
}

function JsonBlock({ value }: { value?: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
      {value ? JSON.stringify(value, null, 2) : '—'}
    </pre>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => <Card key={item} className="h-28 animate-pulse bg-muted/30" />)}
    </div>
  );
}

export function AdminDataQualityOverviewPage() {
  const localizedPath = useLocalizedPath();
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [data, setData] = useState<Overview | null>(null);
  const [duplicateStats, setDuplicateStats] = useState<DuplicateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, duplicateRes] = await Promise.all([
        dataQualityApi.overview({ billingMonth }),
        dataQualityDuplicatesApi.stats().catch(() => null),
      ]);
      setData(unwrap<Overview>(res));
      const duplicatePayload = duplicateRes ? unwrap<any>(duplicateRes) : null;
      setDuplicateStats(duplicatePayload?.summary || duplicatePayload || null);
    } catch (err: any) {
      setData(null);
      setDuplicateStats(null);
      setError(String(err?.message || 'Nu am putut încărca verificările.'));
    } finally {
      setLoading(false);
    }
  }, [billingMonth]);

  useEffect(() => {
    load();
  }, [load]);

  async function runChecks() {
    setBusy(true);
    setError('');
    try {
      const res = await dataQualityApi.run({ billingMonth });
      setData(unwrap<Overview>(res));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut rula verificările.'));
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Calitatea datelor"
        description="Verifică datele asociației și rezolvă problemele care pot bloca facturarea sau comunicarea."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={runChecks} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Rulează verificări
            </Button>
            <ButtonLink href={localizedPath('/admin/data-quality/duplicates')} variant="secondary">Duplicate</ButtonLink>
            <ButtonLink href={localizedPath('/admin/data-quality/fixes')} variant="secondary">Remedieri rapide</ButtonLink>
            <ButtonLink href={localizedPath('/admin/data-quality/issues')} variant="secondary">Vezi toate problemele</ButtonLink>
            <ButtonLink href={localizedPath('/admin/data-quality/runs')} variant="secondary">Rulări</ButtonLink>
            <ButtonLink href={localizedPath('/admin/billing')} variant="secondary">Mergi la facturare</ButtonLink>
            <Button variant="secondary" disabled>Export CSV în curând</Button>
          </div>
        }
      />

      <Card className="grid gap-4 p-5 md:grid-cols-[220px_1fr_auto] md:items-end">
        <Input label="Luna facturare" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{data?.association?.shortName || 'APC'}</Badge>
          <Badge variant="neutral">{data?.association?.associationCode || 'Cod APC'}</Badge>
          <Badge variant={summary ? severityStatusVariant(summary.score, summary.criticalCount) : 'neutral'}>{summary?.statusLabel || 'Fără verificare'}</Badge>
          <Badge variant="neutral">Ultima: {formatDateTime(summary?.lastRunAt)}</Badge>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Actualizează
        </Button>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {loading ? <LoadingGrid /> : null}

      {!loading && !summary?.lastRunAt ? (
        <EmptyState
          title="Nu ai rulat încă verificarea datelor"
          description="Rulează verificările pentru a identifica problemele care pot afecta facturarea și comunicarea."
          actionLabel="Rulează verificări"
          onAction={runChecks}
        />
      ) : null}

      {data && summary ? (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold ${scoreClass(summary.score, summary.criticalCount)}`}>
                  {summary.score}
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Data Quality Score</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{data.nextAction.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{data.nextAction.description}</p>
                </div>
              </div>
              <ButtonLink href={localizeAction(localizedPath, data.nextAction.actionUrl)}>
                Deschide acțiunea
              </ButtonLink>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Probleme critice" value={String(summary.criticalCount)} tone={summary.criticalCount ? 'danger' : 'success'} icon={<ShieldAlert className="h-5 w-5" />} />
            <StatCard label="Warnings" value={String(summary.warningCount)} tone={summary.warningCount ? 'warning' : 'success'} icon={<TriangleAlert className="h-5 w-5" />} />
            <StatCard label="Info" value={String(summary.infoCount)} icon={<CircleAlert className="h-5 w-5" />} />
            <StatCard label="Rezolvate" value={String(summary.resolvedIssues)} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Apartamente afectate" value={String(summary.affectedApartments)} icon={<DatabaseZap className="h-5 w-5" />} />
            <StatCard label="Locatari afectați" value={String(summary.affectedResidents)} icon={<DatabaseZap className="h-5 w-5" />} />
            <StatCard label="Contoare afectate" value={String(summary.affectedMeters)} icon={<Gauge className="h-5 w-5" />} />
            <StatCard label="Blochează facturarea" value={String(summary.blocksBillingCount)} tone={summary.blocksBillingCount ? 'danger' : 'success'} icon={<FileText className="h-5 w-5" />} />
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/45 text-foreground">
                  <GitMerge className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Duplicate detectate</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {duplicateStats?.openGroups
                      ? `${duplicateStats.openGroups} grupuri deschise · ${duplicateStats.highConfidence || 0} cu încredere mare`
                      : 'Nu există grupuri deschise sau nu a fost rulată scanarea.'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Locatari {duplicateStats?.residentGroups || 0} · Apartamente {duplicateStats?.apartmentGroups || 0} · Contoare {duplicateStats?.meterGroups || 0} · Ultima scanare {formatDateTime(duplicateStats?.lastScanAt)}
                  </p>
                </div>
              </div>
              <ButtonLink href={localizedPath('/admin/data-quality/duplicates')} variant="secondary">Verifică duplicatele</ButtonLink>
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-foreground">Categorii</h2>
              <div className="mt-4 grid gap-3">
                {data.categories.length ? data.categories.map((category) => (
                  <Link key={category.category} href={localizedPath(`/admin/data-quality/issues?category=${category.category}&status=OPEN`)} className="rounded-xl border border-border/70 p-3 hover:bg-muted/40">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{category.label}</span>
                      <Badge variant="neutral">{category.openIssues}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category.criticalCount} critice · {category.warningCount} warnings · {category.infoCount} info
                    </p>
                  </Link>
                )) : <p className="text-sm text-muted-foreground">Nu există categorii cu probleme deschise.</p>}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Top probleme</h2>
                <ButtonLink href={localizedPath('/admin/data-quality/issues')} variant="secondary" size="sm">Toate</ButtonLink>
              </div>
              <IssueCards items={data.topIssues} />
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function severityStatusVariant(score: number, criticalCount: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (criticalCount > 0 || score < 70) return 'error';
  if (score < 90) return 'warning';
  return 'success';
}

function scoreClass(score: number, criticalCount: number) {
  if (scoreTone(score, criticalCount) === 'danger') return 'bg-red-50 text-red-700 border border-red-200';
  if (scoreTone(score, criticalCount) === 'warning') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
}

function IssueCards({ items }: { items: DataQualityIssue[] }) {
  const localizedPath = useLocalizedPath();
  if (!items.length) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">Datele arată bine</p>
        <p className="mt-1 text-sm text-emerald-800">Nu au fost găsite probleme deschise în datele asociației.</p>
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-3">
      {items.map((issue) => (
        <div key={issue.id} className="rounded-xl border border-border/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityVariant[issue.severity]}>{severityLabel[issue.severity]}</Badge>
            <Badge variant={statusVariant[issue.status]}>{statusLabel[issue.status]}</Badge>
            <span className="text-xs text-muted-foreground">{issue.categoryLabel || issue.category}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{issue.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}`)} size="sm">Deschide</ButtonLink>
            {hasQuickFix(issue) ? <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}/fix`)} variant="secondary" size="sm">Remediază</ButtonLink> : null}
            {issue.actionUrl ? <ButtonLink href={localizeAction(localizedPath, issue.actionUrl)} variant="secondary" size="sm">Rezolvă</ButtonLink> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function IssueFilters({ filters, onChange, onRefresh }: { filters: Record<string, string>; onChange: (filters: Record<string, string>) => void; onRefresh: () => void }) {
  function setField(key: string, value: string) {
    onChange({ ...filters, [key]: value });
  }
  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-6">
        <Input label="Search" value={filters.search || ''} onChange={(event) => setField('search', event.target.value)} placeholder="titlu, descriere, entitate" />
        <Select label="Categorie" value={filters.category || ''} onChange={(value) => setField('category', value)} options={['', 'ASSOCIATION', 'APARTMENTS', 'RESIDENTS', 'TARIFFS', 'METERS', 'METER_READINGS', 'BILLING', 'INVOICES_PAYMENTS']} labels={{ '': 'Toate', ASSOCIATION: 'Asociație', APARTMENTS: 'Apartamente', RESIDENTS: 'Locatari', TARIFFS: 'Tarife', METERS: 'Contoare', METER_READINGS: 'Indici', BILLING: 'Facturare', INVOICES_PAYMENTS: 'Facturi/plăți' }} />
        <Select label="Severitate" value={filters.severity || ''} onChange={(value) => setField('severity', value)} options={['', 'CRITICAL', 'WARNING', 'INFO']} labels={{ '': 'Toate', CRITICAL: 'Critic', WARNING: 'Warning', INFO: 'Info' }} />
        <Select label="Status" value={filters.status || 'OPEN'} onChange={(value) => setField('status', value)} options={['OPEN', 'RESOLVED', 'IGNORED', '']} labels={{ '': 'Toate', OPEN: 'Deschise', RESOLVED: 'Rezolvate', IGNORED: 'Ignorate' }} />
        <Select label="Impact" value={filters.billingImpact || ''} onChange={(value) => setField('billingImpact', value)} options={['', 'BLOCKS_BILLING', 'AFFECTS_BILLING', 'NO_BILLING_IMPACT']} labels={{ '': 'Toate', ...impactLabel }} />
        <div className="flex items-end">
          <Button variant="secondary" onClick={onRefresh} className="w-full">
            <Search className="h-4 w-4" /> Aplică
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels: Record<string, string> }) {
  return (
    <label className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || 'all'} value={option}>{labels[option] || option}</option>)}
      </select>
    </label>
  );
}

export function AdminDataQualityIssuesPage() {
  const localizedPath = useLocalizedPath();
  const [filters, setFilters] = useState<Record<string, string>>({ status: 'OPEN' });
  const [items, setItems] = useState<DataQualityIssue[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dataQualityApi.issues({ ...filters, limit: 100 });
      const payload = unwrap<any>(res);
      setItems(payload.items || []);
      setStats(payload.stats || {});
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca problemele.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateIssue(id: string, action: 'resolve' | 'ignore' | 'reopen') {
    if (action === 'ignore') {
      const reason = window.prompt('Motiv ignorare');
      if (!reason) return;
      await dataQualityApi.ignoreIssue(id, reason);
    } else if (action === 'resolve') {
      await dataQualityApi.resolveIssue(id, 'Rezolvat manual după verificare.');
    } else {
      await dataQualityApi.reopenIssue(id);
    }
    await load();
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Probleme de date"
        description="Lista completă a problemelor detectate în datele asociației."
        rightSlot={<ButtonLink href={localizedPath('/admin/data-quality')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Overview</ButtonLink>}
      />
      <IssueFilters filters={filters} onChange={setFilters} onRefresh={load} />
      <BulkSelectionToolbar
        entityType="DATA_QUALITY_ISSUE"
        selectedIds={selectedIds}
        onClear={() => setSelectedIds([])}
        onDone={() => {
          setSelectedIds([]);
          void load();
        }}
        actions={[
          { operationType: 'DATA_QUALITY_MARK_RESOLVED', label: 'Marchează rezolvate' },
          { operationType: 'DATA_QUALITY_MARK_IGNORED', label: 'Ignoră selectate', requiresReason: true },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Critice" value={String(stats.critical || 0)} tone={stats.critical ? 'danger' : 'success'} />
        <StatCard label="Warnings" value={String(stats.warning || 0)} tone={stats.warning ? 'warning' : 'success'} />
        <StatCard label="Info" value={String(stats.info || 0)} />
        <StatCard label="Deschise" value={String(stats.open || 0)} />
        <StatCard label="Rezolvate" value={String(stats.resolved || 0)} tone="success" />
      </div>
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell><input type="checkbox" checked={items.length > 0 && items.every((issue) => selectedIds.includes(issue.id))} onChange={(event) => setSelectedIds(event.target.checked ? items.map((issue) => issue.id) : [])} /></TableHeaderCell>
              <TableHeaderCell>Problemă</TableHeaderCell>
              <TableHeaderCell>Categorie</TableHeaderCell>
              <TableHeaderCell>Severitate</TableHeaderCell>
              <TableHeaderCell>Impact</TableHeaderCell>
              <TableHeaderCell>Entitate</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Quick fix</TableHeaderCell>
              <TableHeaderCell>Detectată</TableHeaderCell>
              <TableHeaderCell>Acțiuni</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !items.length ? <TableEmpty colSpan={10}>Nu există probleme pentru filtrele selectate.</TableEmpty> : null}
            {items.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell><input type="checkbox" checked={selectedIds.includes(issue.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, issue.id] : current.filter((id) => id !== issue.id))} /></TableCell>
                <TableCell>
                  <p className="font-semibold text-foreground">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">{issue.description}</p>
                </TableCell>
                <TableCell>{issue.categoryLabel || issue.category}</TableCell>
                <TableCell><Badge variant={severityVariant[issue.severity]}>{severityLabel[issue.severity]}</Badge></TableCell>
                <TableCell>{impactLabel[issue.billingImpact]}</TableCell>
                <TableCell><span className="font-mono text-xs">{issue.entityType}</span></TableCell>
                <TableCell><Badge variant={statusVariant[issue.status]}>{statusLabel[issue.status]}</Badge></TableCell>
                <TableCell>
                  {hasQuickFix(issue) ? <Badge variant="success">Disponibil</Badge> : issue.quickFixes?.length ? <Badge variant="neutral">Manual</Badge> : <Badge variant="neutral">Indisponibil</Badge>}
                </TableCell>
                <TableCell>{formatDateTime(issue.detectedAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}`)} size="sm">Deschide</ButtonLink>
                    {hasQuickFix(issue) ? <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}/fix`)} variant="secondary" size="sm">Remediază</ButtonLink> : null}
                    {issue.actionUrl ? <ButtonLink href={localizeAction(localizedPath, issue.actionUrl)} variant="secondary" size="sm">Entitate</ButtonLink> : null}
                    {issue.status === 'OPEN' ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => updateIssue(issue.id, 'resolve')}>Rezolvat</Button>
                        <Button size="sm" variant="secondary" onClick={() => updateIssue(issue.id, 'ignore')}>Ignoră</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => updateIssue(issue.id, 'reopen')}>Redeschide</Button>
                    )}
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

export function AdminDataQualityIssueDetailPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const id = String(params?.id || '');
  const [issue, setIssue] = useState<DataQualityIssue | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dataQualityApi.getIssue(id);
      const payload = unwrap<any>(res);
      setIssue(payload.issue || null);
      setHistory(payload.history || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca problema.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve() {
    await dataQualityApi.resolveIssue(id, 'Rezolvat manual după verificare.');
    await load();
  }

  async function ignore() {
    await dataQualityApi.ignoreIssue(id, ignoreReason);
    setIgnoreOpen(false);
    setIgnoreReason('');
    await load();
  }

  async function reopen() {
    await dataQualityApi.reopenIssue(id);
    await load();
  }

  return (
    <div className="space-y-6 pb-8">
      <Link href={localizedPath('/admin/data-quality/issues')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la probleme
      </Link>
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {loading ? <LoadingGrid /> : null}
      {issue ? (
        <>
          <PageHeader
            title={issue.title}
            description={issue.description}
            rightSlot={
              <div className="flex flex-wrap gap-2">
                {issue.actionUrl ? <ButtonLink href={localizeAction(localizedPath, issue.actionUrl)}>Mergi la entitate</ButtonLink> : null}
                {hasQuickFix(issue) ? <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}/fix`)} variant="secondary">Aplică remediere</ButtonLink> : null}
                {issue.status === 'OPEN' ? (
                  <>
                    <Button variant="secondary" onClick={resolve}>Marchează ca rezolvată</Button>
                    <Button variant="secondary" onClick={() => setIgnoreOpen(true)}>Ignoră</Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={reopen}>Redeschide</Button>
                )}
              </div>
            }
          />
          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={severityVariant[issue.severity]}>{severityLabel[issue.severity]}</Badge>
              <Badge variant={statusVariant[issue.status]}>{statusLabel[issue.status]}</Badge>
              <Badge variant="neutral">{issue.categoryLabel || issue.category}</Badge>
              <Badge variant="neutral">{impactLabel[issue.billingImpact]}</Badge>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoLine label="Entitate" value={`${issue.entityType}${issue.entityId ? ` · ${issue.entityId}` : ''}`} />
              <InfoLine label="Detectată" value={formatDateTime(issue.detectedAt)} />
              <InfoLine label="Recomandare" value={issue.recommendation} />
              <InfoLine label="Key" value={issue.key} />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground">Remediere recomandată</h2>
            {hasQuickFix(issue) ? (
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Această problemă are remedieri rapide cu preview, confirmare și audit.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {issue.quickFixes?.map((fix) => <Badge key={fix.type || fix.key} variant="neutral">{fix.label}</Badge>)}
                  </div>
                </div>
                <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}/fix`)}>Aplică remediere</ButtonLink>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">Această problemă trebuie rezolvată din pagina entității afectate sau marcată manual după verificare.</p>
                {issue.actionUrl ? <ButtonLink href={localizeAction(localizedPath, issue.actionUrl)} variant="secondary">Deschide entitatea</ButtonLink> : null}
              </div>
            )}
          </Card>
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-foreground">Context</h2>
              <div className="mt-3"><JsonBlock value={issue.metadata} /></div>
            </Card>
            <Card className="p-5">
              <h2 className="text-base font-semibold text-foreground">Istoric status</h2>
              <div className="mt-3 grid gap-2">
                {history.map((event, index) => (
                  <div key={`${event.status}-${index}`} className="rounded-xl border border-border/70 p-3">
                    <p className="text-sm font-semibold text-foreground">{event.label || event.status}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.at)} {event.reason ? `· ${event.reason}` : ''}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      ) : null}
      <Modal isOpen={ignoreOpen} onClose={() => setIgnoreOpen(false)}>
        <ModalHeader title="Ignoră problema" onClose={() => setIgnoreOpen(false)} />
        <ModalBody>
          <Input label="Motiv" value={ignoreReason} onChange={(event) => setIgnoreReason(event.target.value)} placeholder="Acceptat temporar pentru luna curentă" />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIgnoreOpen(false)}>Anulează</Button>
          <Button onClick={ignore} disabled={!ignoreReason.trim()}>Ignoră</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function AdminDataQualityRunsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dataQualityApi.runs({ limit: 50 });
      setItems(unwrap<any>(res).items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Verificări Data Quality"
        description="Istoricul rulărilor de verificare a calității datelor."
        rightSlot={<ButtonLink href={localizedPath('/admin/data-quality')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Overview</ButtonLink>}
      />
      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Luna</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Scor</TableHeaderCell>
              <TableHeaderCell>Critice</TableHeaderCell>
              <TableHeaderCell>Warnings</TableHeaderCell>
              <TableHeaderCell>Info</TableHeaderCell>
              <TableHeaderCell>Rulat de</TableHeaderCell>
              <TableHeaderCell>Finalizat</TableHeaderCell>
              <TableHeaderCell>Acțiuni</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !items.length ? <TableEmpty colSpan={9}>Nu există verificări rulate.</TableEmpty> : null}
            {items.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{run.billingMonth || '—'}</TableCell>
                <TableCell><Badge variant={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'error' : 'warning'}>{run.status}</Badge></TableCell>
                <TableCell>{run.score}</TableCell>
                <TableCell>{run.criticalCount}</TableCell>
                <TableCell>{run.warningCount}</TableCell>
                <TableCell>{run.infoCount}</TableCell>
                <TableCell>{run.actor?.fullName || run.actor?.email || 'Sistem'}</TableCell>
                <TableCell>{formatDateTime(run.completedAt || run.startedAt)}</TableCell>
                <TableCell><ButtonLink href={localizedPath(`/admin/data-quality/runs/${run.id}`)} size="sm">Deschide</ButtonLink></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}

export function AdminDataQualityRunDetailPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const id = String(params?.id || '');
  const [run, setRun] = useState<RunItem | null>(null);
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dataQualityApi.getRun(id);
      const payload = unwrap<any>(res);
      setRun(payload.run || null);
      setIssues(payload.issues || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca verificarea.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-8">
      <Link href={localizedPath('/admin/data-quality/runs')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la rulări
      </Link>
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {loading ? <LoadingGrid /> : null}
      {run ? (
        <>
          <PageHeader
            title={`Verificare ${run.billingMonth || ''}`}
            description="Rezultatul verificărilor Data Quality pentru această rulare."
            rightSlot={<ButtonLink href={localizedPath('/admin/data-quality/issues')} variant="secondary">Vezi problemele</ButtonLink>}
          />
          <div className="grid gap-4 md:grid-cols-5">
            <StatCard label="Scor" value={String(run.score)} tone={scoreTone(run.score, run.criticalCount)} />
            <StatCard label="Critice" value={String(run.criticalCount)} tone={run.criticalCount ? 'danger' : 'success'} />
            <StatCard label="Warnings" value={String(run.warningCount)} tone={run.warningCount ? 'warning' : 'success'} />
            <StatCard label="Info" value={String(run.infoCount)} />
            <StatCard label="Finalizat" value={formatDateTime(run.completedAt || run.startedAt)} />
          </div>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-foreground">Probleme detectate</h2>
            <IssueCards items={issues} />
          </Card>
        </>
      ) : null}
    </div>
  );
}
