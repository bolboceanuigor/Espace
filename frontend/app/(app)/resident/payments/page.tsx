'use client';

import { useCallback } from 'react';
import PlatiPage, { BillingInvoice } from '@/components/payments/PlatiPage';
import { invoicesApi, paymentsApi } from '@/lib/api';

export default function ResidentPaymentsPage() {
  const loadInvoices = useCallback(async () => {
    const response = await invoicesApi.residentList();
    return (response.data || []) as BillingInvoice[];
  }, []);

  const loadPayments = useCallback(async () => {
    const response = await paymentsApi.residentList();
    return response.data || [];
  }, []);

  return (
    <PlatiPage
      titleDescription="Facturile, statusul plăților și restanțele tale, într-un format simplu de urmărit."
      loadInvoices={loadInvoices}
      loadPayments={loadPayments}
    />
  );
}
