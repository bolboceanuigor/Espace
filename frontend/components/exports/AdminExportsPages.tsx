'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow, TableWrapper } from '@/components/ui';
import { exportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

const currentMonth = () => new Date().toISOString().slice(0, 7);

type ExportCard = {
  key: string;
  title: string;
  description: string;
  sourceHref: string;
  filters: string;
  fileName: string;
  exportCsv: (params: Record<string, string>) => Promise<{ data: Blob }>;
  params: (filters: ExportFilters) => Record<string, string>;
};

type ExportFilters = {
  billingMonth: string;
  periodMonth: string;
  fromMonth: string;
  toMonth: string;
  status: string;
  staircase: string;
};

const initialFilters = (): ExportFilters => ({
  billingMonth: currentMonth(),
  periodMonth: currentMonth(),
  fromMonth: '',
  toMonth: currentMonth(),
  status: 'ALL',
  staircase: '',
});

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'Necompletat';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Necompletat';
  return date.toLocaleDateString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function AdminExportsPage() {
  const localizedPath = useLocalizedPath();
  const [filters, setFilters] = useState<ExportFilters>(initialFilters);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [options, setOptions] = useState<any>(null);

  useEffect(() => {
    exportsApi.adminExportOptions().then((res) => setOptions(res.data)).catch(() => undefined);
  }, []);

  const cards: ExportCard[] = useMemo(
    () => [
      {
        key: 'invoices',
        title: 'Facturi interne',
        description: 'Lista facturilor finale cu sold, status și contact principal.',
        sourceHref: '/admin/invoices',
        filters: 'luna, status, scara',
        fileName: `espace-facturi-${filters.billingMonth}.csv`,
        exportCsv: exportsApi.adminInvoicesCsv,
        params: (values) => ({ billingMonth: values.billingMonth, status: values.status, staircase: values.staircase }),
      },
      {
        key: 'payments',
        title: 'Plăți',
        description: 'Plățile interne înregistrate, inclusiv metodă, referință și status.',
        sourceHref: '/admin/payments',
        filters: 'luna, status, scara',
        fileName: `espace-plati-${filters.billingMonth}.csv`,
        exportCsv: exportsApi.adminPaymentsCsv,
        params: (values) => ({ billingMonth: values.billingMonth, status: values.status, staircase: values.staircase }),
      },
      {
        key: 'balances',
        title: 'Solduri apartamente',
        description: 'Sumar financiar pe apartament: facturat, achitat, sold și status.',
        sourceHref: '/admin/payments/reconciliation',
        filters: 'luna, scara',
        fileName: `espace-solduri-${filters.billingMonth}.csv`,
        exportCsv: exportsApi.adminApartmentBalancesCsv,
        params: (values) => ({ billingMonth: values.billingMonth, staircase: values.staircase }),
      },
      {
        key: 'monthly',
        title: 'Raport financiar lunar',
        description: 'Evoluție lunară cu total facturat, încasat și rata de colectare.',
        sourceHref: '/admin/reports/financial/monthly',
        filters: 'interval luni',
        fileName: `espace-raport-financiar-${filters.toMonth}.csv`,
        exportCsv: exportsApi.adminFinancialMonthlyCsv,
        params: (values) => ({ fromMonth: values.fromMonth, toMonth: values.toMonth }),
      },
      {
        key: 'aging',
        title: 'Aging / solduri restante',
        description: 'Facturi restante grupate pe bucket-uri de vechime.',
        sourceHref: '/admin/reports/financial/aging',
        filters: 'luna, scara',
        fileName: `espace-aging-${filters.billingMonth}.csv`,
        exportCsv: exportsApi.adminAgingCsv,
        params: (values) => ({ billingMonth: values.billingMonth, staircase: values.staircase }),
      },
      {
        key: 'meters',
        title: 'Consum contoare',
        description: 'Consum și indici pe contoare pentru perioada selectată.',
        sourceHref: '/admin/meter-readings/reports',
        filters: 'luna indici, status, scara',
        fileName: `espace-consum-contoare-${filters.periodMonth}.csv`,
        exportCsv: exportsApi.adminMeterConsumptionCsv,
        params: (values) => ({ periodMonth: values.periodMonth, status: values.status, staircase: values.staircase }),
      },
      {
        key: 'apartments',
        title: 'Apartamente',
        description: 'Datele de bază ale apartamentelor și contactul principal.',
        sourceHref: '/admin/apartments',
        filters: 'scara, status',
        fileName: 'espace-apartamente.csv',
        exportCsv: exportsApi.adminApartmentsCsv,
        params: (values) => ({ staircase: values.staircase, status: values.status }),
      },
      {
        key: 'residents',
        title: 'Locatari și proprietari',
        description: 'Persoane, date de contact și relațiile lor cu apartamentele.',
        sourceHref: '/admin/residents',
        filters: 'rol, status, contact principal',
        fileName: 'espace-locatari.csv',
        exportCsv: exportsApi.adminResidentsCsv,
        params: (values) => ({ status: values.status }),
      },
    ],
    [filters.billingMonth, filters.periodMonth, filters.toMonth],
  );

  const updateFilter = <K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const runExport = async (card: ExportCard) => {
    setBusy(card.key);
    setMessage('');
    setError('');
    try {
      const res = await card.exportCsv(card.params(filters));
      downloadBlob(res.data, card.fileName);
      setMessage(`Exportul "${card.title}" a fost generat.`);
    } catch (err: any) {
      setError(err?.message || 'Exportul nu a putut fi generat.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Exporturi"
        description="Exportă datele asociației în format CSV pentru verificare, raportare internă sau lucru offline."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">CSV</Badge>
            <ButtonLink href={localizedPath('/admin/exports/history')} variant="secondary">
              <Clock3 className="h-4 w-4" />
              Istoric
            </ButtonLink>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input label="Luna facturare" type="month" value={filters.billingMonth} onChange={(event) => updateFilter('billingMonth', event.target.value)} />
          <Input label="Luna indici" type="month" value={filters.periodMonth} onChange={(event) => updateFilter('periodMonth', event.target.value)} />
          <Input label="De la luna" type="month" value={filters.fromMonth} onChange={(event) => updateFilter('fromMonth', event.target.value)} />
          <Input label="Până la luna" type="month" value={filters.toMonth} onChange={(event) => updateFilter('toMonth', event.target.value)} />
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="ALL">Toate</option>
              <option value="ISSUED">ISSUED</option>
              <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
              <option value="PAID">PAID</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Scara</span>
            <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={filters.staircase} onChange={(event) => updateFilter('staircase', event.target.value)}>
              <option value="">Toate scările</option>
              {(options?.staircases || []).map((item: string) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key} className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">Filtre: {card.filters}</Badge>
                <Badge variant="warning">Excel avansat în curând</Badge>
                <Badge variant="neutral">PDF în curând</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runExport(card)} isLoading={busy === card.key}>
                <Download className="h-4 w-4" />
                Exportă CSV
              </Button>
              <ButtonLink href={localizedPath(card.sourceHref)} variant="secondary">
                Sursa
              </ButtonLink>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

export function AdminExportHistoryPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [exportType, setExportType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await exportsApi.adminExportHistory({ exportType: exportType || undefined, page: 1, limit: 50 });
      setRows(res.data?.items || []);
      setMeta(res.data?.meta || null);
    } catch (err: any) {
      setError(err?.message || 'Istoricul exporturilor nu a putut fi încărcat.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [exportType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Istoric exporturi"
        description="Vezi ultimele exporturi CSV generate pentru asociație."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={localizedPath('/admin/exports')} variant="secondary">Exporturi</ButtonLink>
            <Button onClick={load} variant="secondary" isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Exporturi afișate" value={String(rows.length)} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Total loguri" value={String(meta?.total || rows.length)} icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Format" value="CSV" icon={<FileSpreadsheet className="h-5 w-5" />} />
      </section>

      <Card>
        <label className="grid max-w-xs gap-1">
          <span className="text-xs font-medium text-muted-foreground">Tip export</span>
          <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={exportType} onChange={(event) => setExportType(event.target.value)}>
            <option value="">Toate</option>
            <option value="INVOICES">Facturi</option>
            <option value="PAYMENTS">Plăți</option>
            <option value="APARTMENT_BALANCES">Solduri apartamente</option>
            <option value="FINANCIAL_MONTHLY">Raport financiar lunar</option>
            <option value="AGING">Aging</option>
            <option value="METER_CONSUMPTION">Consum contoare</option>
            <option value="APARTMENTS">Apartamente</option>
            <option value="RESIDENTS">Locatari</option>
          </select>
        </label>
      </Card>

      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell>Tip</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Rânduri</TableHeaderCell>
              <TableHeaderCell>Fișier</TableHeaderCell>
              <TableHeaderCell>Generat de</TableHeaderCell>
              <TableHeaderCell>Acțiuni</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableEmpty colSpan={7}>Se încarcă istoricul...</TableEmpty> : null}
            {!loading && rows.length === 0 ? <TableEmpty colSpan={7}>Nu există exporturi generate.</TableEmpty> : null}
            {!loading && rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>{row.exportType || '-'}</TableCell>
                <TableCell><Badge variant={row.status === 'FAILED' ? 'error' : 'success'}>{row.status}</Badge></TableCell>
                <TableCell>{row.rowsCount ?? 0}</TableCell>
                <TableCell className="font-mono text-xs">{row.fileName || '-'}</TableCell>
                <TableCell>{row.actor?.fullName || row.actor?.email || '-'}</TableCell>
                <TableCell><ButtonLink href={localizedPath('/admin/exports')} size="sm" variant="secondary">Regenerează</ButtonLink></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}
