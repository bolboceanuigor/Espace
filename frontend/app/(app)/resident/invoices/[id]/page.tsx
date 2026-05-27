'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, FileText, Home, Printer, ReceiptText, UserRound } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentInvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';

type InvoiceDetails = {
  invoice: {
    id: string;
    invoiceNumber: string;
    billingMonth: string;
    status: ResidentInvoiceStatus;
    currency: 'MDL';
    subtotalAmount: number;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    issueDate?: string | null;
    dueDate?: string | null;
    isOverdue: boolean;
  };
  association: {
    id: string | null;
    legalName: string;
    shortName: string;
    associationCode?: string | null;
    address?: string | null;
    administratorName?: string | null;
  };
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    floor?: string | null;
    areaM2?: number | null;
  };
  administratorContact?: {
    name?: string | null;
    paymentInstructions?: {
      configured: boolean;
      bankName?: string | null;
      bankAccountIban?: string | null;
      bankSwift?: string | null;
      paymentInstructions?: string | null;
    };
  };
  lines: Array<{
    id: string;
    lineType?: string;
    meterId?: string | null;
    meterReadingId?: string | null;
    meterType?: string | null;
    unit?: string | null;
    name: string;
    description?: string;
    calculationType: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    currency: 'MDL';
    formulaLabel?: string;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    method: string;
    paidAt?: string | null;
    paymentDate?: string | null;
    referenceNumber?: string;
    status: string;
  }>;
};

const statusLabels: Record<ResidentInvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const statusVariant = {
  ISSUED: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
  VOID: 'neutral',
} as const;

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

export default function ResidentInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const invoiceId = String(params?.id || '');
  const [data, setData] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentDemoApi
      .invoice(invoiceId)
      .then((res) => {
        if (!active) return;
        setData(res.data || null);
      })
      .catch((err: any) => {
        if (!active) return;
        setData(null);
        setError(String(err?.message || 'Nu am putut încărca factura.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [invoiceId]);

  const invoice = data?.invoice;
  const statusLabel = invoice ? (invoice.isOverdue ? 'Scadentă / întârziată' : statusLabels[invoice.status]) : 'Se încarcă';

  if (!loading && !data) {
    return (
      <div className="space-y-5 pb-8">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Factura nu a fost găsită</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Factura nu există sau nu aparține apartamentului legat de contul tău.</p>
          {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <ButtonLink href={localizedPath('/resident/invoices')} className="mt-5">Înapoi la facturi</ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/resident/invoices')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la facturi
      </Link>

      <PageHeader
        title={invoice?.invoiceNumber || 'Detalii factură'}
        description={invoice ? `${monthLabel(invoice.billingMonth)} · Apt. ${data?.apartment.apartmentNumber}` : 'Se încarcă factura internă.'}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association ? <Badge variant="neutral">{data.association.shortName} · {data.association.associationCode || 'cod necompletat'}</Badge> : null}
            {invoice ? <Badge variant={invoice.isOverdue ? 'error' : statusVariant[invoice.status]}>{statusLabel}</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}

      {data && invoice ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total" value={formatMdl(invoice.totalAmount)} description="Total factură" icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Achitat" value={formatMdl(invoice.paidAmount)} description="Înregistrat de admin" icon={<ReceiptText className="h-5 w-5" />} tone="success" />
            <StatCard label="Sold rămas" value={formatMdl(invoice.balanceAmount)} description="Informativ" icon={<CreditCard className="h-5 w-5" />} tone={invoice.balanceAmount > 0 ? 'warning' : 'success'} />
            <StatCard label="Scadență" value={formatDate(invoice.dueDate)} description={invoice.isOverdue ? 'Depășită' : 'Termen plată'} icon={<ReceiptText className="h-5 w-5" />} tone={invoice.isOverdue ? 'danger' : 'neutral'} />
            <StatCard label="Status" value={statusLabel} description={invoice.billingMonth} icon={<FileText className="h-5 w-5" />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Factură internă</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{invoice.invoiceNumber}</h2>
                </div>
                <Badge variant={invoice.isOverdue ? 'error' : statusVariant[invoice.status]}>{statusLabel}</Badge>
              </div>

              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Luna de facturare" value={monthLabel(invoice.billingMonth)} />
                <Info label="Data emiterii" value={formatDate(invoice.issueDate)} />
                <Info label="Scadență" value={formatDate(invoice.dueDate)} />
                <Info label="Apartament" value={`Apt. ${data.apartment.apartmentNumber}`} />
                <Info label="Scara" value={data.apartment.staircase || '-'} />
                <Info label="Suprafață" value={data.apartment.areaM2 ? `${data.apartment.areaM2} m²` : '-'} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={localizedPath('/resident/invoices')} variant="secondary">
                  <ArrowLeft className="h-4 w-4" />
                  Înapoi la facturi
                </ButtonLink>
                <ButtonLink href={localizedPath(`/resident/invoices/${invoice.id}/print`)} variant="secondary">
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
                </ButtonLink>
                <Button type="button" variant="secondary" disabled>
                  <CreditCard className="h-4 w-4" />
                  Achită online
                </Button>
              </div>
              <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                Pentru PDF, deschide preview-ul de print și folosește opțiunea Save as PDF din browser.
              </p>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Home className="h-4 w-4" />
                Asociație și administrator
              </h2>
              <div className="mt-4 grid gap-2 text-sm">
                <Info label="A.P.C." value={data.association.legalName || data.association.shortName} strong />
                <Info label="Adresă" value={data.association.address || '-'} />
                <Info label="Administrator" value={data.administratorContact?.name || data.association.administratorName || '-'} />
              </div>
              <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Instrucțiuni de plată</p>
                {data.administratorContact?.paymentInstructions?.configured ? (
                  <div className="mt-2 grid gap-1">
                    {data.administratorContact.paymentInstructions.bankName ? <p>Bancă: {data.administratorContact.paymentInstructions.bankName}</p> : null}
                    {data.administratorContact.paymentInstructions.bankAccountIban ? <p>IBAN: {data.administratorContact.paymentInstructions.bankAccountIban}</p> : null}
                    {data.administratorContact.paymentInstructions.bankSwift ? <p>SWIFT: {data.administratorContact.paymentInstructions.bankSwift}</p> : null}
                    {data.administratorContact.paymentInstructions.paymentInstructions ? <p>{data.administratorContact.paymentInstructions.paymentInstructions}</p> : null}
                  </div>
                ) : (
                  <p className="mt-2">Administratorul nu a configurat încă instrucțiunile de plată.</p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Plăți înregistrate</h2>
              <ButtonLink href={localizedPath('/resident/payments')} variant="secondary" size="sm">
                Vezi istoricul complet al plăților
              </ButtonLink>
            </div>
            <div className="mt-4 grid gap-2">
              {(data.payments || []).map((payment) => (
                <div key={payment.id} className="grid gap-2 rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm sm:grid-cols-[0.9fr_0.9fr_1fr_0.9fr] sm:items-center">
                  <span className="text-muted-foreground">{formatDate(payment.paymentDate || payment.paidAt)}</span>
                  <strong className="text-foreground">{formatMdl(payment.amount)}</strong>
                  <span className="text-muted-foreground">{paymentMethodLabels[payment.method] || payment.method}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{payment.status === 'CANCELLED' ? 'Anulată' : 'Confirmată'}</Badge>
                    <ButtonLink href={localizedPath(`/resident/payments/${payment.id}`)} variant="secondary" size="sm">Detalii</ButtonLink>
                  </div>
                  {payment.referenceNumber ? <p className="sm:col-span-4 text-xs text-muted-foreground">Referință: {payment.referenceNumber}</p> : null}
                </div>
              ))}
              {!data.payments?.length ? (
                <p className="rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">Nu există plăți înregistrate pentru această factură.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Linii factură</h2>
            <div className="mt-4 grid gap-2">
              {data.lines.map((line) => (
                <div key={line.id} className="grid gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm md:grid-cols-[1.2fr_0.75fr_0.75fr_0.75fr_0.85fr] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{line.name}</p>
                      {line.lineType === 'METER_CONSUMPTION' ? <Badge variant="neutral">Consum contor</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{line.description || line.formulaLabel || 'Serviciu facturat'}</p>
                    {line.formulaLabel ? <p className="mt-1 text-xs font-medium text-muted-foreground">{line.formulaLabel}</p> : null}
                    {line.meterReadingId ? (
                      <Link className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline" href={localizedPath(`/resident/meter-readings/${line.meterReadingId}`)}>
                        Vezi indicele
                      </Link>
                    ) : null}
                  </div>
                  <Info label="Cantitate" value={String(line.quantity)} />
                  <Info label="Preț unitar" value={formatMdl(line.unitPrice)} />
                  <Info label="Tip" value={line.calculationType} />
                  <strong className="text-right text-foreground">{formatMdl(line.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-4 text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatMdl(invoice.totalAmount)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Achitat: {formatMdl(invoice.paidAmount)} · Sold: {formatMdl(invoice.balanceAmount)}</p>
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <UserRound className="h-4 w-4" />
              Observații
            </h2>
            <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              Această pagină afișează facturi interne ale A.P.C. Plățile online, PDF-ul final și integrarea cu furnizori externi vor fi disponibile ulterior.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words ${strong ? 'font-semibold' : 'font-medium'} text-foreground`}>{value}</p>
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
