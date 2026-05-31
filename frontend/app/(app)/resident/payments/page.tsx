'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banknote, CheckCircle2, Clock3, CreditCard, FileText, ReceiptText, RefreshCw, Search, WalletCards } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { residentBalanceApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type Payment = {
  id: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoice?: any | null;
  apartment?: { id?: string; apartmentNumber?: string; number?: string; staircase?: { name?: string } | null; entrance?: { name?: string } | null } | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  source: string;
  paidAt?: string | null;
  acceptedAt?: string | null;
  externalReference?: string | null;
  linkedProof?: { id: string } | null;
  note?: string | null;
  createdAt?: string | null;
};

type ApartmentBalance = {
  apartmentId: string;
  apartmentNumber: string;
  buildingName?: string | null;
  entranceName?: string | null;
};

type BalanceOverview = {
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  totalOverdueAmount: number;
  paidInvoicesCount: number;
  pendingPaymentProofsCount: number;
  lastPayment?: Payment | null;
};

const statusLabels: Record<string, string> = {
  PENDING: 'În verificare',
  CONFIRMED: 'Confirmată',
  ACCEPTED: 'Acceptată',
  PARTIALLY_ACCEPTED: 'Acceptată parțial',
  REJECTED: 'Respinsă',
  FAILED: 'Eșuată',
  CANCELLED: 'Anulată',
  REVERSED: 'Inversată',
};

const methodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK: 'Bancă',
  BANK_TRANSFER: 'Transfer bancar',
  MANUAL_BANK_TRANSFER: 'Transfer verificat manual',
  TERMINAL: 'Terminal',
  CARD_EXTERNAL: 'Card extern',
  BANK_STATEMENT: 'Extras bancar',
  ADJUSTMENT: 'Ajustare',
  OTHER: 'Altă metodă',
};

const sourceLabels: Record<string, string> = {
  PAYMENT_PROOF: 'Dovadă plată',
  MANUAL_ENTRY: 'Înregistrare manuală',
  IMPORT: 'Import',
  ADJUSTMENT: 'Ajustare',
  SYSTEM: 'Sistem',
};

const acceptedStatuses = ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONFIRMED'];

export default function ResidentPaymentsPage() {
  const localizedPath = useLocalizedPath();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Payment[]>([]);
  const [overview, setOverview] = useState<BalanceOverview>({ totalPaidAmount: 0, totalUnpaidAmount: 0, totalOverdueAmount: 0, paidInvoicesCount: 0, pendingPaymentProofsCount: 0 });
  const [apartments, setApartments] = useState<ApartmentBalance[]>([]);
  const [apartmentId, setApartmentId] = useState(searchParams.get('apartmentId') || '');
  const [invoiceId] = useState(searchParams.get('invoiceId') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [paymentsRes, overviewRes, apartmentsRes] = await Promise.all([
        residentBalanceApi.getResidentPayments({
          apartmentId: apartmentId || undefined,
          invoiceId: invoiceId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          method: method || undefined,
          status: status || undefined,
          search: query || undefined,
          page: 1,
          limit: 50,
        }),
        residentBalanceApi.getResidentBalanceOverview(),
        residentBalanceApi.getResidentApartmentBalances(),
      ]);
      setItems(paymentsRes.data?.items || []);
      setOverview(overviewRes.data || { totalPaidAmount: 0, totalUnpaidAmount: 0, totalOverdueAmount: 0, paidInvoicesCount: 0, pendingPaymentProofsCount: 0 });
      setApartments(apartmentsRes.data?.items || []);
    } catch (err: any) {
      setItems([]);
      setError(String(err?.message || 'Nu am putut încărca istoricul plăților.'));
    } finally {
      setLoading(false);
    }
  }, [apartmentId, dateFrom, dateTo, invoiceId, method, query, status]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const acceptedTotalInList = useMemo(
    () => items.filter((payment) => acceptedStatuses.includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [items],
  );
  const canReset = Boolean(apartmentId || dateFrom || dateTo || method || status || query);

  function resetFilters() {
    setApartmentId('');
    setDateFrom('');
    setDateTo('');
    setMethod('');
    setStatus('');
    setQuery('');
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Istoric plăți"
        description="Vezi plățile acceptate și dovezile trimise."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={loadPayments} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizează
            </Button>
            <ButtonLink href={localizedPath('/resident/balance')} variant="secondary">Vezi soldul</ButtonLink>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Achitat total" value={formatMdl(overview.totalPaidAmount)} description="Plăți acceptate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="În listă" value={formatMdl(acceptedTotalInList)} description="După filtrele curente" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Total de achitat" value={formatMdl(overview.totalUnpaidAmount)} description="Facturi publicate neînchise" icon={<WalletCards className="h-5 w-5" />} tone={overview.totalUnpaidAmount > 0 ? 'warning' : 'success'} />
        <StatCard label="Restanțe" value={formatMdl(overview.totalOverdueAmount)} description="Sume peste scadență" icon={<Clock3 className="h-5 w-5" />} tone={overview.totalOverdueAmount > 0 ? 'warning' : 'success'} />
        <StatCard label="Dovezi în verificare" value={overview.pendingPaymentProofsCount} description="Trimise spre validare" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Ultima plată" value={overview.lastPayment ? formatDate(overview.lastPayment.acceptedAt || overview.lastPayment.paidAt) : '-'} description={overview.lastPayment ? formatMdl(overview.lastPayment.amount) : 'Fără plăți'} icon={<Banknote className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.8fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută factură, referință sau apartament" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select label="Apartament" value={apartmentId} onChange={setApartmentId} options={[
            ['', 'Toate apartamentele'],
            ...apartments.map((apartment) => [
              apartment.apartmentId,
              `Apt. ${apartment.apartmentNumber}${apartment.entranceName ? ` · ${apartment.entranceName}` : ''}`,
            ] as [string, string]),
          ]} />
          <Select label="Metodă" value={method} onChange={setMethod} options={[['', 'Toate metodele'], ...Object.entries(methodLabels)]} />
          <Select label="Status" value={status} onChange={setStatus} options={[['', 'Toate statusurile'], ...Object.entries(statusLabels)]} />
          <Input label="De la" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Button type="button" variant="secondary" disabled={!canReset} onClick={resetFilters} className="self-end">Resetează</Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-sm">
          <Input label="Până la" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-28 animate-pulse bg-muted/40" />)}
        </div>
      ) : null}

      {!loading && !items.length ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <CreditCard className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Nu există plăți acceptate încă.</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Plățile vor apărea aici după ce administrația le acceptă sau le înregistrează manual.</p>
          <ButtonLink href="/resident/invoices" className="mt-5">Vezi facturile mele</ButtonLink>
        </Card>
      ) : null}

      <section className="grid gap-3">
        {items.map((payment) => {
          const apartmentNumber = payment.apartment?.apartmentNumber || payment.apartment?.number || '-';
          const statusVariant = acceptedStatuses.includes(payment.status) ? 'success' : payment.status === 'PENDING' ? 'warning' : 'neutral';
          return (
            <Card key={payment.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{payment.invoiceNumber || payment.invoice?.invoiceNumber || 'Plată fără factură asociată'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Apt. {apartmentNumber} · {sourceLabels[payment.source] || payment.source}
                  </p>
                </div>
                <Badge variant={statusVariant}>{statusLabels[payment.status] || payment.status}</Badge>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <Info label="Data plății" value={formatDate(payment.paidAt || payment.acceptedAt)} />
                <Info label="Sumă" value={formatMdl(payment.amount)} strong />
                <Info label="Metodă" value={methodLabels[payment.method] || payment.method} />
                <Info label="Referință" value={payment.externalReference || '-'} />
                <Info label="Factura" value={payment.invoiceNumber || '-'} />
                <Info label="Dovadă" value={payment.linkedProof?.id ? 'Atașată' : '-'} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={localizedPath(`/resident/payments/${payment.id}`)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 sm:w-auto"
                >
                  Deschide
                </Link>
                {payment.invoiceId ? <ButtonLink href={`/resident/invoices/${payment.invoiceId}`} variant="secondary">Vezi factura</ButtonLink> : null}
              </div>
            </Card>
          );
        })}
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Notă</h2>
        <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
          Această pagină afișează istoricul financiar disponibil pentru contul tău. Plățile online reale nu sunt procesate aici.
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
