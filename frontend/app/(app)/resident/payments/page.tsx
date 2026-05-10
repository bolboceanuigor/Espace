'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, CheckCircle2, Clock3, CreditCard, FileText, ReceiptText, Search, WalletCards } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PaymentStatus = 'CONFIRMED' | 'CANCELLED';
type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_TERMINAL' | 'INFOCOM' | 'OPLATA' | 'OTHER';

type ApartmentOption = {
  id: string;
  apartmentNumber: string;
  staircase?: string | null;
  floor?: string | null;
  isPrimary?: boolean;
};

type ResidentPayment = {
  id: string;
  amount: number;
  currency: 'MDL';
  paymentDate?: string | null;
  method: PaymentMethod;
  referenceNumber?: string;
  payerName?: string;
  status: PaymentStatus;
  invoice: {
    id: string;
    invoiceNumber: string;
    billingMonth: string;
    status: InvoiceStatus;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    dueDate?: string | null;
  };
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    floor?: string | null;
  };
  association?: {
    id?: string | null;
    shortName: string;
    associationCode?: string | null;
  };
  createdAt: string;
};

type PaymentsResponse = {
  items: ResidentPayment[];
  meta: { page: number; limit: number; total: number };
  stats: {
    totalPayments: number;
    confirmedPayments: number;
    cancelledPayments: number;
    totalPaidAmount: number;
    currentMonthPaidAmount: number;
    remainingBalance: number;
    paidInvoices: number;
    partiallyPaidInvoices: number;
    lastPaymentDate?: string | null;
  };
  association?: { shortName: string; associationCode?: string | null };
  apartments?: ApartmentOption[];
  emptyStateCode?: 'NO_APARTMENT' | 'NO_PAYMENTS' | null;
  emptyStateMessage?: string | null;
};

const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

const statusLabels: Record<PaymentStatus, string> = {
  CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată',
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const emptyStats = {
  totalPayments: 0,
  confirmedPayments: 0,
  cancelledPayments: 0,
  totalPaidAmount: 0,
  currentMonthPaidAmount: 0,
  remainingBalance: 0,
  paidInvoices: 0,
  partiallyPaidInvoices: 0,
  lastPaymentDate: null,
};

export default function ResidentPaymentsPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [apartmentId, setApartmentId] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [confirmedOnly, setConfirmedOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await residentDemoApi.payments({
        apartmentId: apartmentId || undefined,
        billingMonth: billingMonth || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        method: method || undefined,
        status: status || undefined,
        confirmedOnly: confirmedOnly || undefined,
        search: query || undefined,
        sortBy,
        page: 1,
        limit: 50,
      });
      setData(res.data || null);
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca istoricul plăților.'));
    } finally {
      setLoading(false);
    }
  }, [apartmentId, billingMonth, confirmedOnly, dateFrom, dateTo, method, query, sortBy, status]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const rows = data?.items || [];
  const stats = data?.stats || emptyStats;
  const apartments = useMemo(() => data?.apartments || [], [data?.apartments]);
  const apartmentLabel = useMemo(() => {
    if (!apartments.length) return 'fără apartament';
    if (apartments.length === 1) return `Apt. ${apartments[0].apartmentNumber}`;
    return `${apartments.length} apartamente`;
  }, [apartments]);
  const emptyTitle = data?.emptyStateCode === 'NO_APARTMENT' ? 'Nu ai un apartament asociat contului' : 'Nu ai plăți înregistrate';
  const emptyText =
    data?.emptyStateCode === 'NO_APARTMENT'
      ? 'Contactează administratorul asociației pentru a lega contul tău de apartament.'
      : 'Plățile vor apărea aici după ce administratorul le înregistrează în sistem.';
  const canReset = Boolean(apartmentId || billingMonth || dateFrom || dateTo || method || status || query || !confirmedOnly || sortBy !== 'newest');

  function resetFilters() {
    setApartmentId('');
    setBillingMonth('');
    setDateFrom('');
    setDateTo('');
    setMethod('');
    setStatus('');
    setConfirmedOnly(true);
    setQuery('');
    setSortBy('newest');
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Istoricul plăților"
        description="Vezi plățile înregistrate pentru facturile apartamentului tău."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association ? <Badge variant="neutral">{data.association.shortName} · {data.association.associationCode || 'cod necompletat'}</Badge> : null}
            <Badge variant="neutral">{apartmentLabel}</Badge>
            <Badge variant="neutral">MDL</Badge>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Total plăți" value={stats.totalPayments} description="Înregistrări vizibile" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(stats.totalPaidAmount)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Luna curentă" value={formatMdl(stats.currentMonthPaidAmount)} description="Achitat în această lună" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Ultima plată" value={formatDate(stats.lastPaymentDate)} description="Cea mai recentă confirmare" icon={<Banknote className="h-5 w-5" />} />
        <StatCard label="Sold rămas" value={formatMdl(stats.remainingBalance)} description="Pe facturi interne" icon={<WalletCards className="h-5 w-5" />} tone={stats.remainingBalance > 0 ? 'warning' : 'success'} />
        <StatCard label="Facturi achitate" value={stats.paidInvoices} description="Sold zero" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Parțial achitate" value={stats.partiallyPaidInvoices} description="Cu sold rămas" icon={<Clock3 className="h-5 w-5" />} tone={stats.partiallyPaidInvoices ? 'warning' : 'neutral'} />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.9fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută factură, referință, plătitor sau apartament" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select label="Apartament" value={apartmentId} onChange={setApartmentId} options={[
            ['', 'Toate apartamentele'],
            ...apartments.map((apartment) => [
              apartment.id,
              `Apt. ${apartment.apartmentNumber}${apartment.staircase ? ` · sc. ${apartment.staircase}` : ''}`,
            ] as [string, string]),
          ]} />
          <Input label="Luna facturii" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <Select label="Metodă" value={method} onChange={setMethod} options={[['', 'Toate metodele'], ...Object.entries(methodLabels)]} />
          <Select label="Status" value={status} onChange={setStatus} options={[['', 'Toate'], ['CONFIRMED', 'Confirmate'], ['CANCELLED', 'Anulate']]} />
          <Button type="button" variant="secondary" disabled={!canReset} onClick={resetFilters} className="self-end">Resetează</Button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[0.8fr_0.8fr_0.9fr_auto]">
          <Input label="De la data" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input label="Până la data" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Select label="Sortare" value={sortBy} onChange={setSortBy} options={[
            ['newest', 'Cele mai noi'],
            ['oldest', 'Cele mai vechi'],
            ['amount_desc', 'Sumă descrescător'],
            ['amount_asc', 'Sumă crescător'],
            ['method', 'Metodă plată'],
          ]} />
          <Button type="button" variant={confirmedOnly ? 'primary' : 'secondary'} onClick={() => setConfirmedOnly((value) => !value)} className="self-end">
            Doar confirmate
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-28 animate-pulse bg-muted/40" />)}
        </div>
      ) : null}

      {!loading && !rows.length ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <CreditCard className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{emptyText}</p>
          <ButtonLink href="/resident/invoices" className="mt-5">Vezi facturile mele</ButtonLink>
        </Card>
      ) : null}

      <section className="grid gap-3">
        {rows.map((payment) => (
          <Card key={payment.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{payment.invoice.invoiceNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {monthLabel(payment.invoice.billingMonth)} · Apt. {payment.apartment.apartmentNumber}
                  {payment.apartment.staircase ? ` · sc. ${payment.apartment.staircase}` : ''}
                </p>
              </div>
              <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{statusLabels[payment.status]}</Badge>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Info label="Data plății" value={formatDate(payment.paymentDate)} />
              <Info label="Sumă" value={formatMdl(payment.amount)} strong />
              <Info label="Metodă" value={methodLabels[payment.method] || payment.method} />
              <Info label="Referință" value={payment.referenceNumber || '-'} />
              <Info label="Sold factură" value={formatMdl(payment.invoice.balanceAmount)} strong={payment.invoice.balanceAmount > 0} />
              <Info label="Status factură" value={invoiceStatusLabels[payment.invoice.status]} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={localizedPath(`/resident/payments/${payment.id}`)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 sm:w-auto"
              >
                Deschide
              </Link>
              <ButtonLink href={`/resident/invoices/${payment.invoice.id}`} variant="secondary">Vezi factura</ButtonLink>
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Notă</h2>
        <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
          Această pagină afișează doar plățile introduse de administratorul A.P.C. Nu poți crea, anula sau modifica plăți din portalul locatarului.
        </p>
      </Card>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue || 'empty'} value={optionValue}>{optionLabel}</option>)}
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

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}
