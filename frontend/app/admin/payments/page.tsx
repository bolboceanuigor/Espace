'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText, Search } from 'lucide-react';
import { Badge, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { adminInvoices, invoiceStatusVariant, type AdminInvoice, type InvoiceStatus } from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

const filters: Array<'Toate' | InvoiceStatus> = ['Toate', 'Achitat', 'Neachitat', 'Întârziat'];

export default function AdminPaymentsPage() {
  const localizedPath = useLocalizedPath();
  const [status, setStatus] = useState<'Toate' | InvoiceStatus>('Toate');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return adminInvoices.filter((invoice) => {
      const matchesSearch = !needle || `${invoice.apartment} ${invoice.month} ${invoice.invoiceNumber} ${invoice.staircase}`.toLowerCase().includes(needle);
      const matchesStatus = status === 'Toate' || invoice.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [query, status]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Plăți / Datorii" description="Facturi, încasări și restanțe pentru APC Alba Iulia 75." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total emis" value={formatMdl(218400)} description="Facturi emise luna curentă" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Total achitat" value={formatMdl(131950)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Restanțe" value={formatMdl(86450)} description="Solduri neachitate" icon={<CreditCard className="h-5 w-5" />} tone="danger" />
        <StatCard label="Facturi întârziate" value="37" description="Scadență depășită" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, lună sau număr factură" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`h-11 shrink-0 rounded-2xl border px-4 text-sm font-semibold transition ${
                  status === item ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-foreground hover:bg-muted/70'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[0.9fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Apartament</span>
          <span>Luna</span>
          <span>Suma</span>
          <span>Scadență</span>
          <span>Status</span>
          <span>Metodă</span>
          <span />
        </div>
        {visible.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[0.9fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">Apt. {invoice.apartment}</p>
              <p className="text-xs text-muted-foreground">{invoice.staircase}</p>
            </div>
            <span className="text-muted-foreground">{invoice.month}</span>
            <span className="font-semibold text-foreground">{formatMdl(invoice.amount)}</span>
            <span className="text-muted-foreground">{invoice.dueDate}</span>
            <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            <span className="text-muted-foreground">{invoice.paymentMethod ?? '-'}</span>
            <ButtonLink href="/admin/invoices" size="sm" variant="secondary">Deschide</ButtonLink>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:hidden">
        {visible.map((invoice) => (
          <PaymentCard key={invoice.id} invoice={invoice} />
        ))}
      </section>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Emitere facturi lunare</p>
            <p className="mt-1 text-sm text-muted-foreground">Flux mock pentru generarea facturilor după citiri și tarife.</p>
          </div>
          <Link href={localizedPath('/admin/invoices')} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            Vezi facturi
          </Link>
        </div>
      </Card>
    </div>
  );
}

function PaymentCard({ invoice }: { invoice: AdminInvoice }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Apt. {invoice.apartment}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{invoice.month} · {invoice.invoiceNumber}</p>
        </div>
        <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <Info label="Suma" value={formatMdl(invoice.amount)} strong />
        <Info label="Data scadentă" value={invoice.dueDate} />
        <Info label="Metodă plată" value={invoice.paymentMethod ?? '-'} />
      </div>
      <ButtonLink href="/admin/invoices" className="mt-4 w-full" variant="secondary">Deschide</ButtonLink>
    </Card>
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
