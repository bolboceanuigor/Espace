'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, FileText } from 'lucide-react';
import {
  PaymentInstructions,
  PrintActions,
  PrintableDocumentShell,
  PrintInfoGrid,
  PrintSection,
} from '@/components/print/PrintableDocument';
import { billingSaasApi, invoicesApi, metersApi, paymentsApi, reportsApi } from '@/lib/api';
import {
  formatDatePrint,
  formatMdlPrint,
  monthYearPrint,
  paymentMethodLabel,
  toApcOrganizationInfo,
} from '@/lib/print-documents';
import { useLocalizedPath } from '@/lib/use-localized-path';

type LoadState = 'loading' | 'ready' | 'error';
type Audience = 'admin' | 'resident' | 'superadmin';

const statusLabels: Record<string, string> = {
  ISSUED: 'Emisă',
  UNPAID: 'Neachitată',
  PARTIALLY_PAID: 'Parțial achitată',
  PAID: 'Achitată',
  OVERDUE: 'Întârziată',
  CANCELLED: 'Anulată',
  VOID: 'Void',
  CONFIRMED: 'Confirmată',
  PENDING: 'În așteptare',
};

function useDocument(loader: () => Promise<any>, deps: unknown[]) {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    setState('loading');
    loader()
      .then((res) => {
        if (!active) return;
        setData(res.data ?? res);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
      });
    return () => {
      active = false;
    };
    // Caller-provided keys intentionally control document reloads for route params and query strings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, state };
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = String(status || '').toUpperCase();
  const palette =
    value === 'PAID' || value === 'CONFIRMED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value === 'OVERDUE' || value === 'CANCELLED' || value === 'VOID'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${palette}`}>{statusLabels[value] || value || '-'}</span>;
}

function Watermark({ status }: { status?: string | null }) {
  const value = String(status || '').toUpperCase();
  const label = value === 'CANCELLED' ? 'ANULATĂ' : value === 'VOID' ? 'VOID' : value === 'PAID' ? 'ACHITATĂ' : '';
  if (!label) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden print:fixed">
      <div className="-rotate-12 text-7xl font-black uppercase tracking-widest text-slate-900/5 print:text-slate-900/10">{label}</div>
    </div>
  );
}

function LoadingOrError({ state, errorText }: { state: LoadState; errorText: string }) {
  if (state === 'loading') return <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">Se încarcă documentul...</p>;
  if (state === 'error') return <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{errorText}</p>;
  return null;
}

function LinesTable({ lines }: { lines: any[] }) {
  if (!lines?.length) {
    return <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există linii de document.</p>;
  }
  return (
    <table className="print-table w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-3">Descriere</th>
          <th className="py-2 pr-3 text-right">Cant.</th>
          <th className="py-2 pr-3 text-right">Preț</th>
          <th className="py-2 text-right">Sumă</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={line.id || index} className="border-b border-slate-100">
            <td className="py-2 pr-3">
              <p className="font-semibold text-slate-950">{line.name || 'Linie document'}</p>
              {line.description ? <p className="text-xs text-slate-500">{line.description}</p> : null}
              {line.formulaLabel ? <p className="text-xs text-slate-500">{line.formulaLabel}</p> : null}
            </td>
            <td className="py-2 pr-3 text-right">{line.quantity ?? 1}</td>
            <td className="py-2 pr-3 text-right">{formatMdlPrint(line.unitPrice || 0)}</td>
            <td className="py-2 text-right font-semibold">{formatMdlPrint(line.amount || 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentsTable({ payments }: { payments: any[] }) {
  if (!payments?.length) return null;
  return (
    <PrintSection title="Plăți asociate">
      <table className="print-table w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">Data</th>
            <th className="py-2 pr-3">Metodă</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 text-right">Suma</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-slate-100">
              <td className="py-2 pr-3">{formatDatePrint(payment.paymentDate)}</td>
              <td className="py-2 pr-3">{paymentMethodLabel(payment.method)}</td>
              <td className="py-2 pr-3"><StatusBadge status={payment.status} /></td>
              <td className="py-2 text-right font-semibold">{formatMdlPrint(payment.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintSection>
  );
}

function InvoiceDocument({ data, backHref }: { data: any; backHref: string }) {
  const invoice = data.invoice || {};
  const apartment = invoice.apartment || {};
  const resident = invoice.resident || {};
  return (
    <PrintableDocumentShell organization={toApcOrganizationInfo(data.association)} title="Factură internă" subtitle={invoice.invoiceNumber}>
      <div className="relative">
        <Watermark status={invoice.status} />
        <PrintActions printLabel="Print / Save as PDF" backHref={backHref} />
        <PrintSection title="Date factură">
          <PrintInfoGrid
            rows={[
              ['Număr factură', invoice.invoiceNumber || invoice.id],
              ['Status', <StatusBadge key="status" status={invoice.status} />],
              ['Perioadă', invoice.billingMonth || monthYearPrint(invoice.month, invoice.year)],
              ['Data emiterii', formatDatePrint(invoice.issueDate)],
              ['Scadență', formatDatePrint(invoice.dueDate)],
              ['Apartament', apartment.apartmentNumber ? `Apt. ${apartment.apartmentNumber}` : '-'],
              ['Scara / Bloc', [apartment.staircase, apartment.building].filter(Boolean).join(' / ') || '-'],
              ['Locatar', resident.fullName || '-'],
            ]}
          />
        </PrintSection>
        <PrintSection title="Linii factură"><LinesTable lines={data.lines || []} /></PrintSection>
        <PrintSection title="Totaluri">
          <PrintInfoGrid
            rows={[
              ['Subtotal', formatMdlPrint(invoice.subtotalAmount)],
              ['Total', formatMdlPrint(invoice.totalAmount)],
              ['Achitat', formatMdlPrint(invoice.paidAmount)],
              ['Sold', formatMdlPrint(invoice.balanceAmount)],
            ]}
          />
        </PrintSection>
        {invoice.notes ? <PrintSection title="Note"><p className="text-sm text-slate-700">{invoice.notes}</p></PrintSection> : null}
        <PrintSection title="Instrucțiuni de plată"><PaymentInstructions organization={toApcOrganizationInfo(data.association)} /></PrintSection>
        <PaymentsTable payments={data.payments || []} />
      </div>
    </PrintableDocumentShell>
  );
}

function ReceiptDocument({ data, backHref }: { data: any; backHref: string }) {
  const receipt = data.receipt || {};
  const invoice = data.invoice || {};
  return (
    <PrintableDocumentShell organization={toApcOrganizationInfo(data.association)} title="Confirmare plată" subtitle={receipt.paymentNumber}>
      <div className="relative">
        <Watermark status={receipt.status} />
        <PrintActions printLabel="Print / Save as PDF" backHref={backHref} />
        <PrintSection title="Date plată">
          <PrintInfoGrid
            rows={[
              ['Referință plată', receipt.paymentNumber || receipt.id],
              ['Status', <StatusBadge key="status" status={receipt.status} />],
              ['Data plății', formatDatePrint(receipt.paymentDate)],
              ['Suma', formatMdlPrint(receipt.amount)],
              ['Metodă', paymentMethodLabel(receipt.method)],
              ['Referință externă', receipt.referenceNumber || '-'],
              ['Plătitor', receipt.payerName || invoice.resident?.fullName || '-'],
              ['Factură asociată', invoice.invoiceNumber || '-'],
            ]}
          />
        </PrintSection>
        <PrintSection title="Confirmare">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Aceasta este o confirmare de înregistrare a plății în Espace. Nu reprezintă chitanță fiscală.
          </p>
        </PrintSection>
        {receipt.cancellationReason ? <PrintSection title="Motiv anulare"><p className="text-sm text-slate-700">{receipt.cancellationReason}</p></PrintSection> : null}
      </div>
    </PrintableDocumentShell>
  );
}

function SaasInvoiceDocument({ data, backHref }: { data: any; backHref: string }) {
  const invoice = data.invoice || {};
  const org = toApcOrganizationInfo({ name: data.seller?.name || 'Espace', legalName: 'Espace', email: data.seller?.email, country: 'Republica Moldova' });
  return (
    <PrintableDocumentShell organization={org} title={data.title || 'Factură abonament Espace'} subtitle={invoice.invoiceNumber}>
      <div className="relative">
        <Watermark status={invoice.status} />
        <PrintActions printLabel="Print / Save as PDF" backHref={backHref} />
        <PrintSection title="Client APC">
          <PrintInfoGrid
            rows={[
              ['Asociație', data.association?.legalName || data.association?.shortName],
              ['Cod APC', data.association?.associationCode || '-'],
              ['Adresă', [data.association?.address, data.association?.city].filter(Boolean).join(', ') || '-'],
              ['Plan', data.plan ? `${data.plan.name} (${data.plan.code})` : '-'],
            ]}
          />
        </PrintSection>
        <PrintSection title="Date factură">
          <PrintInfoGrid
            rows={[
              ['Număr factură', invoice.invoiceNumber],
              ['Status', <StatusBadge key="status" status={invoice.status} />],
              ['Perioadă', `${formatDatePrint(invoice.billingPeriodStart)} - ${formatDatePrint(invoice.billingPeriodEnd)}`],
              ['Data emiterii', formatDatePrint(invoice.issueDate)],
              ['Scadență', formatDatePrint(invoice.dueDate)],
              ['Abonament', data.subscription?.billingCycle || '-'],
            ]}
          />
        </PrintSection>
        <PrintSection title="Linii factură"><LinesTable lines={data.lines || []} /></PrintSection>
        <PrintSection title="Totaluri">
          <PrintInfoGrid
            rows={[
              ['Subtotal', formatMdlPrint(invoice.subtotalAmount)],
              ['Discount', formatMdlPrint(invoice.discountAmount)],
              ['Taxe', formatMdlPrint(invoice.taxAmount)],
              ['Total', formatMdlPrint(invoice.totalAmount)],
              ['Achitat', formatMdlPrint(invoice.paidAmount)],
              ['Sold', formatMdlPrint(invoice.balanceAmount)],
            ]}
          />
        </PrintSection>
        {invoice.notes ? <PrintSection title="Note"><p className="text-sm text-slate-700">{invoice.notes}</p></PrintSection> : null}
      </div>
    </PrintableDocumentShell>
  );
}

function FinancialReportDocument({ data }: { data: any }) {
  return (
    <PrintableDocumentShell organization={toApcOrganizationInfo(data.association)} title="Raport financiar lunar" subtitle={data.period?.billingMonth || undefined}>
      <PrintActions printLabel="Print / Save as PDF" backHref="/admin/reports/financial" />
      <PrintSection title="Sumar">
        <PrintInfoGrid
          rows={[
            ['Total facturat', formatMdlPrint(data.summary?.totalInvoiced)],
            ['Total încasat', formatMdlPrint(data.summary?.totalPaid)],
            ['Sold restant', formatMdlPrint(data.summary?.outstandingBalance)],
            ['Rata colectare', `${data.summary?.collectionRate || 0}%`],
            ['Facturi', data.summary?.invoicesCount || 0],
            ['Plăți confirmate', data.summary?.confirmedPayments || 0],
          ]}
        />
      </PrintSection>
      <PrintSection title="Facturi pe status"><SimpleRows rows={data.statusBreakdown || []} columns={['status', 'count', 'totalAmount']} /></PrintSection>
      <PrintSection title="Top solduri restante"><SimpleRows rows={data.topOutstanding || []} columns={['invoiceNumber', 'billingMonth', 'status', 'balanceAmount']} moneyColumns={['balanceAmount']} /></PrintSection>
      <PrintSection title="Plăți recente"><SimpleRows rows={data.recentPayments || []} columns={['paymentDate', 'method', 'status', 'amount']} moneyColumns={['amount']} /></PrintSection>
    </PrintableDocumentShell>
  );
}

function MeterReportDocument({ data }: { data: any }) {
  return (
    <PrintableDocumentShell organization={toApcOrganizationInfo(data.association)} title="Raport consum contoare" subtitle={data.periodMonth}>
      <PrintActions printLabel="Print / Save as PDF" backHref="/admin/meter-readings/reports" />
      <PrintSection title="Sumar">
        <PrintInfoGrid
          rows={[
            ['Indici total', data.summary?.readingsCount || 0],
            ['Indici aprobați', data.summary?.approvedReadingsCount || 0],
            ['Indici trimiși', data.summary?.submittedReadingsCount || 0],
            ['Indici respinși', data.summary?.rejectedReadingsCount || 0],
            ['Apartamente fără indici', data.summary?.missingApartmentsCount || 0],
          ]}
        />
      </PrintSection>
      <PrintSection title="Consum pe tip contor"><SimpleRows rows={data.consumptionByType || []} columns={['key', 'value', 'unit', 'readingsCount']} /></PrintSection>
      <PrintSection title="Consum pe scară"><SimpleRows rows={data.consumptionByStaircase || []} columns={['key', 'value', 'unit', 'readingsCount']} /></PrintSection>
      <PrintSection title="Apartamente fără indici"><SimpleRows rows={data.missingApartments || []} columns={['apartment.apartmentNumber', 'apartment.staircase', 'missingMetersCount', 'meterTypes']} /></PrintSection>
      <PrintSection title="Indici cu probleme"><SimpleRows rows={data.issueReadings || []} columns={['apartment.apartmentNumber', 'meterType', 'status', 'reason']} /></PrintSection>
    </PrintableDocumentShell>
  );
}

function SimpleRows({ rows, columns, moneyColumns = [] }: { rows: any[]; columns: string[]; moneyColumns?: string[] }) {
  if (!rows.length) return <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există date.</p>;
  const valueAt = (row: any, column: string) => column.split('.').reduce((acc, key) => acc?.[key], row);
  return (
    <table className="print-table w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          {columns.map((column) => <th key={column} className="py-2 pr-3">{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id || index} className="border-b border-slate-100">
            {columns.map((column) => {
              const value = valueAt(row, column);
              return <td key={column} className="py-2 pr-3">{moneyColumns.includes(column) ? formatMdlPrint(value) : Array.isArray(value) ? value.join(', ') : String(value ?? '-')}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InvoicePrintPage({ id, audience }: { id: string; audience: Audience }) {
  const loader = () => (audience === 'resident' ? invoicesApi.residentDocument(id) : invoicesApi.adminDocument(id));
  const { data, state } = useDocument(loader, [id, audience]);
  const backHref = audience === 'resident' ? `/resident/invoices/${id}` : `/admin/invoices/${id}`;
  if (state !== 'ready') return <PrintableDocumentShell organization={toApcOrganizationInfo()} title="Factură internă"><LoadingOrError state={state} errorText="Documentul nu a fost găsit." /></PrintableDocumentShell>;
  return <InvoiceDocument data={data} backHref={backHref} />;
}

export function PaymentReceiptPrintPage({ id, audience }: { id: string; audience: Audience }) {
  const loader = () => (audience === 'resident' ? paymentsApi.residentReceiptDocument(id) : paymentsApi.adminReceiptDocument(id));
  const { data, state } = useDocument(loader, [id, audience]);
  const backHref = audience === 'resident' ? `/resident/payments/${id}` : `/admin/payments/${id}`;
  if (state !== 'ready') return <PrintableDocumentShell organization={toApcOrganizationInfo()} title="Confirmare plată"><LoadingOrError state={state} errorText="Documentul nu a fost găsit." /></PrintableDocumentShell>;
  return <ReceiptDocument data={data} backHref={backHref} />;
}

export function SaasInvoicePrintPage({ id, audience, receipt = false }: { id: string; audience: 'admin' | 'superadmin'; receipt?: boolean }) {
  const loader = () => {
    if (receipt) return billingSaasApi.getSaasInvoiceReceiptDocument(id);
    return audience === 'admin' ? billingSaasApi.getAdminSaasInvoiceDocument(id) : billingSaasApi.getSaasInvoiceDocument(id);
  };
  const { data, state } = useDocument(loader, [id, audience, receipt]);
  const backHref = audience === 'admin' ? `/admin/subscription/invoices/${id}` : `/superadmin/billing/saas-invoices/${id}`;
  if (state !== 'ready') return <PrintableDocumentShell organization={toApcOrganizationInfo({ name: 'Espace' })} title={receipt ? 'Confirmare plată' : 'Factură abonament Espace'}><LoadingOrError state={state} errorText="Documentul nu a fost găsit." /></PrintableDocumentShell>;
  return receipt ? <ReceiptDocument data={{ ...data, association: data.association || { name: 'Espace' } }} backHref={backHref} /> : <SaasInvoiceDocument data={data} backHref={backHref} />;
}

export function FinancialReportPrintPage() {
  const searchParams = useSearchParams();
  const params = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const { data, state } = useDocument(() => reportsApi.adminFinancialMonthlyDocument(params), [JSON.stringify(params)]);
  if (state !== 'ready') return <PrintableDocumentShell organization={toApcOrganizationInfo()} title="Raport financiar lunar"><LoadingOrError state={state} errorText="Raportul nu a putut fi generat." /></PrintableDocumentShell>;
  return <FinancialReportDocument data={data} />;
}

export function MeterConsumptionReportPrintPage() {
  const searchParams = useSearchParams();
  const params = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const { data, state } = useDocument(() => metersApi.adminConsumptionDocument(params), [JSON.stringify(params)]);
  if (state !== 'ready') return <PrintableDocumentShell organization={toApcOrganizationInfo()} title="Raport consum contoare"><LoadingOrError state={state} errorText="Raportul nu a putut fi generat." /></PrintableDocumentShell>;
  return <MeterReportDocument data={data} />;
}

export function PdfFallbackPage({ loader }: { loader: () => Promise<any> }) {
  const localizedPath = useLocalizedPath();
  const { data, state } = useDocument(loader, []);
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FileText className="h-8 w-8 text-slate-700" />
        <h1 className="mt-4 text-2xl font-bold text-slate-950">PDF direct indisponibil</h1>
        <p className="mt-2 text-sm text-slate-600">
          {state === 'loading' ? 'Verificăm documentul...' : data?.message || 'Folosește pagina print pentru Save as PDF.'}
        </p>
        {data?.printUrl ? (
          <Link href={localizedPath(data.printUrl.replace(/^\/ro/, ''))} className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            <Download className="h-4 w-4" />
            Deschide print preview
          </Link>
        ) : null}
      </div>
    </div>
  );
}
