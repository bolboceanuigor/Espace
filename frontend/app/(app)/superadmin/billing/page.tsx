'use client';

import { useEffect, useState } from 'react';
import { billingSaasApi, superadminApi } from '@/lib/api';

export default function SuperadminBillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDraft, setPaymentDraft] = useState({
    organizationId: '',
    invoiceId: '',
    amount: '',
    currency: 'MDL' as 'MDL' | 'EUR' | 'USD',
    method: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER',
    status: 'CONFIRMED' as 'PENDING' | 'CONFIRMED' | 'FAILED',
    note: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, payRes, orgRes] = await Promise.all([
        billingSaasApi.superadminBillingInvoices(),
        billingSaasApi.superadminBillingPayments(),
        superadminApi.listOrgs(),
      ]);
      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
      setOrgs(orgRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Billing SaaS</h1>
        <button
          className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground"
          onClick={async () => {
            await billingSaasApi.superadminGenerateBilling();
            await load();
          }}
        >
          Generate monthly invoices
        </button>
      </div>

      <section className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">Add payment</h2>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={paymentDraft.organizationId}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, organizationId: e.target.value }))}
          >
            <option value="">Organization</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Invoice ID (optional)"
            value={paymentDraft.invoiceId}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, invoiceId: e.target.value }))}
          />
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Amount"
            value={paymentDraft.amount}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, amount: e.target.value }))}
          />
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={paymentDraft.currency}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, currency: e.target.value as any }))}
          >
            <option value="MDL">MDL</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={paymentDraft.method}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, method: e.target.value as any }))}
          >
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="CARD">CARD</option>
            <option value="CASH">CASH</option>
            <option value="OTHER">OTHER</option>
          </select>
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={paymentDraft.status}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, status: e.target.value as any }))}
          >
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>
          <input
            className="h-10 rounded-md border border-border bg-background px-3 text-sm md:col-span-2"
            placeholder="Note"
            value={paymentDraft.note}
            onChange={(e) => setPaymentDraft((p) => ({ ...p, note: e.target.value }))}
          />
          <button
            className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground"
            onClick={async () => {
              await billingSaasApi.superadminCreateBillingPayment({
                organizationId: paymentDraft.organizationId,
                invoiceId: paymentDraft.invoiceId || undefined,
                amount: Number(paymentDraft.amount || 0),
                currency: paymentDraft.currency,
                method: paymentDraft.method,
                status: paymentDraft.status,
                note: paymentDraft.note || undefined,
              });
              setPaymentDraft({
                organizationId: '',
                invoiceId: '',
                amount: '',
                currency: 'MDL',
                method: 'BANK_TRANSFER',
                status: 'CONFIRMED',
                note: '',
              });
              await load();
            }}
          >
            Save payment
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Invoices</h2>
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
              <span>
                {invoice.organization?.name} · {invoice.amount} {invoice.currency} · {invoice.status}
              </span>
              <button
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={async () => {
                  await billingSaasApi.superadminMarkBillingInvoicePaid(invoice.id);
                  await load();
                }}
              >
                Mark paid
              </button>
            </div>
          ))}
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Payments</h2>
        <div className="space-y-2">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
              {payment.organization?.name} · {payment.amount} {payment.currency} · {payment.method} · {payment.status}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

