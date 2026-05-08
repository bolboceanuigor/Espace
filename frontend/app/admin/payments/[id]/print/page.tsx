'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  PrintActions,
  PrintableDocumentShell,
  PrintInfoGrid,
  PrintSection,
} from '@/components/print/PrintableDocument';
import { paymentsApi } from '@/lib/api';
import {
  formatDatePrint,
  formatMdlPrint,
  loadAdminApcOrganization,
  paymentMethodLabel,
  toApcOrganizationInfo,
  type ApcOrganizationInfo,
} from '@/lib/print-documents';

export default function AdminPaymentPrintPage() {
  const params = useParams<{ id: string }>();
  const paymentId = String(params?.id || '');
  const [payment, setPayment] = useState<any>(null);
  const [organization, setOrganization] = useState<ApcOrganizationInfo>(toApcOrganizationInfo());
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    Promise.all([paymentsApi.get(paymentId), loadAdminApcOrganization()])
      .then(([paymentRes, organizationInfo]) => {
        if (!active) return;
        setPayment(paymentRes.data);
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
  }, [paymentId]);

  const apartment = payment?.apartment;
  const invoice = payment?.invoice;

  return (
    <PrintableDocumentShell organization={organization} title="Confirmare plată" subtitle={payment ? `Plată ${payment.id}` : undefined}>
      <PrintActions printLabel="Printează confirmarea" backHref="/admin/payments" />

      {state === 'loading' ? <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">Se încarcă documentul...</p> : null}
      {state === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">Plata nu a fost găsită.</p> : null}

      {state === 'ready' && payment ? (
        <>
          <PrintSection title="Date plată">
            <PrintInfoGrid
              rows={[
                ['Referință plată', payment.id],
                ['Apartament', apartment?.number ? `Apt. ${apartment.number}` : payment.apartmentNumber ? `Apt. ${payment.apartmentNumber}` : '-'],
                ['Scara', apartment?.staircase?.name || '-'],
                ['Bloc', apartment?.building?.name || '-'],
                ['Suma', formatMdlPrint(payment.amount)],
                ['Metodă', paymentMethodLabel(payment.method)],
                ['Data plății', formatDatePrint(payment.paidAt || payment.createdAt)],
                ['Factură asociată', invoice?.invoiceNumber || payment.invoiceId || '-'],
              ]}
            />
          </PrintSection>

          <PrintSection title="Confirmare">
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Confirmare de plată înregistrată în sistem.
            </p>
          </PrintSection>
        </>
      ) : null}
    </PrintableDocumentShell>
  );
}
