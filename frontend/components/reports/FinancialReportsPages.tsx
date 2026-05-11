'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BarChart3, Download, FileText, History, RefreshCw, WalletCards } from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
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
import { exportsApi, reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

const mdl = new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 });

type FinancialFilters = {
  periodMode: 'MONTH' | 'RANGE';
  billingMonth: string;
  dateFrom: string;
  dateTo: string;
  invoiceStatus: string;
  staircase: string;
  apartmentNumber: string;
  includeCancelled: boolean;
  includeVoid: boolean;
};

const statusLabel: Record<string, string> = {
  ISSUED: 'Neachitată',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const financialStatusLabel: Record<string, string> = {
  LA_ZI: 'La zi',
  SOLD_RESTANT: 'Sold restant',
  PARTIAL: 'Parțial achitat',
  INTARZIAT: 'Scadență depășită',
  FARA_FACTURI: 'Fără facturi',
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium' }).format(new Date(value));
}

function unwrap<T>(res: any): T {
  return res?.data || res;
}

function collection(value?: number) {
  return `${Number(value || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}%`;
}

function buildParams(filters: FinancialFilters) {
  return {
    periodMode: filters.periodMode,
    billingMonth: filters.periodMode === 'MONTH' ? filters.billingMonth : undefined,
    dateFrom: filters.periodMode === 'RANGE' ? filters.dateFrom : undefined,
    dateTo: filters.periodMode === 'RANGE' ? filters.dateTo : undefined,
    invoiceStatus: filters.invoiceStatus || undefined,
    staircase: filters.staircase || undefined,
    apartmentNumber: filters.apartmentNumber || undefined,
    includeCancelled: filters.includeCancelled || undefined,
    includeVoid: filters.includeVoid || undefined,
  };
}

function FinancialFiltersCard({
  filters,
  setFilters,
  onRefresh,
}: {
  filters: FinancialFilters;
  setFilters: (next: FinancialFilters) => void;
  onRefresh: () => void;
}) {
  const setField = (key: keyof FinancialFilters, value: any) => setFilters({ ...filters, [key]: value });
  return (
    <Card className="p-4">
      <div className="grid gap-3 lg:grid-cols-6">
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>Perioadă</span>
          <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={filters.periodMode} onChange={(event) => setField('periodMode', event.target.value)}>
            <option value="MONTH">Lună</option>
            <option value="RANGE">Interval</option>
          </select>
        </label>
        {filters.periodMode === 'MONTH' ? (
          <Input label="Lună" type="month" value={filters.billingMonth} onChange={(event) => setField('billingMonth', event.target.value)} />
        ) : (
          <>
            <Input label="De la" type="date" value={filters.dateFrom} onChange={(event) => setField('dateFrom', event.target.value)} />
            <Input label="Până la" type="date" value={filters.dateTo} onChange={(event) => setField('dateTo', event.target.value)} />
          </>
        )}
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>Status</span>
          <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={filters.invoiceStatus} onChange={(event) => setField('invoiceStatus', event.target.value)}>
            <option value="ALL">Toate</option>
            {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <Input label="Scara" value={filters.staircase} onChange={(event) => setField('staircase', event.target.value)} />
        <Input label="Apartament" value={filters.apartmentNumber} onChange={(event) => setField('apartmentNumber', event.target.value)} />
        <div className="flex items-end gap-2">
          <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input type="checkbox" checked={filters.includeCancelled} onChange={(event) => setField('includeCancelled', event.target.checked)} />
            Anulate
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input type="checkbox" checked={filters.includeVoid} onChange={(event) => setField('includeVoid', event.target.checked)} />
            Void
          </label>
          <Button variant="secondary" onClick={onRefresh} aria-label="Actualizează">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SummaryCards({ summary }: { summary: any }) {
  return (
    <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      <StatCard label="Total facturat" value={mdl.format(summary?.totalInvoiced || 0)} />
      <StatCard label="Total încasat" value={mdl.format(summary?.totalPaid || 0)} />
      <StatCard label="Sold restant" value={mdl.format(summary?.outstandingBalance || 0)} />
      <StatCard label="Rata colectare" value={collection(summary?.collectionRate)} />
      <StatCard label="Total facturi" value={summary?.totalInvoices || 0} />
      <StatCard label="Facturi întârziate" value={summary?.overdueInvoices || 0} />
      <StatCard label="Achitate" value={summary?.paidInvoices || 0} />
      <StatCard label="Parțiale" value={summary?.partiallyPaidInvoices || 0} />
      <StatCard label="Neachitate" value={summary?.unpaidInvoices || 0} />
      <StatCard label="Plăți înregistrate" value={summary?.confirmedPayments || 0} />
      <StatCard label="Ultima plată" value={formatDate(summary?.lastPaymentAt)} />
      <StatCard label="Ultima factură" value={formatDate(summary?.lastInvoiceAt)} />
    </section>
  );
}

function StatusBreakdown({ items }: { items: any[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-foreground">Status facturi</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {(items || []).map((item) => (
          <div key={item.status} className="rounded-lg border border-border p-3">
            <Badge variant={item.status === 'PAID' ? 'success' : item.status === 'CANCELLED' || item.status === 'VOID' ? 'neutral' : 'warning'}>{statusLabel[item.status] || item.status}</Badge>
            <p className="mt-3 text-xl font-semibold text-foreground">{item.count}</p>
            <p className="text-xs text-muted-foreground">Facturat {mdl.format(item.totalInvoiced || 0)}</p>
            <p className="text-xs text-muted-foreground">Încasat {mdl.format(item.totalPaid || 0)}</p>
            <p className="text-xs text-muted-foreground">Sold {mdl.format(item.outstandingBalance || 0)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrendTable({ items }: { items: any[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-foreground">Evoluție pe luni</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Luna</th>
              <th>Facturat</th>
              <th>Încasat</th>
              <th>Sold</th>
              <th>Colectare</th>
              <th>Facturi</th>
              <th>Plăți</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.billingMonth} className="border-t border-border">
                <td className="py-2 font-medium">{item.billingMonth}</td>
                <td>{mdl.format(item.totalInvoiced || 0)}</td>
                <td>{mdl.format(item.totalPaid || 0)}</td>
                <td>{mdl.format(item.outstandingBalance || 0)}</td>
                <td>{collection(item.collectionRate)}</td>
                <td>{item.totalInvoices}</td>
                <td>{item.confirmedPayments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ApartmentRows({ items, compact = false }: { items: any[]; compact?: boolean }) {
  const localizedPath = useLocalizedPath();
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Apartament</TableHeaderCell>
            <TableHeaderCell>Contact</TableHeaderCell>
            <TableHeaderCell>Total facturat</TableHeaderCell>
            <TableHeaderCell>Încasat</TableHeaderCell>
            <TableHeaderCell>Sold</TableHeaderCell>
            <TableHeaderCell>Neachitate</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Acțiuni</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!items.length ? <TableEmpty colSpan={8}>Nu există date pentru apartamente.</TableEmpty> : null}
          {items.map((item) => (
            <TableRow key={item.apartment.id}>
              <TableCell>Apt. {item.apartment.apartmentNumber}<p className="text-xs text-muted-foreground">Scara {item.apartment.staircase || '—'}</p></TableCell>
              <TableCell>{item.primaryContact?.fullName || '—'}<p className="text-xs text-muted-foreground">{item.primaryContact?.phone || '—'}</p></TableCell>
              <TableCell>{mdl.format(item.summary.totalInvoiced || 0)}</TableCell>
              <TableCell>{mdl.format(item.summary.totalPaid || 0)}</TableCell>
              <TableCell className="font-semibold">{mdl.format(item.summary.outstandingBalance || 0)}</TableCell>
              <TableCell>{item.summary.unpaidInvoices || 0}</TableCell>
              <TableCell><Badge variant={item.summary.financialStatus === 'LA_ZI' ? 'success' : item.summary.financialStatus === 'INTARZIAT' ? 'error' : item.summary.financialStatus === 'FARA_FACTURI' ? 'neutral' : 'warning'}>{financialStatusLabel[item.summary.financialStatus] || item.summary.financialStatus}</Badge></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={localizedPath(`/admin/apartments/${item.apartment.id}`)} size="sm" variant="secondary">Apartament</ButtonLink>
                  {!compact ? <ButtonLink href={localizedPath(`/admin/payments/reconciliation?apartmentId=${item.apartment.id}`)} size="sm" variant="secondary">Reconciliere</ButtonLink> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}

export function ReportsHomePage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.adminOverview().then((res) => setData(unwrap(res))).finally(() => setLoading(false));
  }, []);

  const financial = data?.financial || {};
  const cards = data?.cards || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Rapoarte" description="Analizează situația financiară, plățile, consumurile și activitatea asociației." />
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Facturat luna curentă" value={mdl.format(financial.totalInvoiced || 0)} />
        <StatCard label="Încasat luna curentă" value={mdl.format(financial.totalPaid || 0)} />
        <StatCard label="Sold restant" value={mdl.format(financial.outstandingBalance || 0)} />
        <StatCard label="Rata colectare" value={collection(financial.collectionRate)} />
      </section>
      {loading ? <Card className="p-5 text-sm text-muted-foreground">Se încarcă rapoartele...</Card> : null}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card: any) => (
          <Link key={card.key} href={localizedPath(card.href)}>
            <Card className="h-full p-5 transition hover:border-foreground/20 hover:bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    {card.key === 'financial' ? <WalletCards className="h-5 w-5" /> : card.key === 'audit' ? <History className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <p className="mt-3 text-base font-semibold text-foreground">{card.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                  {card.key === 'financial' ? (
                    <div className="mt-3 text-sm text-muted-foreground">
                      <p>Facturat: {mdl.format(financial.totalInvoiced || 0)}</p>
                      <p>Încasat: {mdl.format(financial.totalPaid || 0)}</p>
                      <p>Colectare: {collection(financial.collectionRate)}</p>
                    </div>
                  ) : null}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}

export function FinancialOverviewPage() {
  const searchParams = useSearchParams();
  const localizedPath = useLocalizedPath();
  const [filters, setFilters] = useState<FinancialFilters>({
    periodMode: 'MONTH',
    billingMonth: searchParams.get('billingMonth') || currentMonth(),
    dateFrom: '',
    dateTo: '',
    invoiceStatus: 'ALL',
    staircase: '',
    apartmentNumber: '',
    includeCancelled: false,
    includeVoid: false,
  });
  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => buildParams(filters), [filters]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, trendRes, apartmentsRes, invoicesRes, paymentsRes] = await Promise.all([
        reportsApi.adminFinancialOverview(params),
        reportsApi.adminFinancialMonthlyTrend({ months: 6, includeCancelled: filters.includeCancelled, includeVoid: filters.includeVoid }),
        reportsApi.adminFinancialApartments({ ...params, limit: 10 }),
        reportsApi.adminFinancialRecentInvoices({ limit: 10 }),
        reportsApi.adminFinancialRecentPayments({ limit: 10 }),
      ]);
      setOverview(unwrap(overviewRes));
      setTrend(unwrap<any>(trendRes).items || []);
      setApartments(unwrap<any>(apartmentsRes).items || []);
      setRecentInvoices(unwrap<any>(invoicesRes).items || []);
      setRecentPayments(unwrap<any>(paymentsRes).items || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca raportul financiar.'));
    } finally {
      setLoading(false);
    }
  }, [filters.includeCancelled, filters.includeVoid, params]);

  useEffect(() => {
    load();
  }, [load]);

  const periodLabel = filters.periodMode === 'MONTH' ? filters.billingMonth : `${filters.dateFrom || '—'} - ${filters.dateTo || '—'}`;
  const exportMonthly = async () => {
    const res = await exportsApi.adminFinancialMonthlyCsv({ fromMonth: filters.billingMonth, toMonth: filters.billingMonth, includeCancelled: filters.includeCancelled, includeVoid: filters.includeVoid });
    downloadBlob(res.data, `raport-financiar-${filters.billingMonth}.csv`);
  };
  const exportBalances = async () => {
    const res = await exportsApi.adminApartmentBalancesCsv({ ...params, staircase: filters.staircase || undefined, apartmentNumber: filters.apartmentNumber || undefined });
    downloadBlob(res.data, `solduri-apartamente-${filters.billingMonth}.csv`);
  };
  const exportAging = async () => {
    const res = await exportsApi.adminAgingCsv({ ...params, staircase: filters.staircase || undefined, apartmentNumber: filters.apartmentNumber || undefined });
    downloadBlob(res.data, `aging-${filters.billingMonth}.csv`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapoarte financiare"
        description="Urmărește facturile, încasările și soldurile asociației."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Actualizează</Button>
            <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary">Vezi facturi</ButtonLink>
            <ButtonLink href={localizedPath('/admin/payments')} variant="secondary">Vezi plăți</ButtonLink>
            <ButtonLink href={localizedPath(`/admin/payments/reconciliation?billingMonth=${filters.billingMonth}`)} variant="secondary">Reconciliere</ButtonLink>
            <ButtonLink href={localizedPath(`/admin/billing?billingMonth=${filters.billingMonth}`)} variant="secondary">Proces facturare</ButtonLink>
            <Button variant="secondary" onClick={exportMonthly}><Download className="h-4 w-4" /> Export lunar</Button>
            <Button variant="secondary" onClick={exportBalances}>Export solduri</Button>
            <Button variant="secondary" onClick={exportAging}>Export aging</Button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{overview?.association?.shortName || 'APC'}</Badge>
        <Badge variant="neutral">{overview?.association?.associationCode || 'Cod APC'}</Badge>
        <Badge variant="neutral">MDL</Badge>
        <Badge variant="neutral">{periodLabel}</Badge>
      </div>
      <FinancialFiltersCard filters={filters} setFilters={setFilters} onRefresh={load} />
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {loading ? <Card className="p-5 text-sm text-muted-foreground">Se încarcă raportul...</Card> : null}
      {overview ? (
        <>
          <SummaryCards summary={overview.summary} />
          <StatusBreakdown items={overview.statusBreakdown || []} />
          <TrendTable items={trend} />
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Raport pe apartamente</h2>
              <ButtonLink href={localizedPath(`/admin/reports/financial/apartments?billingMonth=${filters.billingMonth}`)} variant="secondary" size="sm">Vezi toate</ButtonLink>
            </div>
            <ApartmentRows items={apartments} compact />
          </Card>
          <RecentLists invoices={recentInvoices} payments={recentPayments} />
        </>
      ) : null}
    </div>
  );
}

function RecentLists({ invoices, payments }: { invoices: any[]; payments: any[] }) {
  const localizedPath = useLocalizedPath();
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Facturi recente</h2>
          <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary" size="sm">Vezi toate facturile</ButtonLink>
        </div>
        <div className="mt-4 space-y-3">
          {!invoices.length ? <p className="text-sm text-muted-foreground">Nu există facturi pentru perioada selectată.</p> : null}
          {invoices.map((invoice) => (
            <div key={invoice.invoiceId || invoice.id} className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">{invoice.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">Apt. {invoice.apartment?.apartmentNumber} · {invoice.billingMonth} · sold {mdl.format(invoice.balanceAmount || 0)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Plăți recente</h2>
          <ButtonLink href={localizedPath('/admin/payments')} variant="secondary" size="sm">Vezi toate plățile</ButtonLink>
        </div>
        <div className="mt-4 space-y-3">
          {!payments.length ? <p className="text-sm text-muted-foreground">Nu există plăți înregistrate.</p> : null}
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">{mdl.format(payment.amount || 0)} · {payment.method}</p>
              <p className="text-sm text-muted-foreground">Apt. {payment.apartment?.apartmentNumber || '—'} · {payment.invoiceNumber || '—'} · {formatDate(payment.paymentDate)}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

export function MonthlyFinancialReportPage() {
  const searchParams = useSearchParams();
  const localizedPath = useLocalizedPath();
  const [billingMonth, setBillingMonth] = useState(searchParams.get('billingMonth') || currentMonth());
  const [overview, setOverview] = useState<any>(null);

  const load = useCallback(async () => {
    const res = await reportsApi.adminFinancialOverview({ periodMode: 'MONTH', billingMonth });
    setOverview(unwrap(res));
  }, [billingMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    const res = await exportsApi.adminFinancialMonthlyCsv({ fromMonth: billingMonth, toMonth: billingMonth });
    downloadBlob(res.data, `raport-financiar-${billingMonth}.csv`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raport financiar lunar"
        description="Raport detaliat pentru luna selectată."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Actualizează</Button>
            <Button onClick={exportCsv} variant="secondary"><Download className="h-4 w-4" /> Export CSV</Button>
          </div>
        }
      />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[220px_auto]">
          <Input label="Luna" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <div className="flex items-end gap-2">
            <ButtonLink href={localizedPath(`/admin/payments/reconciliation?billingMonth=${billingMonth}`)} variant="secondary">Reconciliere</ButtonLink>
            {overview?.billingRun?.id ? <ButtonLink href={localizedPath(`/admin/billing/runs/${overview.billingRun.id}`)} variant="secondary">Vezi procesul lunar</ButtonLink> : null}
          </div>
        </div>
      </Card>
      {overview ? (
        <>
          {overview.billingRun ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-foreground">Proces facturare asociat</h2>
              <p className="mt-2 text-sm text-muted-foreground">Status {overview.billingRun.status} · facturi {overview.billingRun.invoicesCount || 0} · finalizat {formatDate(overview.billingRun.finalizedAt)}</p>
            </Card>
          ) : null}
          <SummaryCards summary={overview.summary} />
          <StatusBreakdown items={overview.statusBreakdown || []} />
        </>
      ) : <Card className="p-5 text-sm text-muted-foreground">Se încarcă raportul lunar...</Card>}
    </div>
  );
}

export function ApartmentsFinancialReportPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    billingMonth: searchParams.get('billingMonth') || currentMonth(),
    staircase: '',
    financialStatus: '',
    minBalance: '',
    maxBalance: '',
    search: '',
  });
  const [data, setData] = useState<any>({ items: [], meta: { total: 0 } });

  const load = useCallback(async () => {
    const res = await reportsApi.adminFinancialApartments({ ...filters, periodMode: 'MONTH', limit: 50 });
    setData(unwrap(res));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    const res = await exportsApi.adminApartmentBalancesCsv(filters);
    downloadBlob(res.data, `raport-apartamente-${filters.billingMonth}.csv`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raport financiar pe apartamente"
        description="Analizează soldurile, încasările și facturile pe fiecare apartament."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Actualizează</Button>
            <Button onClick={exportCsv} variant="secondary"><Download className="h-4 w-4" /> Export CSV</Button>
          </div>
        }
      />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input label="Luna" type="month" value={filters.billingMonth} onChange={(event) => setFilters((current) => ({ ...current, billingMonth: event.target.value }))} />
          <Input label="Scara" value={filters.staircase} onChange={(event) => setFilters((current) => ({ ...current, staircase: event.target.value }))} />
          <label className="space-y-1 text-sm font-medium text-foreground">
            <span>Status financiar</span>
            <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={filters.financialStatus} onChange={(event) => setFilters((current) => ({ ...current, financialStatus: event.target.value }))}>
              <option value="">Toate</option>
              {Object.entries(financialStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <Input label="Sold min." type="number" value={filters.minBalance} onChange={(event) => setFilters((current) => ({ ...current, minBalance: event.target.value }))} />
          <Input label="Sold max." type="number" value={filters.maxBalance} onChange={(event) => setFilters((current) => ({ ...current, maxBalance: event.target.value }))} />
          <Input label="Search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Apartamente</h2>
          <Badge variant="neutral">{data.meta?.total || 0} rezultate</Badge>
        </div>
        <ApartmentRows items={data.items || []} />
      </Card>
    </div>
  );
}

export function AgingFinancialReportPage() {
  const searchParams = useSearchParams();
  const localizedPath = useLocalizedPath();
  const [filters, setFilters] = useState({ billingMonth: searchParams.get('billingMonth') || currentMonth(), staircase: '', minDaysOverdue: '' });
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    const res = await reportsApi.adminFinancialAging({ periodMode: 'MONTH', ...filters, limit: 50 });
    setData(unwrap(res));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    const res = await exportsApi.adminAgingCsv(filters);
    downloadBlob(res.data, `aging-${filters.billingMonth}.csv`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aging solduri restante"
        description="Vezi soldurile restante pe vechime, fără penalități automate."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Actualizează</Button>
            <Button onClick={exportCsv} variant="secondary"><Download className="h-4 w-4" /> Export CSV</Button>
          </div>
        }
      />
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[220px_160px_180px_auto]">
          <Input label="Luna" type="month" value={filters.billingMonth} onChange={(event) => setFilters((current) => ({ ...current, billingMonth: event.target.value }))} />
          <Input label="Scara" value={filters.staircase} onChange={(event) => setFilters((current) => ({ ...current, staircase: event.target.value }))} />
          <Input label="Zile întârziere min." type="number" value={filters.minDaysOverdue} onChange={(event) => setFilters((current) => ({ ...current, minDaysOverdue: event.target.value }))} />
          <div className="flex items-end">
            <ButtonLink href={localizedPath(`/admin/reports/financial?billingMonth=${filters.billingMonth}`)} variant="secondary">Înapoi la financiar</ButtonLink>
          </div>
        </div>
      </Card>
      {data ? (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            {(data.buckets || []).map((bucket: any) => (
              <Card key={bucket.key} className="p-5">
                <p className="text-sm text-muted-foreground">{bucket.label}</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{mdl.format(bucket.amount || 0)}</p>
                <p className="text-xs text-muted-foreground">{bucket.invoicesCount} facturi · {bucket.apartmentsCount} apartamente · {collection(bucket.percentage)}</p>
              </Card>
            ))}
          </section>
          <Card className="p-5">
            <TableWrapper>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Apartament</TableHeaderCell>
                    <TableHeaderCell>Factură</TableHeaderCell>
                    <TableHeaderCell>Scadență</TableHeaderCell>
                    <TableHeaderCell>Zile</TableHeaderCell>
                    <TableHeaderCell>Sold</TableHeaderCell>
                    <TableHeaderCell>Bucket</TableHeaderCell>
                    <TableHeaderCell>Acțiuni</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!data.items?.length ? <TableEmpty colSpan={7}>Nu există solduri restante pentru perioada selectată.</TableEmpty> : null}
                  {(data.items || []).map((item: any) => (
                    <TableRow key={item.invoiceId}>
                      <TableCell>Apt. {item.apartment.apartmentNumber}<p className="text-xs text-muted-foreground">{item.primaryContact?.fullName || '—'}</p></TableCell>
                      <TableCell>{item.invoiceNumber}<p className="text-xs text-muted-foreground">{item.billingMonth}</p></TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell>{item.daysOverdue}</TableCell>
                      <TableCell className="font-semibold">{mdl.format(item.balanceAmount || 0)}</TableCell>
                      <TableCell><Badge variant={item.bucket === '90_PLUS' ? 'error' : 'warning'}>{item.bucketLabel}</Badge></TableCell>
                      <TableCell><ButtonLink href={localizedPath(`/admin/invoices/${item.invoiceId}`)} size="sm" variant="secondary">Deschide</ButtonLink></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </Card>
        </>
      ) : <Card className="p-5 text-sm text-muted-foreground">Se încarcă aging report...</Card>}
    </div>
  );
}
