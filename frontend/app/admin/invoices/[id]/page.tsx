'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, FileText, Home, Printer, ReceiptText } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi } from '@/lib/api';
import { adminInvoices, invoiceStatusVariant, normalizeApiInvoice, type AdminInvoice } from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function AdminInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const fallback = useMemo(() => adminInvoices.find((invoice) => invoice.id === params.id) ?? adminInvoices[0], [params.id]);
  const [invoice, setInvoice] = useState<AdminInvoice>(fallback);
  const [rawInvoice, setRawInvoice] = useState<any>(null);
  const [source, setSource] = useState<'api' | 'mock'>('mock');

  useEffect(() => {
    let active = true;
    invoicesApi
      .get(params.id)
      .then((res) => {
        if (!active) return;
        setRawInvoice(res.data);
        setInvoice(normalizeApiInvoice(res.data, res.data?.payments || []));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setRawInvoice(null);
        setInvoice(fallback);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, [fallback, params.id]);

  const payments = Array.isArray(rawInvoice?.payments) ? rawInvoice.payments : [];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title={invoice.invoiceNumber}
        description={`Apt. ${invoice.apartment} · ${invoice.month}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            {source === 'api' ? (
              <ButtonLink href={localizedPath(`/admin/invoices/${params.id}/print`)} variant="secondary">
                <Printer className="h-4 w-4" />
                Printează factura
              </ButtonLink>
            ) : null}
            <ButtonLink href={localizedPath('/admin/invoices')} variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Înapoi
            </ButtonLink>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Apartament" value={`Apt. ${invoice.apartment}`} description={invoice.staircase} icon={<Home className="h-5 w-5" />} />
        <StatCard label="Suma" value={formatMdl(invoice.amount)} description="Total factură" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Scadență" value={invoice.dueDate} description="Termen de plată" icon={<ReceiptText className="h-5 w-5" />} tone={invoice.status === 'Întârziat' ? 'danger' : 'warning'} />
        <StatCard label="Status" value={invoice.status} description={invoice.paymentMethod ?? 'Așteaptă plată'} icon={<CreditCard className="h-5 w-5" />} tone={invoice.status === 'Achitat' ? 'success' : invoice.status === 'Întârziat' ? 'danger' : 'warning'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalii factură</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">{invoice.invoiceNumber}</h2>
            </div>
            <Badge variant={invoiceStatusVariant[invoice.status]}>{invoice.status}</Badge>
          </div>

          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Luna" value={invoice.month} />
            <Info label="Apartament" value={`Apt. ${invoice.apartment}`} />
            <Info label="Scara" value={invoice.staircase} />
            <Info label="Suma" value={formatMdl(invoice.amount)} strong />
            <Info label="Data scadentă" value={invoice.dueDate} />
            <Info label="Metodă plată" value={invoice.paymentMethod ?? '-'} />
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Servicii incluse</p>
          <div className="mt-4 grid gap-2 text-sm">
            {['Întreținere', 'Fond reparații', 'Apă', 'Încălzire', 'Curățenie', 'Lift'].map((item) => (
              <div key={item} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2">
                <span className="text-muted-foreground">{item}</span>
                <span className="font-medium text-foreground">Inclus</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">Plăți asociate</p>
            <p className="mt-1 text-sm text-muted-foreground">Listă informativă; procesarea online va fi conectată ulterior.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {payments.length ? (
            payments.map((payment: any) => (
              <div key={payment.id} className="grid gap-2 rounded-2xl border border-border/70 bg-white px-3 py-3 text-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                <span className="font-semibold text-foreground">{formatMdl(Number(payment.amount || 0))}</span>
                <span className="text-muted-foreground">{payment.method || '-'}</span>
                <span className="text-muted-foreground">{payment.paidAt ? new Intl.DateTimeFormat('ro-RO').format(new Date(payment.paidAt)) : 'Neconfirmată'}</span>
                <ButtonLink href={localizedPath(`/admin/payments/${payment.id}/print`)} size="sm" variant="secondary">
                  Confirmare
                </ButtonLink>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-muted/35 px-3 py-3 text-sm text-muted-foreground">Nu există plăți asociate acestei facturi.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 ${strong ? 'font-semibold' : 'font-medium'} text-foreground`}>{value}</p>
    </div>
  );
}
