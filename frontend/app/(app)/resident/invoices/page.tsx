'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { normalizeResidentInvoice, residentInvoices, residentInvoiceStatusVariant } from '@/lib/resident-mvp-data';

export default function ResidentInvoicesPage() {
  const [rows, setRows] = useState<typeof residentInvoices>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');

  useEffect(() => {
    let active = true;
    residentDemoApi
      .invoices()
      .then((res) => {
        if (!active) return;
        const apiRows = (res.data || []).map(normalizeResidentInvoice);
        setRows(apiRows);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setRows(residentInvoices);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Facturi"
        description="Facturile lunare pentru apartamentul tău."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      <section className="grid gap-3">
        {rows.map((invoice) => (
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
              <Info label="Achitat" value={formatMdl(invoice.paidAmount || 0)} />
              <Info label="Rest de plată" value={formatMdl(invoice.remainingAmount || 0)} strong={invoice.remainingAmount > 0} />
              <Info label="Data scadentă" value={invoice.dueDate} />
            </div>
            {invoice.services.length ? <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Servicii incluse</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {invoice.services.map((service) => (
                  <span key={service} className="rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-medium text-foreground">
                    {service}
                  </span>
                ))}
              </div>
            </div> : null}
          </Card>
        ))}
        {!rows.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">{source === 'api' ? 'Nu există facturi pentru apartamentul tău.' : 'Nu există facturi încă.'}</Card> : null}
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
