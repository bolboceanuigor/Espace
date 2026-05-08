'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import {
  normalizeResidentInvoice,
  normalizeResidentPayment,
  residentInvoices,
  residentInvoiceStatusVariant,
  residentPayments,
  type ResidentPayment,
} from '@/lib/resident-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function ResidentInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [invoice, setInvoice] = useState<any>(null);
  const [rawInvoice, setRawInvoice] = useState<any>(null);
  const [payments, setPayments] = useState<ResidentPayment[]>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'mock' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    residentDemoApi
      .invoice(params.id)
      .then((res) => {
        if (!active) return;
        setRawInvoice(res.data);
        setInvoice(normalizeResidentInvoice(res.data));
        setPayments((res.data?.payments || []).map(normalizeResidentPayment));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        const fallback = residentInvoices.find((item) => item.id === params.id) ?? null;
        setRawInvoice(null);
        setInvoice(fallback);
        setPayments(fallback ? residentPayments : []);
        setSource(fallback ? 'mock' : 'error');
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  const services = Array.isArray(rawInvoice?.services)
    ? rawInvoice.services
    : invoice?.services?.map((name: string) => ({ name, amount: null })) || [];
  const paymentInstructions = rawInvoice?.paymentInstructions;
  const invoiceStatusVariant = invoice
    ? residentInvoiceStatusVariant[invoice.status as keyof typeof residentInvoiceStatusVariant] ?? 'warning'
    : 'warning';

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Detalii factură"
        description="Suma, scadența, plățile asociate și instrucțiunile de plată."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : source === 'mock' ? 'Date temporare — API indisponibil' : 'Nu am putut încărca factura'}
            </span>
            {invoice && source === 'api' ? (
              <Link
                href={localizedPath(`/resident/invoices/${params.id}/print`)}
                className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/70"
              >
                Printează factura
              </Link>
            ) : null}
          </div>
        }
      />

      {source === 'loading' ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
      {source === 'error' ? (
        <Card className="border-rose-200 bg-rose-50/70 p-5 text-sm font-semibold text-rose-700">
          Nu am putut încărca factura.
        </Card>
      ) : null}

      {invoice ? (
        <>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{invoice.number}</p>
                <h1 className="mt-1 text-2xl font-semibold text-foreground">{invoice.month}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apartament {rawInvoice?.apartmentNumber || rawInvoice?.apartment?.number || invoice.apartmentNumber || '-'}
                </p>
              </div>
              <Badge variant={invoiceStatusVariant}>{invoice.status}</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Suma totală" value={formatMdl(invoice.amount)} strong />
              <Info label="Achitat" value={formatMdl(invoice.paidAmount || 0)} />
              <Info label="Restant" value={formatMdl(invoice.remainingAmount || 0)} danger={invoice.remainingAmount > 0} />
              <Info label="Data scadentă" value={invoice.dueDate} />
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-foreground">Servicii incluse</h2>
            {services.length ? (
              <div className="mt-4 grid gap-2">
                {services.map((service: any, index: number) => (
                  <div key={service.id || `${service.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-3 text-sm">
                    <span className="font-medium text-foreground">{service.tariffName || service.name || 'Serviciu'}</span>
                    {service.amount !== null && service.amount !== undefined ? <span className="text-muted-foreground">{formatMdl(Number(service.amount || 0))}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-muted/35 p-3 text-sm text-muted-foreground">
                Detalierea serviciilor va fi disponibilă ulterior.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold text-foreground">Istoric plăți asociate</h2>
            <div className="mt-4 grid gap-2">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{formatMdl(payment.amount)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{payment.method}</p>
                  </div>
                  <p className="text-right text-xs text-muted-foreground">{payment.paidAt}</p>
                </div>
              ))}
              {!payments.length ? <p className="rounded-2xl bg-muted/35 p-3 text-sm text-muted-foreground">Nu există plăți asociate acestei facturi.</p> : null}
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <ReceiptText className="h-4 w-4" />
              Instrucțiuni de plată
            </h2>
            {paymentInstructions?.configured ? (
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                {paymentInstructions.bankName ? <p><span className="font-semibold text-foreground">Bancă:</span> {paymentInstructions.bankName}</p> : null}
                {paymentInstructions.bankAccountIban ? <p><span className="font-semibold text-foreground">IBAN:</span> {paymentInstructions.bankAccountIban}</p> : null}
                {paymentInstructions.bankSwift ? <p><span className="font-semibold text-foreground">SWIFT:</span> {paymentInstructions.bankSwift}</p> : null}
                {paymentInstructions.paymentInstructions ? <p>{paymentInstructions.paymentInstructions}</p> : null}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-muted/35 p-3 text-sm text-muted-foreground">
                Administratorul nu a configurat încă instrucțiunile de plată.
              </p>
            )}
            <button
              type="button"
              disabled
              className="mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-border/70 bg-muted/35 px-4 text-sm font-semibold text-muted-foreground"
            >
              <CreditCard className="h-4 w-4" />
              Plățile online vor fi conectate ulterior
            </button>
          </Card>

          <Link href={localizedPath('/resident/invoices')} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground">
            Înapoi la facturi
          </Link>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 ${strong ? 'text-xl font-semibold' : 'font-semibold'} ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
