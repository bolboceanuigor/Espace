'use client';

import { Badge, Card, PageHeader } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { residentInvoices, residentInvoiceStatusVariant } from '@/lib/resident-mvp-data';

export default function ResidentInvoicesPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Facturi" description="Facturile lunare pentru Apt. 45." />
      <section className="grid gap-3">
        {residentInvoices.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{invoice.month}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{invoice.number}</p>
              </div>
              <Badge variant={residentInvoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Info label="Suma" value={formatMdl(invoice.amount)} strong />
              <Info label="Data scadentă" value={invoice.dueDate} />
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Servicii incluse</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {invoice.services.map((service) => (
                  <span key={service} className="rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-medium text-foreground">
                    {service}
                  </span>
                ))}
              </div>
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
      <p className={`mt-1 ${strong ? 'text-xl font-semibold' : 'font-semibold'} text-foreground`}>{value}</p>
    </div>
  );
}
