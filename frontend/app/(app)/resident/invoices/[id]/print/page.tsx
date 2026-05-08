'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  PaymentInstructions,
  PrintActions,
  PrintableDocumentShell,
  PrintInfoGrid,
  PrintSection,
} from '@/components/print/PrintableDocument';
import { residentDemoApi } from '@/lib/api';
import {
  formatDatePrint,
  formatMdlPrint,
  invoiceStatusLabel,
  loadResidentApcOrganization,
  mergePaymentInfo,
  monthYearPrint,
  paymentMethodLabel,
  toApcOrganizationInfo,
  type ApcOrganizationInfo,
} from '@/lib/print-documents';

export default function ResidentInvoicePrintPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = String(params?.id || '');
  const [invoice, setInvoice] = useState<any>(null);
  const [organization, setOrganization] = useState<ApcOrganizationInfo>(toApcOrganizationInfo());
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!invoiceId) return;
    let active = true;
    Promise.all([residentDemoApi.invoice(invoiceId), loadResidentApcOrganization()])
      .then(([invoiceRes, organizationInfo]) => {
        if (!active) return;
        setInvoice(invoiceRes.data);
        setOrganization(mergePaymentInfo(organizationInfo, invoiceRes.data?.paymentInstructions));
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [invoiceId]);

  const services = useMemo(() => (Array.isArray(invoice?.services) ? invoice.services : []), [invoice]);
  const payments = useMemo(() => (Array.isArray(invoice?.payments) ? invoice.payments : []), [invoice]);
  const amount = Number(invoice?.amount ?? invoice?.totalDue ?? 0);
  const paidAmount = Number(invoice?.paidAmount ?? payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0));
  const remainingAmount = Number(invoice?.remainingAmount ?? invoice?.remainingDebt ?? Math.max(amount - paidAmount, 0));
  const invoiceNumber = invoice?.invoiceNumber || `FAC-${invoice?.year || '----'}-${String(invoice?.month || '').padStart(2, '0')}`;
  const apartment = invoice?.apartment;

  return (
    <PrintableDocumentShell
      organization={organization}
      title="Factură"
      subtitle={invoice ? `${invoiceNumber} · ${monthYearPrint(invoice.month, invoice.year)}` : undefined}
    >
      <PrintActions printLabel="Printează factura" backHref={`/resident/invoices/${invoiceId}`} />

      {state === 'loading' ? <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">Se încarcă documentul...</p> : null}
      {state === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">Nu am putut încărca documentul.</p> : null}

      {state === 'ready' && invoice ? (
        <>
          <PrintSection title="Date factură">
            <PrintInfoGrid
              rows={[
                ['Referință factură', invoiceNumber],
                ['Status', invoiceStatusLabel(invoice.status)],
                ['Apartament', apartment?.number ? `Apt. ${apartment.number}` : invoice.apartmentNumber ? `Apt. ${invoice.apartmentNumber}` : '-'],
                ['Scara', apartment?.staircase?.name || invoice.staircase?.name || '-'],
                ['Luna', monthYearPrint(invoice.month, invoice.year)],
                ['Data emiterii', formatDatePrint(invoice.issuedAt || invoice.createdAt)],
                ['Data scadentă', formatDatePrint(invoice.dueDate)],
              ]}
            />
          </PrintSection>

          <PrintSection title="Sume">
            <PrintInfoGrid rows={[['Suma totală', formatMdlPrint(amount)], ['Achitat', formatMdlPrint(paidAmount)], ['Restant', formatMdlPrint(remainingAmount)]]} />
          </PrintSection>

          <PrintSection title="Servicii incluse">
            {services.length ? (
              <table className="print-table w-full border-collapse text-sm">
                <tbody>
                  {services.map((service: any, index: number) => (
                    <tr key={service.id || index} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-950">{service.tariffName || service.name || 'Serviciu'}</td>
                      <td className="py-2 text-right text-slate-700">{service.amount !== undefined && service.amount !== null ? formatMdlPrint(service.amount) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Detalierea serviciilor va fi disponibilă ulterior.
              </p>
            )}
          </PrintSection>

          <PrintSection title="Istoric plăți asociate">
            {payments.length ? (
              <table className="print-table w-full border-collapse text-sm">
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{formatDatePrint(payment.paidAt || payment.createdAt)}</td>
                      <td className="py-2 pr-3">{paymentMethodLabel(payment.method)}</td>
                      <td className="py-2 text-right">{formatMdlPrint(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există plăți asociate acestei facturi.</p>
            )}
          </PrintSection>

          <PrintSection title="Instrucțiuni de plată">
            <PaymentInstructions organization={organization} />
          </PrintSection>
        </>
      ) : null}
    </PrintableDocumentShell>
  );
}
