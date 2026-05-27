'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Droplets,
  Gauge,
  ListChecks,
  Printer,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { exportsApi, metersApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

const meterTypes = [
  { value: 'ALL', label: 'Toate tipurile' },
  { value: 'COLD_WATER', label: 'Apă rece' },
  { value: 'HOT_WATER', label: 'Apă caldă' },
  { value: 'ELECTRICITY', label: 'Electricitate' },
  { value: 'GAS', label: 'Gaz' },
  { value: 'HEAT', label: 'Căldură' },
  { value: 'OTHER', label: 'Altul' },
];

const statusOptions = [
  { value: 'ALL', label: 'Toate statusurile' },
  { value: 'APPROVED', label: 'Aprobați' },
  { value: 'SUBMITTED', label: 'În așteptare' },
  { value: 'REJECTED', label: 'Respinsi' },
  { value: 'NEEDS_REVIEW', label: 'Needs review' },
];

const sourceOptions = [
  { value: 'ALL', label: 'Toate sursele' },
  { value: 'RESIDENT', label: 'Locatar' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SYSTEM', label: 'Sistem' },
];

const reportStatusLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  COMPLETE: { label: 'Complet', variant: 'success' },
  PARTIAL: { label: 'Parțial', variant: 'warning' },
  MISSING_READINGS: { label: 'Lipsă indici', variant: 'error' },
  NEEDS_REVIEW: { label: 'Needs review', variant: 'warning' },
  NO_METERS: { label: 'Fără contoare', variant: 'neutral' },
};

const readingStatusLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  APPROVED: { label: 'Aprobat', variant: 'success' },
  SUBMITTED: { label: 'În așteptare', variant: 'warning' },
  REJECTED: { label: 'Respins', variant: 'error' },
  NEEDS_REVIEW: { label: 'Needs review', variant: 'warning' },
  CANCELLED: { label: 'Anulat', variant: 'neutral' },
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatNumber(value: unknown, maximumFractionDigits = 2) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits }).format(Number.isFinite(number) ? number : 0);
}

function formatConsumption(entry: any) {
  if (!entry) return '0';
  return `${formatNumber(entry.value)} ${entry.unit || ''}`.trim();
}

function statusBadge(status?: string) {
  const item = reportStatusLabels[String(status || '')] || { label: status || 'Necunoscut', variant: 'neutral' as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

function readingStatusBadge(status?: string) {
  const item = readingStatusLabels[String(status || '')] || { label: status || 'Necunoscut', variant: 'neutral' as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none transition focus:border-foreground/20 focus:ring-2 focus:ring-foreground/10"
      >
        {children}
      </select>
    </label>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <BarChart3 className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="space-y-3">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
        </Card>
      ))}
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">{children}</div>;
}

function MeterTypeCards({ items }: { items: any[] }) {
  if (!items?.some((item) => item.activeMeters || item.approvedReadings || item.totalConsumption)) {
    return (
      <EmptyState
        title="Nu există indici aprobați pentru această perioadă"
        text="Consumurile pe tip de contor vor apărea după aprobarea indicilor."
      />
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.meterType} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.activeMeters} contoare active</p>
            </div>
            <Badge variant="neutral">{item.unit || 'unitate'}</Badge>
          </div>
          <p className="text-2xl font-semibold text-foreground">{formatNumber(item.totalConsumption)} {item.unit}</p>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <span>Aprobați: {item.approvedReadings}</span>
            <span>Lipsă: {item.missingReadings}</span>
            <span>Medie: {formatNumber(item.averageConsumption)} {item.unit}</span>
            <span>Max: {formatNumber(item.maxConsumption)} {item.unit}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StaircaseTable({ items }: { items: any[] }) {
  if (!items?.length) {
    return <EmptyState title="Nu există date pe scări" text="Raportul pe scară va apărea după configurarea contoarelor." />;
  }
  return (
    <TableShell>
      <div className="hidden grid-cols-[0.8fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid">
        <span>Scară</span>
        <span>Acoperire</span>
        <span>Apă rece</span>
        <span>Apă caldă</span>
        <span>Electricitate</span>
        <span>Gaz</span>
      </div>
      {items.map((item) => (
        <div key={item.staircase} className="grid gap-3 border-b border-border/70 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[0.8fr_1fr_1fr_1fr_1fr_1fr]">
          <div>
            <p className="font-semibold text-foreground">{item.staircase || 'Fără scară'}</p>
            <p className="text-xs text-muted-foreground">{item.apartmentsWithMeters} apartamente cu contoare</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">{formatNumber(item.readingCoverageRate)}%</p>
            <p className="text-xs text-muted-foreground">{item.apartmentsWithMissingReadings} fără indici</p>
          </div>
          <div>{formatConsumption(item.consumptionByType?.COLD_WATER)}</div>
          <div>{formatConsumption(item.consumptionByType?.HOT_WATER)}</div>
          <div>{formatConsumption(item.consumptionByType?.ELECTRICITY)}</div>
          <div>{formatConsumption(item.consumptionByType?.GAS)}</div>
        </div>
      ))}
    </TableShell>
  );
}

function ApartmentsTable({ items, localizedPath }: { items: any[]; localizedPath: (href: string) => string }) {
  if (!items?.length) {
    return (
      <EmptyState
        title="Nu există indici pentru perioada selectată"
        text="Indicii transmiși de locatari sau introduși manual vor apărea aici."
        action={<ButtonLink href="/admin/meter-readings" variant="secondary">Vezi indici contoare</ButtonLink>}
      />
    );
  }
  return (
    <TableShell>
      <div className="hidden grid-cols-[0.9fr_0.7fr_1fr_0.9fr_0.9fr_0.9fr_0.7fr_0.9fr_0.9fr] gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground xl:grid">
        <span>Apartament</span>
        <span>Scara</span>
        <span>Contact</span>
        <span>Apă rece</span>
        <span>Apă caldă</span>
        <span>Electricitate</span>
        <span>Lipsă</span>
        <span>Status</span>
        <span>Acțiuni</span>
      </div>
      {items.map((item) => (
        <div key={item.apartment?.id} className="grid gap-3 border-b border-border/70 px-4 py-4 text-sm last:border-b-0 xl:grid-cols-[0.9fr_0.7fr_1fr_0.9fr_0.9fr_0.9fr_0.7fr_0.9fr_0.9fr]">
          <div>
            <p className="font-semibold text-foreground">Ap. {item.apartment?.apartmentNumber || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Etaj {item.apartment?.floor ?? 'N/A'}</p>
          </div>
          <div>{item.apartment?.staircase || 'Fără scară'}</div>
          <div>
            <p className="font-medium text-foreground">{item.primaryContact?.fullName || 'Necompletat'}</p>
            <p className="text-xs text-muted-foreground">{item.primaryContact?.phone || 'Telefon lipsă'}</p>
          </div>
          <div>{formatConsumption(item.consumption?.COLD_WATER)}</div>
          <div>{formatConsumption(item.consumption?.HOT_WATER)}</div>
          <div>{formatConsumption(item.consumption?.ELECTRICITY)}</div>
          <div>{item.missingReadingsCount}</div>
          <div>{statusBadge(item.reportStatus)}</div>
          <div className="flex flex-wrap gap-2">
            <Link href={localizedPath(item.actions?.apartmentUrl || `/admin/apartments/${item.apartment?.id}`)} className="text-xs font-semibold text-primary hover:underline">
              Detalii
            </Link>
            <Link href={localizedPath(item.actions?.readingsUrl || `/admin/meter-readings?apartmentId=${item.apartment?.id}`)} className="text-xs font-semibold text-primary hover:underline">
              Indici
            </Link>
          </div>
        </div>
      ))}
    </TableShell>
  );
}

function MissingTable({ items, localizedPath }: { items: any[]; localizedPath: (href: string) => string }) {
  if (!items?.length) {
    return <EmptyState title="Nu există apartamente fără indici" text="Pentru perioada selectată, contoarele active au indici transmiși sau aprobați." />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <Card key={item.apartment?.id} className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">Ap. {item.apartment?.apartmentNumber || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Scara {item.apartment?.staircase || 'Fără scară'}</p>
            </div>
            <Badge variant="warning">{item.missingMetersCount} lipsă</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {item.primaryContact?.fullName || 'Contact necompletat'} · {item.primaryContact?.phone || 'Telefon lipsă'}
          </p>
          <div className="flex flex-wrap gap-2">
            {item.missingMeters?.map((meter: any) => (
              <Badge key={meter.meterId} variant="neutral">{meter.meterTypeLabel || meter.meterType}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={item.actions?.metersUrl || `/admin/meters?apartmentId=${item.apartment?.id}`} variant="secondary" size="sm">
              Vezi contoare
            </ButtonLink>
            <Link href={localizedPath(item.actions?.readingsUrl || `/admin/meter-readings?apartmentId=${item.apartment?.id}`)} className="inline-flex h-9 items-center rounded-2xl px-3 text-xs font-semibold text-primary hover:bg-muted">
              Adaugă indice manual
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}

function IssuesTable({ items, localizedPath }: { items: any[]; localizedPath: (href: string) => string }) {
  if (!items?.length) {
    return <EmptyState title="Nu există indici cu probleme" text="Nu au fost găsite citiri respinse, suspecte sau în așteptare prelungită pentru filtrele curente." />;
  }
  return (
    <TableShell>
      <div className="hidden grid-cols-[0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_0.7fr] gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid">
        <span>Perioadă</span>
        <span>Apartament</span>
        <span>Contor</span>
        <span>Consum</span>
        <span>Status</span>
        <span>Motiv</span>
        <span>Acțiuni</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid gap-3 border-b border-border/70 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_0.7fr]">
          <div>{item.periodMonth}</div>
          <div>
            <p className="font-semibold text-foreground">Ap. {item.apartment?.apartmentNumber || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Scara {item.apartment?.staircase || 'Fără scară'}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">{item.meter?.typeLabel || 'Contor'}</p>
            <p className="text-xs text-muted-foreground">{item.meter?.meterNumber || 'Fără număr'}</p>
          </div>
          <div>{formatNumber(item.consumptionValue)} {item.unit}</div>
          <div>{readingStatusBadge(item.status)}</div>
          <div className="text-muted-foreground">{item.reason || item.warnings?.[0] || 'Necesită verificare'}</div>
          <div>
            <Link href={localizedPath(item.actionUrl || `/admin/meter-readings/${item.id}`)} className="text-xs font-semibold text-primary hover:underline">
              Deschide
            </Link>
          </div>
        </div>
      ))}
    </TableShell>
  );
}

function TrendTable({ items }: { items: any[] }) {
  if (!items?.some((item) => item.approvedReadings > 0)) {
    return <EmptyState title="Nu există suficiente date pentru trend" text="Trendul va fi disponibil după aprobarea indicilor pentru mai multe luni." />;
  }
  return (
    <TableShell>
      <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
        <span>Lună</span>
        <span>Apă rece</span>
        <span>Apă caldă</span>
        <span>Electricitate</span>
        <span>Aprobați</span>
      </div>
      {items.map((item) => (
        <div key={item.periodMonth} className="grid grid-cols-[0.8fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-border/70 px-4 py-4 text-sm last:border-b-0">
          <span className="font-semibold text-foreground">{item.periodMonth}</span>
          <span>{formatConsumption(item.consumptionByType?.COLD_WATER)}</span>
          <span>{formatConsumption(item.consumptionByType?.HOT_WATER)}</span>
          <span>{formatConsumption(item.consumptionByType?.ELECTRICITY)}</span>
          <span>{item.approvedReadings}</span>
        </div>
      ))}
    </TableShell>
  );
}

function TopConsumption({ items, localizedPath }: { items: any[]; localizedPath: (href: string) => string }) {
  if (!items?.length) {
    return <EmptyState title="Nu există date pentru top consum" text="Topul va apărea după aprobarea indicilor pentru perioada selectată." />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item, index) => (
        <Card key={item.apartmentId} className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">#{index + 1} Consum ridicat</p>
            <h3 className="mt-1 font-semibold text-foreground">Ap. {item.apartment?.apartmentNumber || 'N/A'}</h3>
            <p className="text-sm text-muted-foreground">
              {item.primaryContact?.fullName || 'Contact necompletat'} · Scara {item.apartment?.staircase || 'Fără scară'}
            </p>
            {item.differenceFromPreviousMonth !== null ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Diferență față de luna precedentă: {formatNumber(item.differenceFromPreviousMonth)} {item.unit}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold text-foreground">{formatNumber(item.consumption)} {item.unit}</p>
            <Link href={localizedPath(item.actionUrl || `/admin/meter-readings?apartmentId=${item.apartmentId}`)} className="text-xs font-semibold text-primary hover:underline">
              Vezi detalii
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function MeterConsumptionReportsPage() {
  const localizedPath = useLocalizedPath();
  const [filters, setFilters] = useState({
    periodMonth: currentMonth(),
    meterType: 'ALL',
    staircase: '',
    apartmentNumber: '',
    status: 'ALL',
    source: 'ALL',
    includeInactiveMeters: false,
    missingOnly: false,
    issuesOnly: false,
    minConsumption: '',
    maxConsumption: '',
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(
    () => ({
      periodMonth: filters.periodMonth,
      meterType: filters.meterType === 'ALL' ? undefined : filters.meterType,
      staircase: filters.staircase || undefined,
      apartmentNumber: filters.apartmentNumber || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      source: filters.source === 'ALL' ? undefined : filters.source,
      includeInactiveMeters: filters.includeInactiveMeters || undefined,
      missingOnly: filters.missingOnly || undefined,
      issuesOnly: filters.issuesOnly || undefined,
      minConsumption: filters.minConsumption || undefined,
      maxConsumption: filters.maxConsumption || undefined,
      limit: 40,
    }),
    [filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await metersApi.adminConsumptionReport(params);
      setData(response.data);
    } catch (err: any) {
      setError(err?.message || 'Raportul nu a putut fi încărcat.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const exportCsv = async () => {
    setError('');
    try {
      const res = await exportsApi.adminMeterConsumptionCsv(filters);
      downloadBlob(res.data, `consum-contoare-${filters.periodMonth}.csv`);
    } catch (err: any) {
      setError(err?.message || 'Exportul CSV nu a putut fi generat.');
    }
  };

  const summary = data?.summary || {};
  const totalConsumptionByType = summary.totalConsumptionByType || {};
  const hasMeters = Number(summary.apartmentsWithMeters || 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapoarte consum contoare"
        description="Analizează consumul lunar pe apartamente, scări și tipuri de contoare."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={load} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </Button>
            <ButtonLink href="/admin/meter-readings" variant="secondary">
              <ListChecks className="h-4 w-4" />
              Vezi indici
            </ButtonLink>
            <ButtonLink href="/admin/meters" variant="secondary">
              <Gauge className="h-4 w-4" />
              Vezi contoare
            </ButtonLink>
            <ButtonLink href="/admin/tariffs/meter-based" variant="secondary">
              <Gauge className="h-4 w-4" />
              Configurează tarife pe consum
            </ButtonLink>
            <ButtonLink href={`/admin/meter-readings/reports/print?periodMonth=${filters.periodMonth}`} variant="secondary">
              <Printer className="h-4 w-4" />
              Print
            </ButtonLink>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{data?.association?.shortName || 'APC'}</Badge>
        <Badge variant="neutral">{data?.association?.associationCode || 'Cod APC'}</Badge>
        <Badge variant="warning">Raport informativ, fără facturare automată</Badge>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Lună" type="month" value={filters.periodMonth} onChange={(event) => updateFilter('periodMonth', event.target.value)} />
          <SelectField label="Tip contor" value={filters.meterType} onChange={(value) => updateFilter('meterType', value)}>
            {meterTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
          <Input label="Scară" value={filters.staircase} onChange={(event) => updateFilter('staircase', event.target.value)} placeholder="1" />
          <Input label="Apartament" value={filters.apartmentNumber} onChange={(event) => updateFilter('apartmentNumber', event.target.value)} placeholder="24" />
          <SelectField label="Status" value={filters.status} onChange={(value) => updateFilter('status', value)}>
            {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
          <SelectField label="Sursă" value={filters.source} onChange={(value) => updateFilter('source', value)}>
            {sourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </SelectField>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <Input label="Consum minim" type="number" min="0" value={filters.minConsumption} onChange={(event) => updateFilter('minConsumption', event.target.value)} />
          <Input label="Consum maxim" type="number" min="0" value={filters.maxConsumption} onChange={(event) => updateFilter('maxConsumption', event.target.value)} />
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-medium text-foreground">
            <input type="checkbox" checked={filters.includeInactiveMeters} onChange={(event) => updateFilter('includeInactiveMeters', event.target.checked)} />
            Include contoare inactive
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-medium text-foreground">
            <input type="checkbox" checked={filters.missingOnly} onChange={(event) => updateFilter('missingOnly', event.target.checked)} />
            Doar apartamente fără indici
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-medium text-foreground">
            <input type="checkbox" checked={filters.issuesOnly} onChange={(event) => updateFilter('issuesOnly', event.target.checked)} />
            Doar indici cu probleme
          </label>
        </div>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : !hasMeters ? (
        <EmptyState
          title="Nu există contoare configurate"
          text="Adaugă contoarele apartamentelor pentru a putea genera rapoarte de consum."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/admin/imports/meters" variant="secondary">Importă contoare</ButtonLink>
              <ButtonLink href="/admin/meters">Adaugă contoare</ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total consum apă rece" value={formatConsumption(totalConsumptionByType.COLD_WATER)} icon={<Droplets className="h-5 w-5" />} />
            <StatCard label="Total consum apă caldă" value={formatConsumption(totalConsumptionByType.HOT_WATER)} icon={<Droplets className="h-5 w-5" />} />
            <StatCard label="Total consum electricitate" value={formatConsumption(totalConsumptionByType.ELECTRICITY)} icon={<Zap className="h-5 w-5" />} />
            <StatCard label="Indici aprobați" value={summary.approvedReadings || 0} description={`${summary.submittedReadings || 0} în așteptare`} icon={<ListChecks className="h-5 w-5" />} tone="success" />
            <StatCard label="Rată colectare" value={`${formatNumber(summary.readingCoverageRate)}%`} description={`${summary.apartmentsWithMissingReadings || 0} apartamente fără indici`} icon={<BarChart3 className="h-5 w-5" />} tone={summary.apartmentsWithMissingReadings ? 'warning' : 'success'} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Total consum gaz" value={formatConsumption(totalConsumptionByType.GAS)} />
            <StatCard label="Total consum căldură" value={formatConsumption(totalConsumptionByType.HEAT)} />
            <StatCard label="Indici respinși" value={summary.rejectedReadings || 0} tone={summary.rejectedReadings ? 'danger' : 'neutral'} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard label="Needs review" value={summary.needsReviewReadings || 0} tone={summary.needsReviewReadings ? 'warning' : 'neutral'} icon={<Search className="h-5 w-5" />} />
          </div>

          <section className="space-y-3">
            <SectionTitle title="Consum pe tip de contor" description="Agregare informativă din indicii aprobați pentru luna selectată." />
            <MeterTypeCards items={data?.byMeterType || []} />
          </section>

          <section className="space-y-3">
            <SectionTitle title="Consum pe scară" description="Acoperire și consum pe scări, inclusiv scările necompletate." />
            <StaircaseTable items={data?.byStaircase || []} />
          </section>

          <section className="space-y-3">
            <SectionTitle title="Consum pe apartamente" description="Raportul principal pe apartament, cu statusul de colectare a indicilor." />
            <ApartmentsTable items={data?.items || []} localizedPath={localizedPath} />
          </section>

          <section className="space-y-3">
            <SectionTitle title="Apartamente fără indici" description="Apartamente cu contoare active care nu au indice aprobat sau transmis pentru luna selectată." />
            <MissingTable items={data?.missing?.items || []} localizedPath={localizedPath} />
          </section>

          <section className="space-y-3">
            <SectionTitle title="Indici cu probleme" description="Citiri respinse, în review sau cu valori suspecte față de luna precedentă." />
            <IssuesTable items={data?.issues?.items || []} localizedPath={localizedPath} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <SectionTitle title="Trend consum" description="Ultimele luni cu indici aprobați, afișate fără calcule de plată." />
              <TrendTable items={data?.trends?.items || []} />
            </div>
            <div className="space-y-3">
              <SectionTitle title="Top consum" description="Top apartamente după consumul aprobat pentru filtrul curent." />
              <TopConsumption items={data?.topConsumption?.items || []} localizedPath={localizedPath} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
