'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Banknote, CreditCard, FileText, Home, ReceiptText } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PaymentStatus = 'CONFIRMED' | 'CANCELLED';
type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';

type PaymentDetails = {
  payment: {
    id: string;
    amount: number;
    currency: 'MDL';
    paymentDate?: string | null;
    method: string;
    referenceNumber?: string;
    payerName?: string;
    notes?: string;
    status: PaymentStatus;
    createdAt: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    billingMonth: string;
    status: InvoiceStatus;
    currency: 'MDL';
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    issueDate?: string | null;
    dueDate?: string | null;
  };
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    floor?: string | null;
  };
  association: {
    id: string | null;
    legalName: string;
    shortName: string;
    associationCode?: string | null;
    address?: string | null;
  };
  invoiceBalanceAfterPayment?: number;
};

const methodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată',
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
};

const invoiceStatusVariant = {
  ISSUED: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
  VOID: 'neutral',
} as const;

export default function ResidentPaymentDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const paymentId = String(params?.id || '');
  const [data, setData] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentDemoApi
      .payment(paymentId)
      .then((res) => {
        if (!active) return;
        setData(res.data || null);
      })
      .catch((err: any) => {
        if (!active) return;
        setData(null);
        setError(String(err?.message || 'Nu am putut încărca plata.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [paymentId]);

  if (!loading && !data) {
    return (
      <div className="space-y-5 pb-8">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Plata nu a fost găsită</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Plata solicitată nu există sau nu aparține contului tău.</p>
          {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          <ButtonLink href="/resident/payments" className="mt-5">Înapoi la plăți</ButtonLink>
        </Card>
      </div>
    );
  }

  const payment = data?.payment;
  const invoice = data?.invoice;

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/resident/payments')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la plăți
      </Link>

      <PageHeader
        title={payment ? `${formatMdl(payment.amount)} · ${paymentStatusLabels[payment.status]}` : 'Detalii plată'}
        description={invoice ? `${invoice.invoiceNumber} · ${monthLabel(invoice.billingMonth)}` : 'Se încarcă plata.'}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {data?.association ? <Badge variant="neutral">{data.association.shortName} · {data.association.associationCode || 'cod necompletat'}</Badge> : null}
            {payment ? <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{paymentStatusLabels[payment.status]}</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}

      {data && payment && invoice ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Suma plății" value={formatMdl(payment.amount)} description="Înregistrată de administrator" icon={<Banknote className="h-5 w-5" />} tone={payment.status === 'CANCELLED' ? 'neutral' : 'success'} />
            <StatCard label="Data plății" value={formatDate(payment.paymentDate)} description="Data confirmării" icon={<ReceiptText className="h-5 w-5" />} />
            <StatCard label="Metodă" value={methodLabels[payment.method] || payment.method} description="Metoda raportată" icon={<CreditCard className="h-5 w-5" />} />
            <StatCard label="Sold factură" value={formatMdl(invoice.balanceAmount)} description="Sold curent" icon={<FileText className="h-5 w-5" />} tone={invoice.balanceAmount > 0 ? 'warning' : 'success'} />
            <StatCard label="Status factură" value={invoiceStatusLabels[invoice.status]} description={invoice.billingMonth} icon={<FileText className="h-5 w-5" />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card>
              <h2 className="text-base font-semibold text-foreground">Plată</h2>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Sumă" value={formatMdl(payment.amount)} strong />
                <Info label="Monedă" value={payment.currency} />
                <Info label="Data plății" value={formatDate(payment.paymentDate)} />
                <Info label="Metodă" value={methodLabels[payment.method] || payment.method} />
                <Info label="Status" value={paymentStatusLabels[payment.status]} />
                <Info label="Referință" value={payment.referenceNumber || '-'} />
                <Info label="Plătitor" value={payment.payerName || '-'} />
                <Info label="Înregistrată la" value={formatDate(payment.createdAt)} />
              </div>
              {payment.notes ? (
                <p className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">{payment.notes}</p>
              ) : null}
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <FileText className="h-4 w-4" />
                Factura asociată
              </h2>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Număr factură" value={invoice.invoiceNumber} strong />
                <Info label="Luna" value={monthLabel(invoice.billingMonth)} />
                <Info label="Total" value={formatMdl(invoice.totalAmount)} />
                <Info label="Achitat" value={formatMdl(invoice.paidAmount)} />
                <Info label="Sold" value={formatMdl(invoice.balanceAmount)} strong={invoice.balanceAmount > 0} />
                <Info label="Scadență" value={formatDate(invoice.dueDate)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={`/resident/invoices/${invoice.id}`} variant="secondary">Vezi factura</ButtonLink>
                <ButtonLink href="/resident/payments" variant="secondary">Înapoi la plăți</ButtonLink>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Home className="h-4 w-4" />
              Apartament și A.P.C.
            </h2>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Apartament" value={`Apt. ${data.apartment.apartmentNumber}`} strong />
              <Info label="Scara" value={data.apartment.staircase || '-'} />
              <Info label="Etaj" value={data.apartment.floor || '-'} />
              <Info label="A.P.C." value={data.association.shortName} />
              <Info label="Denumire" value={data.association.legalName} strong />
              <Info label="Cod A.P.C." value={data.association.associationCode || '-'} />
              <Info label="Adresă" value={data.association.address || '-'} />
            </div>
            <p className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              Istoricul este informativ. Locatarul nu poate modifica, anula sau crea plăți din această pagină.
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
