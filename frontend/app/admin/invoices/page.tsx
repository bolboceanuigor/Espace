'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Download, Eye, FileText, Home, Search, WalletCards, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { SavedViewsBar } from '@/components/saved-views/SavedViewsComponents';
import { exportsApi, invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

type InternalInvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';

type InternalInvoice = {
  id: string;
  invoiceId?: string;
  invoiceNumber: string;
  billingMonth: string;
  status: InternalInvoiceStatus;
  currency: 'MDL';
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate?: string | null;
  createdAt: string;
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase?: string;
    floor?: string | null;
  };
  primaryContact?: { id: string; fullName: string; phone?: string | null } | null;
};

type InvoiceListResponse = {
  items: InternalInvoice[];
  meta: { page: number; limit: number; total: number };
  stats: {
    issued: number;
    paid: number;
    partiallyPaid: number;
    cancelled: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
  };
  association?: {
    shortName: string;
    associationCode: string;
  };
};

const statusLabels: Record<InternalInvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Achitată parțial',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'VOID',
};

const statusVariant = {
  ISSUED: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
  VOID: 'neutral',
} as const;

export default function AdminInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [billingMonth, setBillingMonth] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.adminList({
        billingMonth: billingMonth || undefined,
        status: status || undefined,
        search: query || undefined,
        sortBy,
        sortDirection,
        page: 1,
        limit: 50,
      });
      setData(res.data || null);
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca facturile interne.'));
    } finally {
      setLoading(false);
    }
  }, [billingMonth, query, sortBy, sortDirection, status]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const monthValue = params.get('billingMonth') || '';
    const statusValue = params.get('status') || '';
    const searchValue = params.get('search') || '';
    if (monthValue) setBillingMonth(monthValue);
    if (statusValue) setStatus(statusValue === 'PARTIAL' ? 'PARTIALLY_PAID' : statusValue);
    if (searchValue) setQuery(searchValue);
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const rows = data?.items || [];
  const stats = data?.stats || {
    issued: 0,
    paid: 0,
    partiallyPaid: 0,
    cancelled: 0,
    totalAmount: 0,
    paidAmount: 0,
    balanceAmount: 0,
  };

  const canClearFilters = Boolean(billingMonth || status || query);

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'Toate statusurile' },
      { value: 'ISSUED', label: 'Emise' },
      { value: 'PAID', label: 'Achitate' },
      { value: 'PARTIALLY_PAID', label: 'Achitate parțial' },
      { value: 'CANCELLED', label: 'Anulate' },
      { value: 'VOID', label: 'VOID' },
    ],
    [],
  );

  async function updateStatus(invoice: InternalInvoice, nextStatus: 'CANCELLED' | 'VOID') {
    setBusy(`${invoice.id}:${nextStatus}`);
    setError('');
    setMessage('');
    try {
      await invoicesApi.adminUpdateStatus(invoice.invoiceId || invoice.id, { status: nextStatus });
      setMessage(nextStatus === 'VOID' ? 'Factura a fost marcată VOID.' : 'Factura a fost anulată.');
      await loadInvoices();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut actualiza statusul facturii.'));
    } finally {
      setBusy('');
    }
  }

  const toggleSortDirection = () => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));

  async function exportCsv() {
    setError('');
    setMessage('');
    try {
      const res = await exportsApi.adminInvoicesCsv({
        billingMonth: billingMonth || undefined,
        status: status || undefined,
        apartmentNumber: query || undefined,
      });
      downloadBlob(res.data, `facturi-interne-${billingMonth || 'toate'}.csv`);
      setMessage('Exportul CSV pentru facturi a fost generat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera exportul CSV.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Facturi interne"
        description="Facturile finale generate din drafturile blocate ale asociației."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association ? (
              <Badge variant="neutral">{data.association.shortName} · {data.association.associationCode}</Badge>
            ) : null}
            <ButtonLink href={localizedPath('/admin/payments/reconciliation')} variant="secondary">Reconciliere plăți</ButtonLink>
            <ButtonLink href={localizedPath('/admin/invoices/draft')} variant="secondary">Mergi la calcul draft</ButtonLink>
            <Button type="button" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <SavedViewsBar
        module="INVOICES"
        currentFilters={{ billingMonth, status, search: query }}
        sort={{ sortBy, sortDirection }}
        onApply={(viewFilters, viewSort) => {
          setBillingMonth(String(viewFilters.billingMonth || ''));
          setStatus(String(viewFilters.status || ''));
          setQuery(String(viewFilters.search || ''));
          if (viewSort?.sortBy) setSortBy(String(viewSort.sortBy));
          if (viewSort?.sortDirection === 'asc' || viewSort?.sortDirection === 'desc') setSortDirection(viewSort.sortDirection);
        }}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total facturi" value={String(data?.meta.total || 0)} description="În evidența internă" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Total emis" value={formatMdl(stats.totalAmount)} description="Suma finală internă" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(stats.paidAmount)} description={`${stats.paid} facturi achitate`} icon={<WalletCards className="h-5 w-5" />} tone="success" />
        <StatCard label="Sold rămas" value={formatMdl(stats.balanceAmount)} description="De urmărit manual" icon={<WalletCards className="h-5 w-5" />} tone={stats.balanceAmount > 0 ? 'warning' : 'success'} />
        <StatCard label="Facturi emise" value={String(stats.issued)} description="Neachitate încă" icon={<FileText className="h-5 w-5" />} tone="warning" />
        <StatCard label="Anulate / VOID" value={String(stats.cancelled)} description="Nu intră în colectare" icon={<XCircle className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.9fr_0.9fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută factură, apartament, contact sau telefon" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Input label="Luna" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              {statusOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Sortare</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              <option value="createdAt">Data creării</option>
              <option value="invoiceNumber">Număr factură</option>
              <option value="apartmentNumber">Apartament</option>
              <option value="totalAmount">Suma totală</option>
              <option value="balanceAmount">Sold</option>
              <option value="dueDate">Scadență</option>
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={toggleSortDirection} className="self-end">
            <ArrowUpDown className="h-4 w-4" />
            {sortDirection === 'asc' ? 'Asc' : 'Desc'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => { setBillingMonth(''); setStatus(''); setQuery(''); }} disabled={!canClearFilters} className="self-end">
            Resetează
          </Button>
        </div>
      </Card>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] xl:block">
        <div className="grid grid-cols-[1.15fr_0.8fr_1.1fr_0.7fr_0.85fr_0.75fr_0.75fr_0.75fr_0.85fr_1.05fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Număr factură</span>
          <span>Apartament</span>
          <span>Contact principal</span>
          <span>Luna</span>
          <span>Total</span>
          <span>Achitat</span>
          <span>Sold</span>
          <span>Status</span>
          <span>Scadență</span>
          <span>Acțiuni</span>
        </div>
        {rows.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[1.15fr_0.8fr_1.1fr_0.7fr_0.85fr_0.75fr_0.75fr_0.75fr_0.85fr_1.05fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <strong className="text-foreground">{invoice.invoiceNumber}</strong>
            <span className="text-muted-foreground">Apt. {invoice.apartment.apartmentNumber}{invoice.apartment.staircase ? ` · sc. ${invoice.apartment.staircase}` : ''}</span>
            <span className="text-muted-foreground">{invoice.primaryContact?.fullName || '-'}</span>
            <span className="text-muted-foreground">{invoice.billingMonth}</span>
            <strong className="text-foreground">{formatMdl(invoice.totalAmount)}</strong>
            <span className="text-muted-foreground">{formatMdl(invoice.paidAmount)}</span>
            <span className="font-semibold text-foreground">{formatMdl(invoice.balanceAmount)}</span>
            <Badge variant={statusVariant[invoice.status]}>{statusLabels[invoice.status]}</Badge>
            <span className="text-muted-foreground">{formatDate(invoice.dueDate)}</span>
            <RowActions invoice={invoice} busy={busy} localizedPath={localizedPath} onStatus={updateStatus} />
          </div>
        ))}
        {loading ? <div className="px-4 py-8 text-sm font-medium text-muted-foreground">Se încarcă datele...</div> : null}
        {!loading && !rows.length ? <EmptyState localizedPath={localizedPath} /> : null}
      </section>

      <section className="grid gap-3 xl:hidden">
        {rows.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{invoice.invoiceNumber}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Apt. {invoice.apartment.apartmentNumber} · {invoice.billingMonth}</p>
              </div>
              <Badge variant={statusVariant[invoice.status]}>{statusLabels[invoice.status]}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <Info label="Contact" value={invoice.primaryContact?.fullName || '-'} />
              <Info label="Total" value={formatMdl(invoice.totalAmount)} strong />
              <Info label="Achitat" value={formatMdl(invoice.paidAmount)} />
              <Info label="Sold" value={formatMdl(invoice.balanceAmount)} />
              <Info label="Scadență" value={formatDate(invoice.dueDate)} />
            </div>
            <div className="mt-4">
              <RowActions invoice={invoice} busy={busy} localizedPath={localizedPath} onStatus={updateStatus} />
            </div>
          </Card>
        ))}
        {loading ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {!loading && !rows.length ? <EmptyState localizedPath={localizedPath} /> : null}
      </section>
    </div>
  );
}

function RowActions({
  invoice,
  busy,
  localizedPath,
  onStatus,
}: {
  invoice: InternalInvoice;
  busy: string;
  localizedPath: (path: string) => string;
  onStatus: (invoice: InternalInvoice, status: 'CANCELLED' | 'VOID') => void;
}) {
  const canRegisterPayment = (invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID') && Number(invoice.balanceAmount || 0) > 0;
  const canCancel = invoice.status === 'ISSUED';
  return (
    <div className="flex flex-wrap gap-1.5">
      <ButtonLink href={localizedPath(`/admin/invoices/${invoice.invoiceId || invoice.id}`)} size="sm" variant="secondary">
        <Eye className="h-3.5 w-3.5" />
        Deschide
      </ButtonLink>
      {canRegisterPayment ? (
        <ButtonLink href={localizedPath(`/admin/payments?invoiceId=${invoice.invoiceId || invoice.id}`)} size="sm" variant="secondary">
          Înregistrează plată
        </ButtonLink>
      ) : null}
      <ButtonLink href={localizedPath(`/admin/apartments/${invoice.apartment.id}`)} size="sm" variant="secondary">
        <Home className="h-3.5 w-3.5" />
        Apartament
      </ButtonLink>
      {invoice.primaryContact?.id ? (
        <ButtonLink href={localizedPath(`/admin/residents/${invoice.primaryContact.id}`)} size="sm" variant="secondary">
          Locatar
        </ButtonLink>
      ) : null}
      {canCancel ? (
        <>
          <Button type="button" size="sm" variant="secondary" onClick={() => onStatus(invoice, 'CANCELLED')} isLoading={busy === `${invoice.id}:CANCELLED`}>
            Anulează
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => onStatus(invoice, 'VOID')} isLoading={busy === `${invoice.id}:VOID`}>
            VOID
          </Button>
        </>
      ) : null}
    </div>
  );
}

function EmptyState({ localizedPath }: { localizedPath: (path: string) => string }) {
  return (
    <div className="px-4 py-10 text-center">
      <h2 className="text-lg font-semibold text-foreground">Nu există facturi interne</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        După ce finalizezi un draft blocat, facturile interne vor apărea aici.
      </p>
      <ButtonLink href={localizedPath('/admin/invoices/draft')} className="mt-4">
        Mergi la calcul draft
      </ButtonLink>
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{value}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO').format(date);
}
