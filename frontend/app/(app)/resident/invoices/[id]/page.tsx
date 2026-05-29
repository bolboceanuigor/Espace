'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, FileText, Home, Loader2, Printer, ReceiptText, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentInvoiceStatus = 'PUBLISHED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
type PaymentDisplayStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

type PaymentIntentPlaceholder = {
  id: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  amount: number;
  currency: 'MDL';
  status: 'CREATED' | 'VIEWED' | 'CANCELLED' | 'EXPIRED' | 'PAID_MANUALLY' | 'FAILED';
  provider: 'NONE' | string;
  expiresAt?: string | null;
  createdAt?: string | null;
  message?: string;
  realMoneyProcessed?: boolean;
};

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
    remainingAmount?: number;
    paymentDisplayStatus?: PaymentDisplayStatus;
    issueDate?: string | null;
    dueDate?: string | null;
    isOverdue: boolean;
    publicNote?: string | null;
    canPayPlaceholder?: boolean;
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
    calculationType?: string;
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
  publicNote?: string | null;
  paymentDisplayStatus?: PaymentDisplayStatus;
  paidAmount?: number;
  remainingAmount?: number;
  canPayPlaceholder?: boolean;
  activePaymentIntent?: PaymentIntentPlaceholder | null;
  paymentUnavailableMessage?: string;
};

const paymentStatusLabels: Record<PaymentDisplayStatus, string> = {
  UNPAID: 'Neachitată',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  OVERDUE: 'Restantă',
  CANCELLED: 'Anulată',
};

const paymentStatusVariant: Record<PaymentDisplayStatus, 'default' | 'warning' | 'success' | 'neutral' | 'error'> = {
  UNPAID: 'default',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'error',
  CANCELLED: 'neutral',
};

export default function ResidentInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const invoiceId = String(params?.id || '');
  const [data, setData] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    invoicesApi
      .getResidentInvoice(invoiceId)
      .then((res) => {
        if (!active) return;
        setData(res.data || null);
        invoicesApi.markResidentInvoiceViewed(invoiceId).catch(() => undefined);
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
  const displayStatus = data ? data.paymentDisplayStatus || invoice?.paymentDisplayStatus || fallbackPaymentStatus(invoice) : null;
  const statusLabel = displayStatus ? paymentStatusLabels[displayStatus] : 'Se încarcă';
  const remainingAmount = data ? data.remainingAmount ?? invoice?.remainingAmount ?? invoice?.balanceAmount ?? 0 : 0;
  const paidAmount = data ? data.paidAmount ?? invoice?.paidAmount ?? 0 : 0;
  const activeIntent = data?.activePaymentIntent || null;

  async function preparePayment() {
    if (!invoice) return;
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await invoicesApi.createResidentPaymentIntentPlaceholder(invoice.id, { confirm: true });
      const intent = response.data?.intent || null;
      setData((current) => (current ? { ...current, activePaymentIntent: intent } : current));
      setPaymentMessage(response.data?.message || intent?.message || 'Plata online nu este activă încă. Această acțiune este doar o pregătire tehnică.');
      setPaymentModalOpen(true);
    } catch (err: any) {
      setPaymentError(String(err?.message || 'Nu am putut pregăti plata.'));
    } finally {
      setPaymentLoading(false);
    }
  }

  async function cancelPaymentIntent() {
    if (!activeIntent) return;
    setPaymentLoading(true);
    setPaymentError('');
    try {
      await invoicesApi.cancelResidentPaymentIntentPlaceholder(activeIntent.id, { reason: 'Anulat de locatar.' });
      setData((current) => (current ? { ...current, activePaymentIntent: null } : current));
      setPaymentMessage('Pregătirea plății a fost anulată. Factura nu a fost modificată.');
      setPaymentModalOpen(true);
    } catch (err: any) {
      setPaymentError(String(err?.message || 'Nu am putut anula pregătirea plății.'));
    } finally {
      setPaymentLoading(false);
    }
  }

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
    <div className="space-y-5 pb-8 print:pb-0">
      <Link href={localizedPath('/resident/invoices')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la facturi
      </Link>

      <PageHeader
        title={invoice?.invoiceNumber || 'Detalii factură'}
        description={invoice ? `${monthLabel(invoice.billingMonth)} · Apt. ${data?.apartment.apartmentNumber}` : 'Se încarcă factura.'}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association ? <Badge variant="neutral">{data.association.shortName} · {data.association.associationCode || 'cod necompletat'}</Badge> : null}
            {displayStatus ? <Badge variant={paymentStatusVariant[displayStatus]}>{statusLabel}</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}

      {data && invoice ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total" value={formatMdl(invoice.totalAmount)} description="Total factură" icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Achitat" value={formatMdl(paidAmount)} description="Înregistrat de admin" icon={<ReceiptText className="h-5 w-5" />} tone="success" />
            <StatCard label="Sold rămas" value={formatMdl(remainingAmount)} description="Informativ" icon={<CreditCard className="h-5 w-5" />} tone={remainingAmount > 0 ? 'warning' : 'success'} />
            <StatCard label="Scadență" value={formatDate(invoice.dueDate)} description={displayStatus === 'OVERDUE' ? 'Depășită' : 'Termen plată'} icon={<ReceiptText className="h-5 w-5" />} tone={displayStatus === 'OVERDUE' ? 'danger' : 'neutral'} />
            <StatCard label="Status" value={statusLabel} description={invoice.billingMonth} icon={<FileText className="h-5 w-5" />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Factură / aviz</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{invoice.invoiceNumber}</h2>
                </div>
                {displayStatus ? <Badge variant={paymentStatusVariant[displayStatus]}>{statusLabel}</Badge> : null}
              </div>

              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Luna de facturare" value={monthLabel(invoice.billingMonth)} />
                <Info label="Data emiterii" value={formatDate(invoice.issueDate)} />
                <Info label="Scadență" value={formatDate(invoice.dueDate)} />
                <Info label="Apartament" value={`Apt. ${data.apartment.apartmentNumber}`} />
                <Info label="Scara" value={data.apartment.staircase || '-'} />
                <Info label="Suprafață" value={data.apartment.areaM2 ? `${data.apartment.areaM2} m²` : '-'} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                <ButtonLink href={localizedPath('/resident/invoices')} variant="secondary">
                  <ArrowLeft className="h-4 w-4" />
                  Înapoi la facturi
                </ButtonLink>
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
              <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                {data.paymentUnavailableMessage || 'Plata online va fi disponibilă ulterior.'} Pentru moment, poți consulta factura și instrucțiunile administratorului.
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

          <Card className="print:hidden">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-4 w-4" />
                  Plată online
                </h2>
                {displayStatus === 'PAID' ? (
                  <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Factura este marcată ca achitată.</p>
                ) : (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Plata online nu este activă încă. Butonul de mai jos creează doar o pregătire tehnică internă și nu retrage bani.
                  </p>
                )}
                {activeIntent ? (
                  <div className="mt-4 grid gap-2 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm sm:grid-cols-3">
                    <Info label="Intent" value={activeIntent.id.slice(0, 8)} />
                    <Info label="Status" value={activeIntent.status} />
                    <Info label="Expiră" value={formatDateTime(activeIntent.expiresAt)} />
                  </div>
                ) : null}
                {paymentError ? <p className="mt-3 text-sm font-semibold text-rose-700">{paymentError}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/resident/payments?invoiceId=${invoice.id}`} variant="secondary">
                  <ReceiptText className="h-4 w-4" />
                  Istoric plăți
                </ButtonLink>
                {data.canPayPlaceholder && displayStatus !== 'PAID' ? (
                  <Button type="button" onClick={preparePayment} disabled={paymentLoading}>
                    {paymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Pregătește plata
                  </Button>
                ) : null}
                {activeIntent ? (
                  <Button type="button" variant="secondary" onClick={cancelPaymentIntent} disabled={paymentLoading}>
                    <XCircle className="h-4 w-4" />
                    Anulează intentul
                  </Button>
                ) : null}
              </div>
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
                  <Info label="Unitate" value={line.unit || '-'} />
                  <strong className="text-right text-foreground">{formatMdl(line.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-4 text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatMdl(invoice.totalAmount)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Achitat: {formatMdl(paidAmount)} · Sold: {formatMdl(remainingAmount)}</p>
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <UserRound className="h-4 w-4" />
              Observații
            </h2>
            {data.publicNote || invoice.publicNote ? (
              <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-foreground">{data.publicNote || invoice.publicNote}</p>
            ) : null}
            <p className="mt-3 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              Această pagină afișează factura publicată de administrator. Folosește butonul Print pentru o versiune potrivită pentru tipărire; PDF-ul final rămâne pentru o etapă viitoare.
            </p>
          </Card>
        </>
      ) : null}

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} maxWidth="lg">
        <ModalHeader title="Plata online va fi disponibilă ulterior" onClose={() => setPaymentModalOpen(false)} />
        <ModalBody className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Nu s-au retras bani.</p>
                <p className="mt-1 leading-6">{paymentMessage || 'Această acțiune este doar o pregătire tehnică pentru integrarea plăților reale.'}</p>
              </div>
            </div>
          </div>
          {invoice ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label="Factură" value={invoice.invoiceNumber} />
              <Info label="Sumă" value={formatMdl(remainingAmount)} strong />
              <Info label="Monedă" value={invoice.currency} />
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" onClick={() => setPaymentModalOpen(false)}>Am înțeles</Button>
        </ModalFooter>
      </Modal>
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

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function fallbackPaymentStatus(invoice?: InvoiceDetails['invoice'] | null): PaymentDisplayStatus {
  if (!invoice) return 'UNPAID';
  if (invoice.status === 'CANCELLED') return 'CANCELLED';
  if (invoice.status === 'PAID') return 'PAID';
  if (invoice.status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  if (invoice.isOverdue) return 'OVERDUE';
  return 'UNPAID';
}
