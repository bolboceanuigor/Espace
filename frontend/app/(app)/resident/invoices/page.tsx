'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, FileText, ReceiptText, Search, WalletCards } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentInvoiceStatus = 'PUBLISHED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

type ResidentInvoice = {
  id: string;
  metadataId?: string;
  invoiceNumber: string;
  billingMonth: string;
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    floor?: string | null;
  };
  association: {
    id: string | null;
    shortName: string;
    associationCode?: string | null;
  };
  status: ResidentInvoiceStatus;
  currency: 'MDL';
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  issueDate?: string | null;
  dueDate?: string | null;
  isOverdue: boolean;
};

type ApartmentOption = {
  id: string;
  apartmentNumber: string;
  staircase?: string | null;
  floor?: string | null;
  isPrimary?: boolean;
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

const statusLabels: Record<ResidentInvoiceStatus, string> = {
  PUBLISHED: 'Publicată',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
};

const statusVariant: Record<ResidentInvoiceStatus, 'default' | 'warning' | 'success' | 'neutral'> = {
  PUBLISHED: 'default',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export default function ResidentInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<ResidentInvoicesResponse | null>(null);
  const [billingMonth, setBillingMonth] = useState('');
  const [apartmentId, setApartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.getResidentInvoices({
        apartmentId: apartmentId || undefined,
        billingMonth: billingMonth || undefined,
        status: status || undefined,
        unpaidOnly: unpaidOnly || undefined,
        overdueOnly: overdueOnly || undefined,
        sortBy,
        page: 1,
        limit: 50,
      });
      setData(res.data || null);
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca facturile.'));
    } finally {
      setLoading(false);
    }
  }, [apartmentId, billingMonth, overdueOnly, sortBy, status, unpaidOnly]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const rows = data?.items || [];
  const stats = data?.stats || {
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    balanceAmount: 0,
    unpaidInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
  };
  const apartments = useMemo(() => data?.apartments || [], [data?.apartments]);
  const apartmentLabel = useMemo(() => {
    if (!apartments.length) return 'fără apartament';
    if (apartments.length === 1) return `Apt. ${apartments[0].apartmentNumber}`;
    return `${apartments.length} apartamente`;
  }, [apartments]);

  const emptyTitle = data?.emptyStateCode === 'NO_APARTMENT' ? 'Nu ai un apartament asociat contului' : 'Nu există facturi publicate încă';
  const emptyText =
    data?.emptyStateCode === 'NO_APARTMENT'
      ? 'Contactează administratorul asociației pentru a lega contul tău de apartament.'
      : 'Facturile vor apărea aici după ce administratorul le publică în portal.';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Facturile mele"
        description="Vezi facturile publicate pentru apartamentul tău."
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
        <StatCard label="Total facturi" value={stats.totalInvoices} description="Publicate în portal" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Total publicat" value={formatMdl(stats.totalAmount)} description="Informativ" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(stats.paidAmount)} description="Înregistrat de admin" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Sold rămas" value={formatMdl(stats.balanceAmount)} description="De achitat manual" icon={<ReceiptText className="h-5 w-5" />} tone={stats.balanceAmount > 0 ? 'warning' : 'success'} />
        <StatCard label="Neachitate" value={stats.unpaidInvoices} description="Cu sold deschis" icon={<Clock3 className="h-5 w-5" />} tone={stats.unpaidInvoices ? 'warning' : 'success'} />
        <StatCard label="Achitate" value={stats.paidInvoices} description="Sold zero" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Depășite" value={stats.overdueInvoices} description="Scadență trecută" icon={<CreditCard className="h-5 w-5" />} tone={stats.overdueInvoices ? 'danger' : 'neutral'} />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
          <Input label="Luna facturare" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Apartament</span>
            <select value={apartmentId} onChange={(event) => setApartmentId(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              <option value="">Toate apartamentele</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  Apt. {apartment.apartmentNumber}{apartment.staircase ? ` · sc. ${apartment.staircase}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              <option value="">Toate</option>
              <option value="PUBLISHED">Publicată</option>
              <option value="PARTIALLY_PAID">Parțial achitată</option>
              <option value="PAID">Achitată</option>
              <option value="CANCELLED">Anulată</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Sortare</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              <option value="newest">Cele mai noi</option>
              <option value="oldest">Cele mai vechi</option>
              <option value="amount_desc">Sumă descrescător</option>
              <option value="amount_asc">Sumă crescător</option>
              <option value="due_soon">Scadență apropiată</option>
            </select>
          </label>
          <Button type="button" variant={unpaidOnly ? 'primary' : 'secondary'} onClick={() => setUnpaidOnly((value) => !value)} className="self-end">
            Doar neachitate
          </Button>
          <Button type="button" variant={overdueOnly ? 'primary' : 'secondary'} onClick={() => setOverdueOnly((value) => !value)} className="self-end">
            Doar depășite
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
            <Search className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{emptyText}</p>
        </Card>
      ) : null}

      <section className="grid gap-3">
        {rows.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {monthLabel(invoice.billingMonth)} · Apt. {invoice.apartment.apartmentNumber}
                  {invoice.apartment.staircase ? ` · sc. ${invoice.apartment.staircase}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={invoice.isOverdue ? 'warning' : statusVariant[invoice.status]}>
                  {invoice.isOverdue ? 'Scadentă / întârziată' : statusLabels[invoice.status]}
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Info label="Total" value={formatMdl(invoice.totalAmount)} strong />
              <Info label="Achitat" value={formatMdl(invoice.paidAmount)} />
              <Info label="Sold" value={formatMdl(invoice.balanceAmount)} strong={invoice.balanceAmount > 0} />
              <Info label="Scadență" value={formatDate(invoice.dueDate)} />
              <Info label="Status" value={statusLabels[invoice.status]} />
            </div>

            <div className="mt-4">
              <Link
                href={localizedPath(`/resident/invoices/${invoice.id}`)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 sm:w-auto"
              >
                Deschide
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
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
