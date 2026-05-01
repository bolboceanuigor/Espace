'use client';

import { useEffect, useState } from 'react';
import { billingSaasApi } from '@/lib/api';

export default function AdminSubscriptionPage() {
  const [statusData, setStatusData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([billingSaasApi.getAdminSubscriptionStatus(), billingSaasApi.getAdminSubscriptionInvoices()])
      .then(([statusRes, invoicesRes]) => {
        if (!active) return;
        setStatusData(statusRes.data || null);
        setInvoices(invoicesRes.data || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading subscription...</div>;
  if (!statusData) return <div className="text-sm text-muted-foreground">No subscription found.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organization Subscription</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Status:{' '}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {statusData.status}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">Billing: {statusData.billingType}</p>
        <p className="text-sm text-muted-foreground">
          Price: {statusData.price} {statusData.currency}
        </p>
        <p className="text-sm text-muted-foreground">Outstanding amount: {statusData.outstandingAmount}</p>
        <p className="text-sm text-muted-foreground">
          Last billed at: {statusData.lastBilledAt ? new Date(statusData.lastBilledAt).toLocaleDateString() : '-'}
        </p>
        <p className="text-sm text-muted-foreground">
          Last payment at: {statusData.lastPaymentAt ? new Date(statusData.lastPaymentAt).toLocaleDateString() : '-'}
        </p>
        {statusData.status === 'TRIAL' && statusData.trialEndDate ? (
          <p className="mt-1 text-sm font-medium text-emerald-700">
            Trial active until {new Date(statusData.trialEndDate).toLocaleDateString()}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Invoices</p>
        <div className="space-y-2">
          {invoices.map((invoice: any) => (
            <div key={invoice.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground">
              {invoice.amount} {invoice.currency} - {invoice.status} ({new Date(invoice.periodStart).toLocaleDateString()} -{' '}
              {new Date(invoice.periodEnd).toLocaleDateString()})
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Payment instructions</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pentru confirmarea platii, trimite dovada catre echipa platformei sau contacteaza super admin.
        </p>
      </div>
    </div>
  );
}
