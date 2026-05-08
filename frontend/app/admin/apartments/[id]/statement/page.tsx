'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  PrintActions,
  PrintableDocumentShell,
  PrintInfoGrid,
  PrintSection,
} from '@/components/print/PrintableDocument';
import { apartmentsApi } from '@/lib/api';
import {
  formatDatePrint,
  formatMdlPrint,
  invoiceStatusLabel,
  loadAdminApcOrganization,
  monthYearPrint,
  paymentMethodLabel,
  toApcOrganizationInfo,
  type ApcOrganizationInfo,
} from '@/lib/print-documents';

export default function AdminApartmentStatementPage() {
  const params = useParams<{ id: string }>();
  const apartmentId = String(params?.id || '');
  const [apartment, setApartment] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [organization, setOrganization] = useState<ApcOrganizationInfo>(toApcOrganizationInfo());
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!apartmentId) return;
    let active = true;
    Promise.all([
      apartmentsApi.get(apartmentId),
      apartmentsApi.financialSummary(apartmentId).catch(() => ({ data: null })),
      loadAdminApcOrganization(),
    ])
      .then(([apartmentRes, summaryRes, organizationInfo]) => {
        if (!active) return;
        setApartment(apartmentRes.data);
        setSummary(summaryRes.data || apartmentRes.data?.financialSummary || null);
        setOrganization(organizationInfo);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [apartmentId]);

  const residents = useMemo(() => {
    if (Array.isArray(apartment?.residents)) return apartment.residents;
    if (Array.isArray(apartment?.apartmentResidents)) {
      return apartment.apartmentResidents.map((item: any) => ({
        name: `${item.resident?.firstName || ''} ${item.resident?.lastName || ''}`.trim(),
        role: item.role,
        phone: item.resident?.phone,
      }));
    }
    return [];
  }, [apartment]);
  const invoices = Array.isArray(apartment?.invoices) ? apartment.invoices : [];
  const payments = Array.isArray(apartment?.payments) ? apartment.payments : [];

  return (
    <PrintableDocumentShell
      organization={organization}
      title="Fișă financiară apartament"
      subtitle={apartment ? `Apt. ${apartment.number}` : undefined}
    >
      <PrintActions printLabel="Printează fișa apartamentului" backHref={`/admin/apartments/${apartmentId}`} />

      {state === 'loading' ? <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">Se încarcă documentul...</p> : null}
      {state === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">Nu există date financiare pentru acest apartament.</p> : null}

      {state === 'ready' && apartment ? (
        <>
          <PrintSection title="Date apartament">
            <PrintInfoGrid
              rows={[
                ['Apartament', `Apt. ${apartment.number}`],
                ['Scara', apartment.staircase?.name || apartment.staircase || '-'],
                ['Bloc', apartment.building?.name || apartment.building || '-'],
                ['Etaj', apartment.floor ?? '-'],
                ['Suprafață', apartment.areaM2 ? `${Number(apartment.areaM2).toLocaleString('ro-MD')} m²` : '-'],
                ['Camere', apartment.rooms ?? '-'],
              ]}
            />
          </PrintSection>

          <PrintSection title="Rezumat financiar">
            <PrintInfoGrid
              rows={[
                ['Total facturat', formatMdlPrint(summary?.totalInvoiced)],
                ['Total achitat', formatMdlPrint(summary?.totalPaid)],
                ['Datorie totală', formatMdlPrint(summary?.totalDebt ?? summary?.debt)],
                ['Facturi neachitate', summary?.unpaidInvoicesCount ?? summary?.unpaidInvoices ?? 0],
                ['Facturi întârziate', summary?.overdueInvoicesCount ?? 0],
                ['Ultima plată', formatDatePrint(summary?.lastPaymentDate)],
              ]}
            />
          </PrintSection>

          <PrintSection title="Proprietari / locatari">
            {residents.length ? (
              <table className="print-table w-full border-collapse text-sm">
                <tbody>
                  {residents.map((resident: any, index: number) => (
                    <tr key={resident.id || index} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-950">{resident.name || '-'}</td>
                      <td className="py-2 pr-3 text-slate-700">{resident.role || '-'}</td>
                      <td className="py-2 text-right text-slate-700">{resident.phone || resident.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există locatari conectați la acest apartament.</p>
            )}
          </PrintSection>

          <PrintSection title="Facturi">
            {invoices.length ? (
              <table className="print-table w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Luna</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Scadență</th>
                    <th className="py-2 text-right">Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{monthYearPrint(invoice.month, invoice.year)}</td>
                      <td className="py-2 pr-3">{invoiceStatusLabel(invoice.status)}</td>
                      <td className="py-2 pr-3">{formatDatePrint(invoice.dueDate)}</td>
                      <td className="py-2 text-right">{formatMdlPrint(invoice.finalAmount ?? invoice.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există facturi pentru acest apartament.</p>
            )}
          </PrintSection>

          <PrintSection title="Istoric plăți">
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
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există plăți înregistrate.</p>
            )}
          </PrintSection>
        </>
      ) : null}
    </PrintableDocumentShell>
  );
}
