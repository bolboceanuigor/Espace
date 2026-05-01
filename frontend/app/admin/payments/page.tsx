'use client';

import { useCallback } from 'react';
import PlatiPage, { asArray, BillingInvoice } from '@/components/payments/PlatiPage';
import { invoicesApi, paymentsApi } from '@/lib/api';

export default function AdminPaymentsPage() {
  const loadInvoices = useCallback(async () => {
    const response = await invoicesApi.adminList({ limit: 50 });
    return asArray<BillingInvoice>(response.data);
  }, []);

  const loadPayments = useCallback(async () => {
    const response = await paymentsApi.adminList({ limit: 50 });
    return asArray<any>(response.data);
  }, []);

  return (
    <PlatiPage
      titleDescription="O privire clară asupra facturilor, restanțelor și plăților recente ale asociației."
      loadInvoices={loadInvoices}
      loadPayments={loadPayments}
    />
  );
}
