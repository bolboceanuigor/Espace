'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { residentInvoices, residentInvoiceStatusVariant, residentProfile, type ResidentInvoiceStatus } from '@/lib/resident-mvp-data';

export default function ResidentPaymentsPage() {
  const [filter, setFilter] = useState<'Toate' | ResidentInvoiceStatus>('Toate');
  const visible = useMemo(() => residentInvoices.filter((invoice) => filter === 'Toate' || invoice.status === filter), [filter]);
  const paidThisYear = residentInvoices.filter((invoice) => invoice.status === 'Achitat').reduce((sum, invoice) => sum + invoice.amount, 0);
  const unpaidCount = residentInvoices.filter((invoice) => invoice.status !== 'Achitat').length;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Plăți" description="Soldul și istoricul plăților pentru Apt. 45." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Sold curent" value={formatMdl(residentProfile.currentBalance)} description={residentProfile.status} icon={<ReceiptText className="h-5 w-5" />} tone="danger" />
        <StatCard label="Total achitat anul acesta" value={formatMdl(paidThisYear)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Facturi neachitate" value={unpaidCount} description="Necesită atenție" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['Toate', 'Achitat', 'Neachitat', 'Întârziat'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === item ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-foreground'}`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="grid gap-3">
        {visible.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{invoice.month}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{invoice.number}</p>
              </div>
              <Badge variant={residentInvoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Suma</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{formatMdl(invoice.amount)}</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">Scadență: {invoice.dueDate}</p>
            </div>
            {invoice.status !== 'Achitat' ? (
              <Button className="mt-4 w-full"><CreditCard className="h-4 w-4" /> Achită factura</Button>
            ) : (
              <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">Achitat pe {invoice.paidDate}</p>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
