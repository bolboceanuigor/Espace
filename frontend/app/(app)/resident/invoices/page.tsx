'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, ReceiptText, Search, WalletCards } from 'lucide-react';
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
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PaymentDisplayStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

type ResidentInvoice = {
  id: string;
  invoiceNumber: string;
  billingMonth: string;
  billingPeriod?: { year: number; month: number } | null;
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase?: { name?: string | null } | string | null;
    entrance?: { name?: string | null } | string | null;
  };
  status: string;
  paymentDisplayStatus: PaymentDisplayStatus;
  currency: 'MDL';
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  balanceAmount: number;
  dueDate?: string | null;
  publishedAt?: string | null;
  viewedAt?: string | null;
  canPayPlaceholder: boolean;
  canPrint: boolean;
};

type ApartmentOption = {
  id: string;
  apartmentNumber: string;
  staircase?: string | null;
  floor?: string | null;
};

type InvoicesOverview = {
  totalPublishedInvoices: number;
  unpaidInvoices: number;
  paidInvoices: number;
  partiallyPaidInvoices: number;
  overdueInvoices: number;
  totalUnpaidAmount: number;
  totalOverdueAmount: number;
  nextDueInvoice?: ResidentInvoice | null;
  lastPublishedInvoice?: ResidentInvoice | null;
  apartmentsCount: number;
  currency: 'MDL';
};

type ResidentInvoicesResponse = {
  items: ResidentInvoice[];
  meta: { page: number; limit: number; total: number };
  stats: {
    totalInvoices: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    unpaidInvoices: number;
    paidInvoices: number;
    overdueInvoices: number;
  };
  association?: { shortName: string; associationCode?: string | null };
  apartments?: ApartmentOption[];
  emptyStateCode?: 'NO_APARTMENT' | 'NO_INVOICES' | null;
  emptyStateMessage?: string | null;
};

const statusLabels: Record<PaymentDisplayStatus, string> = {
  UNPAID: 'Neachitată',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  OVERDUE: 'Restantă',
  CANCELLED: 'Anulată',
};

const statusVariant: Record<PaymentDisplayStatus, 'default' | 'warning' | 'success' | 'neutral' | 'error'> = {
  UNPAID: 'default',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'error',
  CANCELLED: 'neutral',
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, index) => currentYear - index);
const months = [
  ['1', 'Ianuarie'],
  ['2', 'Februarie'],
  ['3', 'Martie'],
  ['4', 'Aprilie'],
  ['5', 'Mai'],
  ['6', 'Iunie'],
  ['7', 'Iulie'],
  ['8', 'August'],
  ['9', 'Septembrie'],
  ['10', 'Octombrie'],
  ['11', 'Noiembrie'],
  ['12', 'Decembrie'],
];

export default function ResidentInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<ResidentInvoicesResponse | null>(null);
  const [overview, setOverview] = useState<InvoicesOverview | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', year: '', month: '', apartmentId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, listRes] = await Promise.all([
        invoicesApi.getResidentInvoicesOverview(),
        invoicesApi.getResidentInvoices({
          apartmentId: filters.apartmentId || undefined,
          status: filters.status || undefined,
          year: filters.year ? Number(filters.year) : undefined,
          month: filters.month ? Number(filters.month) : undefined,
          search: filters.search || undefined,
          page: 1,
          limit: 50,
        }),
      ]);
      setOverview(overviewRes.data || null);
      setData(listRes.data || null);
    } catch (err: any) {
      setData(null);
      setOverview(null);
      setError(String(err?.message || 'Nu am putut încărca facturile.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const apartmentId = params.get('apartmentId') || '';
    if (apartmentId) setFilters((current) => ({ ...current, apartmentId }));
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const rows = data?.items || [];
  const apartments = useMemo(() => data?.apartments || [], [data?.apartments]);
  const emptyTitle = data?.emptyStateCode === 'NO_APARTMENT' ? 'Nu ai un apartament asociat contului' : 'Nu există facturi publicate încă.';
  const emptyText =
    data?.emptyStateCode === 'NO_APARTMENT'
      ? 'Contactează administratorul asociației pentru a lega contul tău de apartament.'
      : 'Când administrația publică o factură, aceasta va apărea aici.';

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      <PageHeader
        title="Facturi"
        description="Vezi facturile publicate pentru apartamentul tău."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association ? <Badge variant="neutral">{data.association.shortName} · {data.association.associationCode || 'cod necompletat'}</Badge> : null}
            <Badge variant="neutral">{overview?.apartmentsCount || apartments.length || 0} apartamente</Badge>
            <Badge variant="neutral">MDL</Badge>
            <ButtonLink href="/resident/balance" variant="secondary">Vezi soldul</ButtonLink>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total neachitat" value={formatMdl(overview?.totalUnpaidAmount || 0)} description="Facturi publicate cu sold" icon={<WalletCards className="h-5 w-5" />} tone={(overview?.totalUnpaidAmount || 0) > 0 ? 'warning' : 'success'} />
        <StatCard label="Facturi neachitate" value={overview?.unpaidInvoices || 0} description="Necesită urmărire" icon={<ReceiptText className="h-5 w-5" />} tone={(overview?.unpaidInvoices || 0) > 0 ? 'warning' : 'success'} />
        <StatCard label="Restante" value={overview?.overdueInvoices || 0} description={formatMdl(overview?.totalOverdueAmount || 0)} icon={<AlertTriangle className="h-5 w-5" />} tone={(overview?.overdueInvoices || 0) > 0 ? 'danger' : 'success'} />
        <StatCard label="Următoarea scadență" value={formatDate(overview?.nextDueInvoice?.dueDate)} description={overview?.nextDueInvoice?.invoiceNumber || 'Nicio scadență'} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Achitate" value={overview?.paidInvoices || 0} description="Facturi fără sold" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>

      {(overview?.totalUnpaidAmount || 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-950">Total neachitat: {formatMdl(overview?.totalUnpaidAmount || 0)}</p>
              <p className="mt-1 text-sm text-amber-900">Plata online va fi disponibilă ulterior. Momentan poți consulta facturile publicate.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setFilters((current) => ({ ...current, status: 'UNPAID' }))}>
              Vezi neachitate
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.9fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută după număr factură" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </label>
          <Select label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
            <option value="">Toate</option>
            <option value="UNPAID">Neachitate</option>
            <option value="OVERDUE">Restante</option>
            <option value="PARTIALLY_PAID">Parțial achitate</option>
            <option value="PAID">Achitate</option>
            <option value="CANCELLED">Anulate</option>
          </Select>
          <Select label="An" value={filters.year} onChange={(value) => setFilters((current) => ({ ...current, year: value }))}>
            <option value="">Toți anii</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
          <Select label="Lună" value={filters.month} onChange={(value) => setFilters((current) => ({ ...current, month: value }))}>
            <option value="">Toate lunile</option>
            {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select label="Apartament" value={filters.apartmentId} onChange={(value) => setFilters((current) => ({ ...current, apartmentId: value }))}>
            <option value="">Toate apartamentele</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                Apt. {apartment.apartmentNumber}{apartment.staircase ? ` · sc. ${apartment.staircase}` : ''}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" onClick={() => setFilters({ search: '', status: '', year: '', month: '', apartmentId: '' })} className="self-end">
            Resetează
          </Button>
        </div>
      </Card>

      <div className="hidden lg:block">
        <TableWrapper>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Factură</TableHeaderCell>
                <TableHeaderCell>Perioadă</TableHeaderCell>
                <TableHeaderCell>Apartament</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Sold</TableHeaderCell>
                <TableHeaderCell>Scadență</TableHeaderCell>
                <TableHeaderCell>Publicată</TableHeaderCell>
                <TableHeaderCell>Acțiuni</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="font-semibold text-foreground">{invoice.invoiceNumber}</div>
                    <div className="text-xs text-muted-foreground">{invoice.viewedAt ? `Vizualizată ${formatDate(invoice.viewedAt)}` : 'Nevizualizată'}</div>
                  </TableCell>
                  <TableCell>{monthLabel(invoice.billingMonth)}</TableCell>
                  <TableCell>{apartmentLabel(invoice)}</TableCell>
                  <TableCell><Badge variant={statusVariant[invoice.paymentDisplayStatus]}>{statusLabels[invoice.paymentDisplayStatus]}</Badge></TableCell>
                  <TableCell className="font-semibold">{formatMdl(invoice.totalAmount)}</TableCell>
                  <TableCell className={invoice.remainingAmount > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>{formatMdl(invoice.remainingAmount)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>{formatDate(invoice.publishedAt)}</TableCell>
                  <TableCell>
                    <Link href={localizedPath(`/resident/invoices/${invoice.id}`)} className="inline-flex h-9 items-center justify-center rounded-2xl bg-foreground px-3 text-xs font-semibold text-background">
                      Vezi detalii
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !rows.length ? <TableEmpty colSpan={9}>{emptyTitle} {emptyText}</TableEmpty> : null}
            </TableBody>
          </Table>
          {loading ? <div className="p-4 text-sm font-medium text-muted-foreground">Se încarcă facturile...</div> : null}
        </TableWrapper>
      </div>

      <section className="grid gap-3 lg:hidden">
        {loading ? <Card className="h-28 animate-pulse bg-muted/40" /> : null}
        {!loading && !rows.length ? (
          <Card className="p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">{emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{emptyText}</p>
          </Card>
        ) : null}
        {rows.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">{monthLabel(invoice.billingMonth)} · {apartmentLabel(invoice)}</p>
              </div>
              <Badge variant={statusVariant[invoice.paymentDisplayStatus]}>{statusLabels[invoice.paymentDisplayStatus]}</Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Info label="Total" value={formatMdl(invoice.totalAmount)} strong />
              <Info label="Sold" value={formatMdl(invoice.remainingAmount)} strong={invoice.remainingAmount > 0} />
              <Info label="Scadență" value={formatDate(invoice.dueDate)} />
              <Info label="Publicată" value={formatDate(invoice.publishedAt)} />
            </div>
            <Link
              href={localizedPath(`/resident/invoices/${invoice.id}`)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Vezi detalii
            </Link>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
        {children}
      </select>
    </label>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 ${strong ? 'text-lg font-semibold' : 'font-semibold'} text-foreground`}>{value}</p>
    </div>
  );
}

function apartmentLabel(invoice: ResidentInvoice) {
  const staircase = typeof invoice.apartment.staircase === 'string' ? invoice.apartment.staircase : invoice.apartment.staircase?.name;
  const entrance = typeof invoice.apartment.entrance === 'string' ? invoice.apartment.entrance : invoice.apartment.entrance?.name;
  return `Apt. ${invoice.apartment.apartmentNumber}${staircase || entrance ? ` · sc. ${staircase || entrance}` : ''}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function monthLabel(value?: string | null) {
  if (!value) return '-';
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}
