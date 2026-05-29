'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, FileText, Home, Printer, ReceiptText, UserRound, WalletCards, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi, paymentsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type InternalInvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';

type InternalInvoiceLine = {
  id: string;
  sourceDraftLineId?: string | null;
  tariffId?: string | null;
  lineType: 'TARIFF' | 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION' | 'METER_CONSUMPTION';
  meterId?: string | null;
  meterReadingId?: string | null;
  meterType?: string | null;
  unit?: string | null;
  name: string;
  description: string;
  calculationType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: 'MDL';
  formulaLabel: string;
};

type InternalInvoice = {
  id: string;
  invoiceId: string;
  sourceDraftId: string;
  invoiceNumber: string;
  billingMonth: string;
  issueDate?: string | null;
  dueDate?: string | null;
  status: InternalInvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes?: string;
  apartment: { id: string; apartmentNumber: string; staircase?: string; floor?: string | null };
  primaryContact?: { id: string; fullName: string; phone?: string | null } | null;
  lines: InternalInvoiceLine[];
  paymentProofs?: Array<{
    id: string;
    amount: number;
    acceptedAmount?: number | null;
    method: string;
    status: string;
    createdAt?: string | null;
    reviewedAt?: string | null;
    proofFileUrl?: string | null;
  }>;
  paymentProofsSummary?: { submitted: number; inReview: number; accepted: number; rejected: number };
};

type InvoicePayment = {
  id: string;
  amount: number;
  paymentDate?: string | null;
  method: string;
  referenceNumber?: string;
  notes?: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdBy?: { fullName?: string | null; email?: string | null } | null;
};

const statusLabels: Record<InternalInvoiceStatus, string> = {
  ISSUED: 'Emisă',
  PARTIALLY_PAID: 'Achitată parțial',
  PAID: 'Achitată',
  CANCELLED: 'Anulată',
  VOID: 'VOID',
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
  MANUAL_BANK_TRANSFER: 'Transfer bancar',
  CARD_TERMINAL: 'Terminal card',
  TERMINAL: 'Terminal',
  CARD_EXTERNAL: 'Card extern',
  INFOCOM: 'InfoCom',
  OPLATA: 'Oplata',
  OTHER: 'Altă metodă',
};

export default function AdminInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const invoiceId = String(params?.id || '');
  const [invoice, setInvoice] = useState<InternalInvoice | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [association, setAssociation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.adminGetOne(invoiceId);
      setInvoice(res.data?.invoice || null);
      setAssociation(res.data?.association || null);
      const paymentsRes = await paymentsApi.adminInvoicePayments(invoiceId).catch(() => ({ data: { items: [] } }));
      setPayments(paymentsRes.data?.items || []);
    } catch (err: any) {
      setInvoice(null);
      setPayments([]);
      setError(String(err?.message || 'Nu am putut încărca factura internă.'));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  async function updateStatus(nextStatus: 'CANCELLED' | 'VOID') {
    if (!invoice) return;
    setBusy(nextStatus);
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.adminUpdateStatus(invoice.invoiceId || invoice.id, { status: nextStatus });
      setInvoice(res.data?.invoice || null);
      setMessage(nextStatus === 'VOID' ? 'Factura a fost marcată VOID.' : 'Factura a fost anulată.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut actualiza statusul facturii.'));
    } finally {
      setBusy('');
    }
  }

  if (!loading && !invoice) {
    return (
      <div className="space-y-5 pb-8">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Factura nu a fost găsită</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Factura internă solicitată nu există sau nu aparține asociației tale.</p>
          <ButtonLink href={localizedPath('/admin/invoices')} className="mt-5">Înapoi la facturi</ButtonLink>
        </Card>
      </div>
    );
  }

  const canRegisterPayment = invoice ? (invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID') && Number(invoice.balanceAmount || 0) > 0 : false;
  const canCancel = invoice?.status === 'ISSUED';

  return (
    <div className="space-y-5 pb-8">
      <ButtonLink href={localizedPath('/admin/invoices')} variant="ghost">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la listă
      </ButtonLink>

      <PageHeader
        title={invoice?.invoiceNumber || 'Factură internă'}
        description={invoice ? `Apt. ${invoice.apartment.apartmentNumber} · luna ${invoice.billingMonth}` : 'Se încarcă datele...'}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {association ? <Badge variant="neutral">{association.shortName} · {association.associationCode}</Badge> : null}
            {invoice ? <Badge variant={statusVariant[invoice.status]}>{statusLabels[invoice.status]}</Badge> : null}
          </div>
        }
      />

      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {invoice ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Apartament" value={`Apt. ${invoice.apartment.apartmentNumber}`} description={invoice.apartment.staircase ? `Scara ${invoice.apartment.staircase}` : 'Scară nespecificată'} icon={<Home className="h-5 w-5" />} />
            <StatCard label="Total" value={formatMdl(invoice.totalAmount)} description="Total factură" icon={<WalletCards className="h-5 w-5" />} />
            <StatCard label="Achitat" value={formatMdl(invoice.paidAmount)} description="Plăți înregistrate" icon={<WalletCards className="h-5 w-5" />} tone="success" />
            <StatCard label="Sold" value={formatMdl(invoice.balanceAmount)} description="De urmărit manual" icon={<ReceiptText className="h-5 w-5" />} tone={invoice.balanceAmount > 0 ? 'warning' : 'success'} />
            <StatCard label="Status" value={statusLabels[invoice.status]} description={invoice.billingMonth} icon={<FileText className="h-5 w-5" />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalii factură</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{invoice.invoiceNumber}</h2>
                </div>
                <Badge variant={statusVariant[invoice.status]}>{statusLabels[invoice.status]}</Badge>
              </div>
              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Luna" value={invoice.billingMonth} />
                <Info label="Data emiterii" value={formatDate(invoice.issueDate)} />
                <Info label="Scadență" value={formatDate(invoice.dueDate)} />
                <Info label="Sursă draft" value={invoice.sourceDraftId} />
                <Info label="Total" value={formatMdl(invoice.totalAmount)} strong />
                <Info label="Sold" value={formatMdl(invoice.balanceAmount)} strong />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={localizedPath(`/admin/apartments/${invoice.apartment.id}`)} variant="secondary">
                  <Home className="h-4 w-4" />
                  Vezi apartament
                </ButtonLink>
                {invoice.primaryContact?.id ? (
                  <ButtonLink href={localizedPath(`/admin/residents/${invoice.primaryContact.id}`)} variant="secondary">
                    <UserRound className="h-4 w-4" />
                    Vezi locatar
                  </ButtonLink>
                ) : null}
                <ButtonLink href={localizedPath(`/admin/invoices/draft/${invoice.sourceDraftId}/review`)} variant="secondary">
                  Vezi draft
                </ButtonLink>
                {canRegisterPayment ? (
                  <ButtonLink href={localizedPath(`/admin/payments?invoiceId=${invoice.invoiceId || invoice.id}`)} variant="primary">
                    Înregistrează plată
                  </ButtonLink>
                ) : invoice.status === 'PAID' ? (
                  <Badge variant="success">Achitată</Badge>
                ) : null}
                <ButtonLink href={localizedPath(`/admin/invoices/${invoice.invoiceId || invoice.id}/print`)} variant="secondary">
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
                </ButtonLink>
                <ButtonLink href={localizedPath(`/admin/invoices/${invoice.invoiceId || invoice.id}/payment-intents`)} variant="secondary">
                  <CreditCard className="h-4 w-4" />
                  Plăți online
                </ButtonLink>
                {canCancel ? (
                  <>
                    <Button type="button" variant="secondary" onClick={() => updateStatus('CANCELLED')} isLoading={busy === 'CANCELLED'}>
                      <XCircle className="h-4 w-4" />
                      Anulează
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => updateStatus('VOID')} isLoading={busy === 'VOID'}>
                      VOID
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact principal</p>
              {invoice.primaryContact ? (
                <div className="mt-4 grid gap-2 text-sm">
                  <Info label="Nume" value={invoice.primaryContact.fullName} strong />
                  <Info label="Telefon" value={invoice.primaryContact.phone || '-'} />
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-muted/35 px-3 py-3 text-sm text-muted-foreground">Nu există contact principal conectat la această factură.</p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">Factura este internă. Trimiterea către locatari și PDF-ul final vor fi conectate ulterior.</p>
            </Card>
          </div>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Istoric plăți</h2>
            <div className="mt-4 grid gap-2">
              {payments.map((payment) => (
                <div key={payment.id} className="grid gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm md:grid-cols-[0.8fr_0.8fr_0.9fr_0.8fr_0.9fr_1fr] md:items-center">
                  <span className="text-muted-foreground">{formatDate(payment.paymentDate)}</span>
                  <strong className="text-foreground">{formatMdl(payment.amount)}</strong>
                  <span className="text-muted-foreground">{paymentMethodLabels[payment.method] || payment.method}</span>
                  <span className="text-muted-foreground">{payment.referenceNumber || '-'}</span>
                  <Badge variant={payment.status === 'CANCELLED' ? 'neutral' : 'success'}>{payment.status === 'CANCELLED' ? 'Anulată' : 'Confirmată'}</Badge>
                  <span className="text-muted-foreground">{payment.createdBy?.fullName || payment.createdBy?.email || '-'}</span>
                  {payment.notes ? <p className="md:col-span-6 text-xs text-muted-foreground">{payment.notes}</p> : null}
                </div>
              ))}
              {!payments.length ? (
                <p className="rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">Nu există plăți înregistrate pentru această factură.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Dovezi de plată</h2>
                <p className="mt-1 text-sm text-muted-foreground">Dovezile trimise de locatari pentru această factură.</p>
              </div>
              <ButtonLink href={localizedPath(`/admin/payment-proofs?invoiceId=${invoice.invoiceId || invoice.id}`)} variant="secondary">
                Vezi în verificare plăți
              </ButtonLink>
            </div>
            <div className="mt-4 grid gap-2">
              {(invoice.paymentProofs || []).map((proof) => (
                <div key={proof.id} className="grid gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm md:grid-cols-[0.9fr_0.8fr_0.8fr_0.8fr_auto] md:items-center">
                  <strong className="text-foreground">{formatMdl(proof.amount)}</strong>
                  <span className="text-muted-foreground">{paymentMethodLabels[proof.method] || proof.method}</span>
                  <Badge variant={proof.status === 'ACCEPTED' || proof.status === 'PARTIALLY_ACCEPTED' ? 'success' : proof.status === 'REJECTED' ? 'error' : proof.status === 'IN_REVIEW' ? 'warning' : 'default'}>
                    {proof.status}
                  </Badge>
                  <span className="text-muted-foreground">{formatDate(proof.createdAt)}</span>
                  <div className="flex justify-end gap-2">
                    {proof.proofFileUrl ? (
                      <a className="text-sm font-semibold text-primary hover:underline" href={proof.proofFileUrl} target="_blank" rel="noreferrer">Dovadă</a>
                    ) : null}
                    <Link className="text-sm font-semibold text-primary hover:underline" href={localizedPath(`/admin/payment-proofs?search=${proof.id}`)}>Deschide</Link>
                  </div>
                </div>
              ))}
              {!(invoice.paymentProofs || []).length ? (
                <p className="rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">Nu există dovezi de plată pentru această factură.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Linii factură</h2>
            <div className="mt-4 grid gap-2">
              {invoice.lines.map((line) => (
                <div key={line.id} className="grid gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{line.name}</p>
                      {line.lineType === 'METER_CONSUMPTION' ? <Badge variant="neutral">Consum contor</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{line.description || line.formulaLabel || 'Linie factură internă'}</p>
                    {line.lineType === 'METER_CONSUMPTION' ? (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                        {line.meterReadingId ? <Link href={localizedPath(`/admin/meter-readings/${line.meterReadingId}`)} className="text-primary hover:underline">Vezi indicele</Link> : null}
                        {line.meterId ? <Link href={localizedPath(`/admin/meters/${line.meterId}`)} className="text-primary hover:underline">Vezi contorul</Link> : null}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground">{line.calculationType}</span>
                  <span className="text-muted-foreground">{line.quantity}</span>
                  <span className="text-muted-foreground">{formatMdl(line.unitPrice)}</span>
                  <strong className="text-right text-foreground">{formatMdl(line.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-4 text-right">
              <p className="text-sm text-muted-foreground">Total factură</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatMdl(invoice.totalAmount)}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-foreground">Note interne</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
              {invoice.notes || 'Nu există note interne pentru această factură.'}
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
  return new Intl.DateTimeFormat('ro-RO').format(date);
}
