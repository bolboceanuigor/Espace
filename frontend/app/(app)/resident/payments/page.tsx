'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { organizationSettingsApi, residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import {
  normalizeResidentInvoice,
  normalizeResidentPayment,
  residentInvoices,
  residentInvoiceStatusVariant,
  residentPayments,
  residentProfile,
  type ResidentInvoiceStatus,
  type ResidentPayment,
} from '@/lib/resident-mvp-data';

export default function ResidentPaymentsPage() {
  const [filter, setFilter] = useState<'Toate' | ResidentInvoiceStatus>('Toate');
  const [rows, setRows] = useState<typeof residentInvoices>([]);
  const [payments, setPayments] = useState<ResidentPayment[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [organizationPaymentInfo, setOrganizationPaymentInfo] = useState<any>(null);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const visible = useMemo(() => rows.filter((invoice) => filter === 'Toate' || invoice.status === filter), [filter, rows]);
  const paidThisYear = payments.length ? payments.reduce((sum, payment) => sum + payment.amount, 0) : rows.filter((invoice) => invoice.status === 'Achitat').reduce((sum, invoice) => sum + invoice.amount, 0);
  const unpaidCount = rows.filter((invoice) => invoice.status !== 'Achitat').length;
  const currentBalance = rows.filter((invoice) => invoice.status !== 'Achitat').reduce((sum, invoice) => sum + (invoice.remainingAmount || invoice.amount), 0);
  const summaryDebt = Number(financeSummary?.totalDebt ?? currentBalance);
  const summaryPaidThisYear = Number(financeSummary?.totalPaidThisYear ?? paidThisYear);
  const summaryUnpaidCount = Number(financeSummary?.unpaidInvoicesCount ?? unpaidCount);
  const paymentInstructions = financeSummary?.paymentInstructions || organizationPaymentInfo;

  useEffect(() => {
    let active = true;
    Promise.all([
      residentDemoApi.financeSummary().catch(() => ({ data: null })),
      residentDemoApi.invoices(),
      residentDemoApi.payments().catch(() => ({ data: [] })),
      organizationSettingsApi.residentPublicInfo().catch(() => ({ data: null })),
    ])
      .then(([summaryRes, invoiceRes, paymentRes, paymentInfoRes]) => {
        if (!active) return;
        const invoiceItems = Array.isArray(invoiceRes.data) ? invoiceRes.data : invoiceRes.data?.items || [];
        const apiRows = invoiceItems.map(normalizeResidentInvoice);
        const apiPayments = (paymentRes.data || []).map(normalizeResidentPayment);
        setFinanceSummary(summaryRes.data || null);
        setOrganizationPaymentInfo(toPaymentInfo(paymentInfoRes.data));
        setRows(apiRows);
        setPayments(apiPayments);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setRows(residentInvoices);
        setPayments(residentPayments);
        setFinanceSummary(null);
        setOrganizationPaymentInfo(null);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Plăți"
        description="Soldul și istoricul plăților pentru apartamentul tău."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sold curent" value={formatMdl(summaryDebt || (source === 'mock' ? residentProfile.currentBalance : 0))} description={summaryDebt > 0 ? 'Datorie curentă' : source === 'mock' ? residentProfile.status : 'Achitat'} icon={<ReceiptText className="h-5 w-5" />} tone={summaryDebt > 0 ? 'danger' : 'success'} />
        <StatCard label="Total achitat anul acesta" value={formatMdl(summaryPaidThisYear)} description="Plăți confirmate" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Facturi neachitate" value={summaryUnpaidCount} description="Necesită atenție" icon={<Clock3 className="h-5 w-5" />} tone={summaryUnpaidCount > 0 ? 'warning' : 'success'} />
        <StatCard label="Următoarea scadență" value={financeSummary?.nextDueDate ? formatDate(financeSummary.nextDueDate) : 'Nu există'} description="Pentru facturi deschise" icon={<CreditCard className="h-5 w-5" />} tone={financeSummary?.overdueInvoicesCount ? 'danger' : 'neutral'} />
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Cum poți achita</h2>
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
        <p className="mt-3 rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm font-medium text-muted-foreground">
          Plățile online vor fi conectate ulterior. Pentru moment, plata se înregistrează de administratorul A.P.C.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
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
                {invoice.remainingAmount > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-rose-600">Rest de plată: {formatMdl(invoice.remainingAmount)}</p>
                ) : null}
              </div>
              <p className="text-right text-xs text-muted-foreground">Scadență: {invoice.dueDate}</p>
            </div>
            {invoice.status !== 'Achitat' ? (
              <button
                type="button"
                disabled
                className="mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-border/70 bg-muted/35 px-4 text-sm font-semibold text-muted-foreground"
              >
                <CreditCard className="h-4 w-4" />
                Plățile online vor fi conectate ulterior
              </button>
            ) : (
              <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">Achitat pe {invoice.paidDate}</p>
            )}
          </Card>
        ))}
        {!visible.length ? (
          <Card className="p-5 text-sm font-medium text-muted-foreground">
            {source === 'loading' ? 'Se încarcă datele...' : source === 'api' ? 'Nu există facturi pentru apartamentul tău.' : 'Nu există facturi încă.'}
          </Card>
        ) : null}
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Istoric plăți</h2>
        <div className="mt-4 grid gap-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">{formatMdl(payment.amount)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {payment.method}{payment.invoiceLabel ? ` · ${payment.invoiceLabel}` : ''}
                </p>
              </div>
              <p className="text-right text-xs text-muted-foreground">{payment.paidAt}</p>
            </div>
          ))}
          {!payments.length ? (
            <p className="rounded-2xl bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
              {source === 'loading' ? 'Se încarcă datele...' : 'Nu există plăți înregistrate.'}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function toPaymentInfo(row: any) {
  if (!row) return null;
  const configured = Boolean(row.bankName || row.bankAccountIban || row.bankSwift || row.paymentInstructions);
  return {
    configured,
    bankName: row.bankName || '',
    bankAccountIban: row.bankAccountIban || '',
    bankSwift: row.bankSwift || '',
    paymentInstructions: row.paymentInstructions || '',
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}
