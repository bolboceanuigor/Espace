'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { normalizeResidentInvoice, residentInvoices, residentInvoiceStatusVariant } from '@/lib/resident-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function ResidentInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<typeof residentInvoices>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const unpaidRows = rows.filter((invoice) => invoice.status !== 'Achitat');
  const paidRows = rows.filter((invoice) => invoice.status === 'Achitat');
  const currentDebt = Number(
    financeSummary?.totalDebt ??
      unpaidRows.reduce((sum, invoice) => sum + Number(invoice.remainingAmount || invoice.amount || 0), 0),
  );
  const paymentInstructions = financeSummary?.paymentInstructions;

  useEffect(() => {
    let active = true;
    Promise.all([
      residentDemoApi.financeSummary().catch(() => ({ data: null })),
      residentDemoApi.invoices(),
    ])
      .then(([summaryRes, invoiceRes]) => {
        if (!active) return;
        const apiRows = (invoiceRes.data || []).map(normalizeResidentInvoice);
        setFinanceSummary(summaryRes.data || null);
        setRows(apiRows);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setFinanceSummary(null);
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
        description="Facturile, soldul curent și instrucțiunile de plată pentru apartamentul tău."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sold curent"
          value={formatMdl(currentDebt)}
          description={currentDebt > 0 ? 'Rest de plată' : 'Achitat'}
          icon={<ReceiptText className="h-5 w-5" />}
          tone={currentDebt > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Facturi neachitate"
          value={financeSummary?.unpaidInvoicesCount ?? unpaidRows.length}
          description="Necesită atenție"
          icon={<Clock3 className="h-5 w-5" />}
          tone={(financeSummary?.unpaidInvoicesCount ?? unpaidRows.length) > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Facturi achitate"
          value={paidRows.length}
          description="Înregistrate ca achitate"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Următoarea scadență"
          value={financeSummary?.nextDueDate ? formatDate(financeSummary.nextDueDate) : 'Nu există'}
          description="Pentru facturi deschise"
          icon={<CreditCard className="h-5 w-5" />}
          tone={financeSummary?.overdueInvoicesCount ? 'danger' : 'neutral'}
        />
      </section>

      <Card>
        <h2 className="font-semibold text-foreground">Instrucțiuni de plată</h2>
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
          Plățile online vor fi conectate ulterior.
        </p>
      </Card>

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
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={localizedPath(`/resident/invoices/${invoice.id}`)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold text-foreground transition hover:bg-muted/40"
              >
                Detalii
              </Link>
              {source === 'api' ? (
                <Link
                  href={localizedPath(`/resident/invoices/${invoice.id}/print`)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Vezi factura
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
        {!rows.length ? (
          <Card className="p-5 text-sm font-medium text-muted-foreground">
            {source === 'loading' ? 'Se încarcă datele...' : source === 'api' ? 'Nu există facturi pentru apartamentul tău.' : 'Nu există facturi încă.'}
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nu există';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 ${strong ? 'text-xl font-semibold' : 'font-semibold'} text-foreground`}>{value}</p>
    </div>
  );
}
