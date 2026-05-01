'use client';

import { useEffect, useState } from 'react';
import { organizationSettingsApi, paymentsApi, invoicesApi } from '@/lib/api';

export default function ResidentNewPaymentPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [providers, setProviders] = useState<Array<{ provider: 'MAIB' | 'PAYNET' | 'OPLATA' | 'MANUAL_BANK_TRANSFER' | 'CASH'; isTestMode: boolean }>>([]);
  const [bankInfo, setBankInfo] = useState<{ iban?: string | null; instructions?: string | null }>({});
  const [form, setForm] = useState({
    apartmentId: '',
    invoiceId: '',
    amount: '',
    provider: 'MAIB' as 'MAIB' | 'PAYNET' | 'OPLATA' | 'MANUAL_BANK_TRANSFER' | 'CASH',
  });
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    invoicesApi.residentList().then((res) => {
      setInvoices(res.data || []);
      const first = res.data?.[0];
      if (first) setForm((p) => ({ ...p, apartmentId: first.apartmentId, invoiceId: first.id, amount: String(first.totalDue || '') }));
    }).catch(() => undefined);
    paymentsApi.residentProviderList().then((res) => {
      const rows = res.data || [];
      setProviders(rows);
      if (rows[0]?.provider) setForm((prev) => ({ ...prev, provider: rows[0].provider }));
    }).catch(() => undefined);
    organizationSettingsApi.residentPublicInfo().then((res) => {
      setBankInfo({
        iban: res.data?.bankAccountIban,
        instructions: res.data?.paymentInstructions,
      });
    }).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Create Payment Intent</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <select className="select" value={form.invoiceId} onChange={(e) => {
            const invoice = invoices.find((i) => i.id === e.target.value);
            setForm((p) => ({ ...p, invoiceId: e.target.value, apartmentId: invoice?.apartmentId || '', amount: String(invoice?.totalDue || p.amount) }));
          }}>
            <option value="">Select invoice</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} - due {i.totalDue}</option>)}
          </select>
          <input className="input" type="number" min={0.01} step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          <select className="select" value={form.provider} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value as any }))}>
            {providers.map((row) => <option key={row.provider} value={row.provider}>{row.provider}</option>)}
          </select>
        </div>
        {providers.length === 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Nu exista metode de plata activate pentru asociatia ta.
          </div>
        ) : null}
        {['MAIB', 'PAYNET', 'OPLATA'].includes(form.provider) ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Aceasta metoda de plata va fi disponibila in curand.
          </div>
        ) : null}
        {form.provider === 'MANUAL_BANK_TRANSFER' ? (
          <div className="mt-3 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
            IBAN: {bankInfo.iban || '-'}<br />
            Instructiuni: {bankInfo.instructions || '-'}
          </div>
        ) : null}
        <button
          className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          disabled={providers.length === 0}
          onClick={async () => {
            const res = await paymentsApi.residentCreateIntent({
              apartmentId: form.apartmentId,
              invoiceId: form.invoiceId || undefined,
              amount: Number(form.amount),
              provider: form.provider,
            });
            setResult(res.data);
          }}
        >
          Create intent
        </button>
      </div>
      {result ? (
        <div className="rounded-xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">
          Intent status: {result.status} • {result.message || 'Created'}
        </div>
      ) : null}
    </div>
  );
}
