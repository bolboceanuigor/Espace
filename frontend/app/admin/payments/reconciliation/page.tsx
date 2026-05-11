'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Home,
  Percent,
  RefreshCw,
  Search,
  WalletCards,
} from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { exportsApi, paymentsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { downloadBlob } from '@/lib/download';

type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_TERMINAL' | 'INFOCOM' | 'OPLATA' | 'OTHER';
type PaymentStatus = 'CONFIRMED' | 'CANCELLED';

type ReconciliationItem = {
  invoiceId: string;
  metadataId?: string;
  invoiceNumber: string;
  billingMonth: string;
  apartment: { id: string; apartmentNumber: string; staircase?: string | null; floor?: string | null };
  primaryContact?: { id: string; fullName: string; phone?: string | null } | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  dueDate?: string | null;
  isOverdue: boolean;
  overdueDays: number;
  lastPaymentDate?: string | null;
};

type ReconciliationSummary = {
  billingMonth?: string | null;
  currency: 'MDL';
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paidInvoices: number;
  partiallyPaidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  collectionRate: number;
};

type StatusBreakdown = {
  status: InvoiceStatus;
  count: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
};

type DebtorRow = {
  apartmentId: string;
  apartmentNumber: string;
  staircase?: string | null;
  primaryContact?: { id: string; fullName: string; phone?: string | null } | null;
  balanceAmount: number;
  unpaidInvoicesCount: number;
  oldestUnpaidBillingMonth: string;
  lastPaymentDate?: string | null;
};

type RecentPayment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  billingMonth: string;
  apartment?: { id: string; apartmentNumber: string; staircase?: string | null } | null;
  resident?: { id: string; fullName: string; phone?: string | null } | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentDate?: string | null;
  createdBy?: { id: string; fullName?: string | null; email?: string | null } | null;
};

type ApartmentDetails = {
  apartment: { id: string; apartmentNumber: string; staircase?: string | null; floor?: string | null };
  primaryContact?: { id: string; fullName: string; phone?: string | null } | null;
  summary: ReconciliationSummary;
  invoices: ReconciliationItem[];
  payments: RecentPayment[];
};

const statusLabels: Record<InvoiceStatus, string> = {
  ISSUED: 'Neachitată',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const statusVariants = {
  ISSUED: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
  VOID: 'neutral',
} as const;

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

const emptySummary: ReconciliationSummary = {
  billingMonth: null,
  currency: 'MDL',
  totalInvoices: 0,
  totalAmount: 0,
  paidAmount: 0,
  balanceAmount: 0,
  paidInvoices: 0,
  partiallyPaidInvoices: 0,
  unpaidInvoices: 0,
  overdueInvoices: 0,
  collectionRate: 0,
};

export default function AdminPaymentsReconciliationPage() {
  const [data, setData] = useState<any>(null);
  const [debtors, setDebtors] = useState<DebtorRow[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [billingMonth, setBillingMonth] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [staircase, setStaircase] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [maxBalance, setMaxBalance] = useState('');
  const [sortBy, setSortBy] = useState('balanceAmount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [partiallyPaidOnly, setPartiallyPaidOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<ApartmentDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const params = useMemo(
    () => ({
      billingMonth: billingMonth || undefined,
      status: status || undefined,
      search: query || undefined,
      staircase: staircase || undefined,
      apartmentNumber: apartmentNumber || undefined,
      minBalance: minBalance || undefined,
      maxBalance: maxBalance || undefined,
      unpaidOnly: unpaidOnly || undefined,
      partiallyPaidOnly: partiallyPaidOnly || undefined,
      overdueOnly: overdueOnly || undefined,
      sortBy,
      sortDirection,
      page: 1,
      limit: 80,
    }),
    [apartmentNumber, billingMonth, maxBalance, minBalance, overdueOnly, partiallyPaidOnly, query, sortBy, sortDirection, staircase, status, unpaidOnly],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mainRes, debtorsRes, recentRes] = await Promise.all([
        paymentsApi.adminReconciliation(params),
        paymentsApi.adminReconciliationDebtors({ billingMonth: billingMonth || undefined, limit: 10 }),
        paymentsApi.adminReconciliationRecentPayments({ limit: 10 }),
      ]);
      setData(mainRes.data || null);
      setDebtors(debtorsRes.data?.items || []);
      setRecentPayments(recentRes.data?.items || []);
    } catch (err: any) {
      setData(null);
      setDebtors([]);
      setRecentPayments([]);
      setError(String(err?.message || 'Nu am putut încărca reconcilierea plăților.'));
    } finally {
      setLoading(false);
    }
  }, [billingMonth, params]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const summary: ReconciliationSummary = data?.summary || emptySummary;
  const rows: ReconciliationItem[] = data?.items || [];
  const statusBreakdown: StatusBreakdown[] = data?.statusBreakdown || [];
  const association = data?.association || null;
  const canReset = Boolean(billingMonth || status || query || staircase || apartmentNumber || minBalance || maxBalance || unpaidOnly || partiallyPaidOnly || overdueOnly);

  async function openApartmentDetails(apartmentId: string) {
    setDetailsLoading(true);
    setError('');
    try {
      const res = await paymentsApi.adminReconciliationApartment(apartmentId, { billingMonth: billingMonth || undefined });
      setDetails(res.data || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca detaliile apartamentului.'));
    } finally {
      setDetailsLoading(false);
    }
  }

  function resetFilters() {
    setBillingMonth('');
    setStatus('');
    setQuery('');
    setStaircase('');
    setApartmentNumber('');
    setMinBalance('');
    setMaxBalance('');
    setUnpaidOnly(false);
    setPartiallyPaidOnly(false);
    setOverdueOnly(false);
    setSortBy('balanceAmount');
    setSortDirection('desc');
  }

  async function exportCsv() {
    setError('');
    try {
      const res = await exportsApi.adminApartmentBalancesCsv({
        billingMonth: billingMonth || undefined,
        staircase: staircase || undefined,
        apartmentNumber: apartmentNumber || undefined,
        minBalance: minBalance || undefined,
        maxBalance: maxBalance || undefined,
        unpaidOnly: unpaidOnly || undefined,
        overdueOnly: overdueOnly || undefined,
      });
      downloadBlob(res.data, `solduri-apartamente-${billingMonth || 'toate'}.csv`);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera exportul CSV.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Reconciliere plăți"
        description="Compară facturile emise cu plățile înregistrate și urmărește soldurile restante."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {association ? <Badge variant="neutral">{association.shortName} · {association.associationCode}</Badge> : null}
            <Badge variant="neutral">MDL</Badge>
            <Button type="button" variant="secondary" onClick={loadAll}>
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </Button>
            <ButtonLink href={`/admin/reports/financial${billingMonth ? `?billingMonth=${billingMonth}` : ''}`} variant="secondary">
              Vezi raport financiar
            </ButtonLink>
            <Button type="button" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr_0.9fr_0.7fr_0.7fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută factură, apartament, contact sau telefon" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Input label="Luna" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <Select label="Status factură" value={status} onChange={setStatus} options={[
            ['', 'Toate statusurile'],
            ['ISSUED', 'Neachitate'],
            ['PARTIALLY_PAID', 'Parțial achitate'],
            ['PAID', 'Achitate'],
            ['CANCELLED', 'Anulate'],
            ['VOID', 'Void'],
          ]} />
          <Field label="Scara" value={staircase} onChange={setStaircase} />
          <Field label="Apartament" value={apartmentNumber} onChange={setApartmentNumber} />
          <Button type="button" variant="secondary" disabled={!canReset} onClick={resetFilters} className="self-end">
            Resetează
          </Button>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[0.75fr_0.75fr_0.9fr_0.9fr_auto_auto_auto]">
          <Field label="Sold minim" value={minBalance} onChange={setMinBalance} type="number" />
          <Field label="Sold maxim" value={maxBalance} onChange={setMaxBalance} type="number" />
          <Select label="Sortare" value={sortBy} onChange={setSortBy} options={[
            ['balanceAmount', 'Sold'],
            ['apartmentNumber', 'Apartament'],
            ['dueDate', 'Scadență'],
            ['lastPaymentDate', 'Ultima plată'],
            ['totalAmount', 'Total factură'],
          ]} />
          <Select label="Direcție" value={sortDirection} onChange={(value) => setSortDirection(value === 'asc' ? 'asc' : 'desc')} options={[
            ['desc', 'Descrescător'],
            ['asc', 'Crescător'],
          ]} />
          <Toggle active={unpaidOnly} onClick={() => setUnpaidOnly((current) => !current)}>Doar neachitate</Toggle>
          <Toggle active={partiallyPaidOnly} onClick={() => setPartiallyPaidOnly((current) => !current)}>Doar parțiale</Toggle>
          <Toggle active={overdueOnly} onClick={() => setOverdueOnly((current) => !current)}>Doar întârziate</Toggle>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total facturi emise" value={String(summary.totalInvoices)} description="În selecția curentă" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Total emis" value={formatMdl(summary.totalAmount)} description="Facturi colectabile" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(summary.paidAmount)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Sold restant" value={formatMdl(summary.balanceAmount)} description="De urmărit" icon={<AlertTriangle className="h-5 w-5" />} tone={summary.balanceAmount > 0 ? 'warning' : 'success'} />
        <StatCard label="Rata de colectare" value={`${summary.collectionRate}%`} description="Achitat din total emis" icon={<Percent className="h-5 w-5" />} />
        <StatCard label="Achitate integral" value={String(summary.paidInvoices)} description="Sold zero" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Parțial achitate" value={String(summary.partiallyPaidInvoices)} description="Necesită urmărire" icon={<Banknote className="h-5 w-5" />} tone="warning" />
        <StatCard label="Neachitate" value={String(summary.unpaidInvoices)} description="Fără plată completă" icon={<FileText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Întârziate" value={String(summary.overdueInvoices)} description="Scadență depășită" icon={<Clock3 className="h-5 w-5" />} tone={summary.overdueInvoices > 0 ? 'warning' : 'success'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Situație pe status</h2>
              <p className="text-sm text-muted-foreground">Totaluri grupate după statusul facturii.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {statusBreakdown.map((row) => (
              <div key={row.status} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge>
                  <span className="text-sm font-semibold text-foreground">{row.count}</span>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                  <InfoLine label="Total" value={formatMdl(row.totalAmount)} />
                  <InfoLine label="Achitat" value={formatMdl(row.paidAmount)} />
                  <InfoLine label="Sold" value={formatMdl(row.balanceAmount)} />
                </div>
              </div>
            ))}
            {!statusBreakdown.length && !loading ? <p className="text-sm text-muted-foreground">Nu există statusuri de afișat.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Top restanțe</h2>
              <p className="text-sm text-muted-foreground">Apartamente cu cel mai mare sold restant.</p>
            </div>
          </div>
          <div className="space-y-2">
            {debtors.map((row) => (
              <button
                key={row.apartmentId}
                type="button"
                onClick={() => openApartmentDetails(row.apartmentId)}
                className="grid w-full gap-2 rounded-2xl border border-border/70 bg-white px-4 py-3 text-left transition hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-sm text-foreground">Apt. {row.apartmentNumber}{row.staircase ? ` · sc. ${row.staircase}` : ''}</strong>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.primaryContact?.fullName || 'Fără contact principal'} · {row.primaryContact?.phone || 'fără telefon'}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatMdl(row.balanceAmount)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.unpaidInvoicesCount} facturi cu sold · cea mai veche lună {row.oldestUnpaidBillingMonth || '-'}
                </p>
              </button>
            ))}
            {!debtors.length && !loading ? <p className="text-sm text-muted-foreground">Nu există restanțe pentru selecția curentă.</p> : null}
          </div>
        </Card>
      </section>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] xl:block">
        <div className="grid grid-cols-[0.75fr_0.55fr_1fr_0.8fr_1fr_0.75fr_0.7fr_0.7fr_0.8fr_0.75fr_0.75fr_1fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Apartament</span>
          <span>Scara</span>
          <span>Contact</span>
          <span>Telefon</span>
          <span>Factură</span>
          <span>Luna</span>
          <span>Total</span>
          <span>Achitat</span>
          <span>Sold</span>
          <span>Status</span>
          <span>Întârziere</span>
          <span>Acțiuni</span>
        </div>
        {rows.map((row) => (
          <div key={row.invoiceId} className="grid grid-cols-[0.75fr_0.55fr_1fr_0.8fr_1fr_0.75fr_0.7fr_0.7fr_0.8fr_0.75fr_0.75fr_1fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <strong className="text-foreground">Apt. {row.apartment.apartmentNumber}</strong>
            <span className="text-muted-foreground">{row.apartment.staircase || '-'}</span>
            <span className="text-muted-foreground">{row.primaryContact?.fullName || '-'}</span>
            <span className="text-muted-foreground">{row.primaryContact?.phone || '-'}</span>
            <strong className="text-foreground">{row.invoiceNumber}</strong>
            <span className="text-muted-foreground">{row.billingMonth}</span>
            <span className="font-medium text-foreground">{formatMdl(row.totalAmount)}</span>
            <span className="text-muted-foreground">{formatMdl(row.paidAmount)}</span>
            <span className="font-semibold text-foreground">{formatMdl(row.balanceAmount)}</span>
            <StatusBadge row={row} />
            <span className={row.overdueDays > 0 ? 'font-semibold text-amber-700' : 'text-muted-foreground'}>{row.overdueDays > 0 ? `${row.overdueDays} zile` : '-'}</span>
            <RowActions row={row} onDetails={() => openApartmentDetails(row.apartment.id)} />
          </div>
        ))}
        {loading ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă datele...</div> : null}
        {!loading && !rows.length ? <EmptyState /> : null}
      </section>

      <section className="grid gap-3 xl:hidden">
        {rows.map((row) => (
          <Card key={row.invoiceId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{row.invoiceNumber}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Apt. {row.apartment.apartmentNumber}{row.apartment.staircase ? ` · sc. ${row.apartment.staircase}` : ''} · {row.billingMonth}</p>
              </div>
              <StatusBadge row={row} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <InfoLine label="Contact" value={row.primaryContact?.fullName || '-'} />
              <InfoLine label="Telefon" value={row.primaryContact?.phone || '-'} />
              <InfoLine label="Total" value={formatMdl(row.totalAmount)} strong />
              <InfoLine label="Achitat" value={formatMdl(row.paidAmount)} />
              <InfoLine label="Sold" value={formatMdl(row.balanceAmount)} strong />
              <InfoLine label="Scadență" value={formatDate(row.dueDate)} />
              <InfoLine label="Întârziere" value={row.overdueDays > 0 ? `${row.overdueDays} zile` : '-'} />
            </div>
            <div className="mt-4">
              <RowActions row={row} onDetails={() => openApartmentDetails(row.apartment.id)} />
            </div>
          </Card>
        ))}
        {loading ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {!loading && !rows.length ? <Card className="p-6"><EmptyState compact /></Card> : null}
      </section>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Plăți recente</h2>
            <p className="text-sm text-muted-foreground">Ultimele plăți manuale înregistrate în asociație.</p>
          </div>
          <ButtonLink href="/admin/payments" variant="secondary">Vezi toate plățile</ButtonLink>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {recentPayments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-sm text-foreground">{payment.invoiceNumber}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">Apt. {payment.apartment?.apartmentNumber || '-'} · {formatDate(payment.paymentDate)}</p>
                </div>
                <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{payment.status === 'CANCELLED' ? 'Anulată' : 'Confirmată'}</Badge>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                <InfoLine label="Sumă" value={formatMdl(payment.amount)} strong />
                <InfoLine label="Metodă" value={paymentMethodLabels[payment.method] || payment.method} />
                <InfoLine label="Înregistrat de" value={payment.createdBy?.fullName || payment.createdBy?.email || '-'} />
              </div>
            </div>
          ))}
          {!recentPayments.length && !loading ? <p className="text-sm text-muted-foreground">Nu există plăți înregistrate încă.</p> : null}
        </div>
      </Card>

      <Modal isOpen={Boolean(details) || detailsLoading} onClose={() => setDetails(null)} maxWidth="2xl">
        <ModalHeader title="Detalii reconciliere apartament" onClose={() => setDetails(null)} />
        <ModalBody>
          {detailsLoading && !details ? <p className="text-sm font-medium text-muted-foreground">Se încarcă datele...</p> : null}
          {details ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Apt. {details.apartment.apartmentNumber}{details.apartment.staircase ? ` · sc. ${details.apartment.staircase}` : ''}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{details.primaryContact?.fullName || 'Fără contact principal'} · {details.primaryContact?.phone || 'fără telefon'}</p>
                  </div>
                  <Badge variant={details.summary.balanceAmount > 0 ? 'warning' : 'success'}>{formatMdl(details.summary.balanceAmount)} sold</Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <InfoBox label="Total emis" value={formatMdl(details.summary.totalAmount)} />
                  <InfoBox label="Achitat" value={formatMdl(details.summary.paidAmount)} />
                  <InfoBox label="Sold" value={formatMdl(details.summary.balanceAmount)} />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Facturi</h4>
                <div className="space-y-2">
                  {details.invoices.map((invoice) => (
                    <div key={invoice.invoiceId} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong className="text-sm text-foreground">{invoice.invoiceNumber}</strong>
                          <p className="mt-1 text-xs text-muted-foreground">{invoice.billingMonth} · scadență {formatDate(invoice.dueDate)}</p>
                        </div>
                        <StatusBadge row={invoice} />
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                        <InfoLine label="Total" value={formatMdl(invoice.totalAmount)} />
                        <InfoLine label="Achitat" value={formatMdl(invoice.paidAmount)} />
                        <InfoLine label="Sold" value={formatMdl(invoice.balanceAmount)} strong />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Plăți înregistrate</h4>
                <div className="space-y-2">
                  {details.payments.map((payment) => (
                    <div key={payment.id} className="rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-foreground">{formatMdl(payment.amount)}</strong>
                        <span className="text-muted-foreground">{formatDate(payment.paymentDate)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{payment.invoiceNumber} · {paymentMethodLabels[payment.method] || payment.method}</p>
                    </div>
                  ))}
                  {!details.payments.length ? <p className="text-sm text-muted-foreground">Nu există plăți pentru acest apartament.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          {details ? (
            <>
              <ButtonLink href={`/admin/payments?invoiceId=${details.invoices[0]?.invoiceId || ''}`} variant="secondary">Înregistrează plată</ButtonLink>
              <ButtonLink href={`/admin/apartments/${details.apartment.id}`} variant="secondary">Deschide apartament</ButtonLink>
              {details.primaryContact?.id ? <ButtonLink href={`/admin/residents/${details.primaryContact.id}`} variant="secondary">Deschide locatar</ButtonLink> : null}
            </>
          ) : null}
          <Button type="button" onClick={() => setDetails(null)}>Închide</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function RowActions({ row, onDetails }: { row: ReconciliationItem; onDetails: () => void }) {
  const canRegisterPayment = (row.status === 'ISSUED' || row.status === 'PARTIALLY_PAID') && Number(row.balanceAmount || 0) > 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      <ButtonLink href={`/admin/invoices/${row.invoiceId}`} size="sm" variant="secondary">Factură</ButtonLink>
      {canRegisterPayment ? <ButtonLink href={`/admin/payments?invoiceId=${row.invoiceId}`} size="sm" variant="secondary">Înregistrează plată</ButtonLink> : null}
      <ButtonLink href={`/admin/apartments/${row.apartment.id}`} size="sm" variant="secondary">
        <Home className="h-3.5 w-3.5" />
        Apartament
      </ButtonLink>
      {row.primaryContact?.id ? <ButtonLink href={`/admin/residents/${row.primaryContact.id}`} size="sm" variant="secondary">Locatar</ButtonLink> : null}
      <Button type="button" size="sm" variant="secondary" onClick={onDetails}>Detalii</Button>
    </div>
  );
}

function EmptyState({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? 'text-center' : 'px-4 py-10 text-center'}>
      <h2 className="text-lg font-semibold text-foreground">Nu există date pentru reconciliere</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        După ce generezi facturi și înregistrezi plăți, situația lunară va apărea aici.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/admin/invoices" variant="secondary">Vezi facturi</ButtonLink>
        <ButtonLink href="/admin/payments">Înregistrează plată</ButtonLink>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: ReconciliationItem }) {
  if (row.isOverdue && row.status !== 'PAID') {
    return <Badge variant="warning">Întârziat</Badge>;
  }
  return <Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge>;
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? 'primary' : 'secondary'} onClick={onClick} className="self-end">
      {children}
    </Button>
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

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InfoLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{value}</span>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
