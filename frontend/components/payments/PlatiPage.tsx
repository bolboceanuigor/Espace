'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, CreditCard, ReceiptText, WalletCards } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import Button from '@/components/ui/Button';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

type PaymentStatus = 'ALL' | 'PAID' | 'UNPAID' | 'OVERDUE';

export type BillingInvoice = {
  id: string;
  invoiceNumber?: string | null;
  month?: number | string | null;
  year?: number | string | null;
  description?: string | null;
  amount?: number | string | null;
  total?: number | string | null;
  totalDue?: number | string | null;
  paidAmount?: number | string | null;
  dueDate?: string | null;
  status?: string | null;
  apartment?: {
    number?: string | null;
    building?: { name?: string | null };
    staircase?: { name?: string | null };
  } | null;
  createdAt?: string | null;
};

type PlatiPageProps = {
  loadInvoices: () => Promise<BillingInvoice[]>;
  loadPayments?: () => Promise<any[]>;
  titleDescription: string;
};

const FILTERS: Array<{ key: PaymentStatus; label: string }> = [
  { key: 'ALL', label: 'Toate' },
  { key: 'PAID', label: 'Achitate' },
  { key: 'UNPAID', label: 'Neachitate' },
  { key: 'OVERDUE', label: 'Întârziate' },
];

const FALLBACK_INVOICES: BillingInvoice[] = [
  {
    id: 'fallback-1',
    invoiceNumber: 'INV-2026-04',
    month: 4,
    year: 2026,
    description: 'Întreținere aprilie',
    totalDue: 1250,
    paidAmount: 0,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'UNPAID',
  },
  {
    id: 'fallback-2',
    invoiceNumber: 'INV-2026-03',
    month: 3,
    year: 2026,
    description: 'Întreținere martie',
    totalDue: 0,
    paidAmount: 1180,
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'PAID',
  },
];

function asArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function amountOf(invoice: BillingInvoice) {
  return Number(invoice.totalDue ?? invoice.amount ?? invoice.total ?? 0);
}

function paidOf(invoice: BillingInvoice) {
  return Number(invoice.paidAmount ?? 0);
}

function invoiceStatus(invoice: BillingInvoice): PaymentStatus {
  const raw = String(invoice.status || '').toUpperCase();
  const due = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const remaining = amountOf(invoice);
  if (['PAID', 'ACHITAT', 'CONFIRMED'].includes(raw) || remaining <= 0) return 'PAID';
  if (raw.includes('OVERDUE') || raw.includes('LATE') || (due && due.getTime() < Date.now())) return 'OVERDUE';
  return 'UNPAID';
}

function statusLabel(status: PaymentStatus) {
  if (status === 'PAID') return 'Achitat';
  if (status === 'OVERDUE') return 'Întârziat';
  if (status === 'UNPAID') return 'Neachitat';
  return 'Toate';
}

function statusClass(status: PaymentStatus) {
  if (status === 'PAID') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'OVERDUE') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function invoiceTitle(invoice: BillingInvoice) {
  if (invoice.invoiceNumber) return invoice.invoiceNumber;
  if (invoice.month && invoice.year) return `Factura ${invoice.month}/${invoice.year}`;
  return 'Factura curentă';
}

function invoiceDescription(invoice: BillingInvoice) {
  if (invoice.description) return invoice.description;
  if (invoice.apartment?.number) return `Apartament ${invoice.apartment.number}`;
  return 'Întreținere lunară';
}

export default function PlatiPage({ loadInvoices, loadPayments, titleDescription }: PlatiPageProps) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState<PaymentStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [invoiceRows, paymentRows] = await Promise.all([
          loadInvoices(),
          loadPayments ? loadPayments() : Promise.resolve([]),
        ]);
        if (!active) return;
        setInvoices(invoiceRows.length ? invoiceRows : FALLBACK_INVOICES);
        setPayments(paymentRows);
      } catch {
        if (!active) return;
        setInvoices(FALLBACK_INVOICES);
        setPayments([]);
        setError('Nu am putut încărca datele din API. Afișăm temporar date demonstrative.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loadInvoices, loadPayments]);

  const visibleInvoices = useMemo(
    () => invoices.filter((item) => filter === 'ALL' || invoiceStatus(item) === filter),
    [filter, invoices],
  );

  const summary = useMemo(() => {
    const totalDue = invoices.reduce((sum, item) => sum + Math.max(amountOf(item), 0), 0);
    const overdue = invoices.filter((item) => invoiceStatus(item) === 'OVERDUE').reduce((sum, item) => sum + Math.max(amountOf(item), 0), 0);
    const paidThisMonthFromPayments = payments
      .filter((item) => String(item.status || '').toUpperCase() === 'CONFIRMED')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidThisMonth = paidThisMonthFromPayments || invoices.reduce((sum, item) => sum + Math.max(paidOf(item), 0), 0);
    return { totalDue, overdue, paidThisMonth };
  }, [invoices, payments]);

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:space-y-6 md:pb-8">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" />
              Billing
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Plăți</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{titleDescription}</p>
          </div>
          <Button variant="secondary" onClick={() => setPayModalOpen(true)}>
            <WalletCards className="h-4 w-4" />
            Achită
          </Button>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {loading ? <LoadingState label="Se încarcă plățile..." /> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ReceiptText className="h-4 w-4" /> Total de plată</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatAmount(summary.totalDue)}</p>
        </div>
        <div className="rounded-[1.35rem] border border-rose-100 bg-rose-50/60 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
          <p className="flex items-center gap-2 text-xs text-rose-700"><Clock3 className="h-4 w-4" /> Restanțe</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{formatAmount(summary.overdue)}</p>
        </div>
        <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50/60 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
          <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Achitat luna curentă</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatAmount(summary.paidThisMonth)}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition ${
              filter === item.key ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white/85 text-foreground hover:bg-muted/70'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!loading && !visibleInvoices.length ? <EmptyState title="Nu există plăți încă." /> : null}

      <div className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Factura</th>
              <th className="px-4 py-3 font-medium">Descriere</th>
              <th className="px-4 py-3 font-medium">Suma</th>
              <th className="px-4 py-3 font-medium">Scadență</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {visibleInvoices.map((invoice) => {
              const status = invoiceStatus(invoice);
              return (
                <tr key={invoice.id} className="border-b border-border/50 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-foreground">{invoiceTitle(invoice)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{invoiceDescription(invoice)}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{formatAmount(amountOf(invoice))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(invoice.dueDate)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{statusLabel(status)}</span></td>
                  <td className="px-4 py-3 text-right">
                    {status !== 'PAID' ? <Button size="sm" onClick={() => setPayModalOpen(true)}>Achită</Button> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {visibleInvoices.map((invoice) => {
          const status = invoiceStatus(invoice);
          return (
            <article key={invoice.id} className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{invoiceTitle(invoice)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{invoiceDescription(invoice)}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{statusLabel(status)}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xl font-semibold text-foreground">{formatAmount(amountOf(invoice))}</p>
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(invoice.dueDate)}</p>
              </div>
              {status !== 'PAID' ? <Button className="mt-4 w-full" onClick={() => setPayModalOpen(true)}>Achită</Button> : null}
            </article>
          );
        })}
      </div>

      <Modal isOpen={payModalOpen} onClose={() => setPayModalOpen(false)} maxWidth="md">
        <ModalHeader title="Achită" onClose={() => setPayModalOpen(false)} />
        <ModalBody>
          <p className="text-sm text-muted-foreground">Integrarea de plată va fi conectată ulterior.</p>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setPayModalOpen(false)}>Închide</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export { asArray };
