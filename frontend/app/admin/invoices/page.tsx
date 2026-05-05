'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileText, Search, Send } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { adminInvoices, invoiceStatusVariant, type AdminInvoice, type InvoiceStatus } from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';

const months = ['Toate', 'Mai 2026', 'Aprilie 2026', 'Martie 2026'];
const statuses: Array<'Toate' | InvoiceStatus> = ['Toate', 'Achitat', 'Neachitat', 'Întârziat'];

export default function AdminInvoicesPage() {
  const [month, setMonth] = useState('Toate');
  const [status, setStatus] = useState<'Toate' | InvoiceStatus>('Toate');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return adminInvoices.filter((invoice) => {
      const matchesSearch = !needle || `${invoice.apartment} ${invoice.staircase} ${invoice.month} ${invoice.invoiceNumber}`.toLowerCase().includes(needle);
      const matchesMonth = month === 'Toate' || invoice.month === month;
      const matchesStatus = status === 'Toate' || invoice.status === status;
      return matchesSearch && matchesMonth && matchesStatus;
    });
  }, [month, query, status]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Facturi"
        description="Facturi lunare pe apartament, cu status de plată și scadențe."
        rightSlot={<ButtonLink href="/admin/payments" variant="secondary">Vezi plăți</ButtonLink>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Facturi emise" value="142" description="Pentru Mai 2026" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Achitate" value="105" description={formatMdl(131950)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Neachitate" value="37" description={formatMdl(86450)} icon={<Clock3 className="h-5 w-5" />} tone="danger" />
        <StatCard label="Următoarea scadență" value="10 Iunie" description="Termen de plată curent" icon={<CalendarDays className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, lună sau număr factură" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={month} onChange={setMonth} options={months} label="Luna" />
          <Select value={status} onChange={(value) => setStatus(value as 'Toate' | InvoiceStatus)} options={statuses} label="Status" />
          <Button className="self-end" variant="primary"><Send className="h-4 w-4" /> Emite facturi</Button>
        </div>
      </Card>

      <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
        <div className="grid grid-cols-[1fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Factura</span>
          <span>Apartament</span>
          <span>Luna</span>
          <span>Suma</span>
          <span>Scadență</span>
          <span>Status</span>
          <span />
        </div>
        {filtered.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[1fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr_auto] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
            <div>
              <p className="font-semibold text-foreground">{invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">{invoice.paymentMethod ? `${invoice.paymentMethod} · ${invoice.paidDate}` : 'Așteaptă plată'}</p>
            </div>
            <span className="text-muted-foreground">Apt. {invoice.apartment}</span>
            <span className="text-muted-foreground">{invoice.month}</span>
            <span className="font-semibold text-foreground">{formatMdl(invoice.amount)}</span>
            <span className="text-muted-foreground">{invoice.dueDate}</span>
            <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            <ButtonLink href="/admin/invoices" size="sm" variant="secondary">Deschide</ButtonLink>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:hidden">
        {filtered.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
      </section>
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: AdminInvoice }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">{invoice.invoiceNumber}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Apt. {invoice.apartment} · {invoice.month}</p>
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

function Select({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10"
      >
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
