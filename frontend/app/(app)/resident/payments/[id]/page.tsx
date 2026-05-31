'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Banknote, CreditCard, FileText, Home, ReceiptText } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentBalanceApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type Payment = {
  id: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoice?: any | null;
  apartment?: { apartmentNumber?: string; number?: string; building?: { name?: string } | null; staircase?: { name?: string } | null; entrance?: { name?: string } | null } | null;
  resident?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  source: string;
  paidAt?: string | null;
  acceptedAt?: string | null;
  externalReference?: string | null;
  linkedProof?: { id: string } | null;
  note?: string | null;
  rejectionReason?: string | null;
  reversalReason?: string | null;
  createdAt?: string | null;
};

const statusLabels: Record<string, string> = {
  PENDING: 'În verificare',
  CONFIRMED: 'Confirmată',
  ACCEPTED: 'Acceptată',
  PARTIALLY_ACCEPTED: 'Acceptată parțial',
  REJECTED: 'Respinsă',
  FAILED: 'Eșuată',
  CANCELLED: 'Anulată',
  REVERSED: 'Inversată',
};

const methodLabels: Record<string, string> = {
  CASH: 'Numerar',
  BANK: 'Bancă',
  BANK_TRANSFER: 'Transfer bancar',
  MANUAL_BANK_TRANSFER: 'Transfer verificat manual',
  TERMINAL: 'Terminal',
  CARD_EXTERNAL: 'Card extern',
  BANK_STATEMENT: 'Extras bancar',
  ADJUSTMENT: 'Ajustare',
  OTHER: 'Altă metodă',
};

const sourceLabels: Record<string, string> = {
  PAYMENT_PROOF: 'Dovadă plată',
  MANUAL_ENTRY: 'Înregistrare manuală',
  IMPORT: 'Import',
  ADJUSTMENT: 'Ajustare',
  SYSTEM: 'Sistem',
};

const acceptedStatuses = ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'CONFIRMED'];

export default function ResidentPaymentDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const paymentId = String(params?.id || '');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    residentBalanceApi
      .getResidentPayment(paymentId)
      .then((res) => {
        if (!active) return;
        setPayment(res.data?.payment || null);
      })
      .catch((err: any) => {
        if (!active) return;
        setPayment(null);
        setError(String(err?.message || 'Nu am putut încărca plata.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [paymentId]);

  if (!loading && !payment) {
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

  const invoice = payment?.invoice;
  const apartmentNumber = payment?.apartment?.apartmentNumber || payment?.apartment?.number || '-';
  const statusVariant = payment && acceptedStatuses.includes(payment.status) ? 'success' : payment?.status === 'PENDING' ? 'warning' : 'neutral';

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/resident/payments')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la plăți
      </Link>

      <PageHeader
        title={payment ? `${formatMdl(payment.amount)} · ${statusLabels[payment.status] || payment.status}` : 'Detalii plată'}
        description={payment?.invoiceNumber ? `Factura ${payment.invoiceNumber}` : 'Plată înregistrată în contul tău.'}
        rightSlot={payment ? <Badge variant={statusVariant}>{statusLabels[payment.status] || payment.status}</Badge> : null}
      />

      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}

      {payment ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Suma plății" value={formatMdl(payment.amount)} description={sourceLabels[payment.source] || payment.source} icon={<Banknote className="h-5 w-5" />} tone={acceptedStatuses.includes(payment.status) ? 'success' : 'neutral'} />
            <StatCard label="Data plății" value={formatDate(payment.paidAt || payment.acceptedAt)} description="Data raportată" icon={<ReceiptText className="h-5 w-5" />} />
            <StatCard label="Metodă" value={methodLabels[payment.method] || payment.method} description="Metoda înregistrată" icon={<CreditCard className="h-5 w-5" />} />
            <StatCard label="Factură" value={payment.invoiceNumber || '-'} description={invoice?.billingMonth || 'Fără factură asociată'} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Apartament" value={`Apt. ${apartmentNumber}`} description={payment.apartment?.staircase?.name || payment.apartment?.entrance?.name || '-'} icon={<Home className="h-5 w-5" />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card>
              <h2 className="text-base font-semibold text-foreground">Plată</h2>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Sumă" value={formatMdl(payment.amount)} strong />
                <Info label="Monedă" value={payment.currency} />
                <Info label="Data plății" value={formatDate(payment.paidAt)} />
                <Info label="Acceptată la" value={formatDate(payment.acceptedAt)} />
                <Info label="Metodă" value={methodLabels[payment.method] || payment.method} />
                <Info label="Status" value={statusLabels[payment.status] || payment.status} />
                <Info label="Sursă" value={sourceLabels[payment.source] || payment.source} />
                <Info label="Referință" value={payment.externalReference || '-'} />
                <Info label="Dovadă" value={payment.linkedProof?.id ? 'Atașată' : '-'} />
                <Info label="Locatar" value={payment.resident?.name || '-'} />
              </div>
              {payment.note ? <p className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">{payment.note}</p> : null}
              {payment.rejectionReason || payment.reversalReason ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{payment.rejectionReason || payment.reversalReason}</p>
              ) : null}
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <FileText className="h-4 w-4" />
                Factura asociată
              </h2>
              {invoice ? (
                <>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <Info label="Număr factură" value={invoice.invoiceNumber || payment.invoiceNumber || '-'} strong />
                    <Info label="Perioadă" value={invoice.billingMonth || '-'} />
                    <Info label="Status" value={invoice.status || '-'} />
                    <Info label="Total" value={formatMdl(invoice.totalAmount || 0)} />
                    <Info label="Achitat" value={formatMdl(invoice.paidAmount || 0)} />
                    <Info label="Rămas" value={formatMdl(invoice.remainingAmount || 0)} strong={(invoice.remainingAmount || 0) > 0} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ButtonLink href={`/resident/invoices/${payment.invoiceId}`} variant="secondary">Vezi factura</ButtonLink>
                    <ButtonLink href="/resident/balance" variant="secondary">Vezi soldul</ButtonLink>
                  </div>
                </>
              ) : (
                <p className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm text-muted-foreground">Această plată nu este legată de o factură publicată.</p>
              )}
            </Card>
          </div>
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
