'use client';

import { useEffect, useState } from 'react';
import { organizationSettingsApi } from '@/lib/api';

type OrgSettingsForm = {
  name: string;
  legalName: string;
  fiscalCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccountIban: string;
  bankSwift: string;
  paymentInstructions: string;
  treasurerName: string;
  administratorName: string;
  logoUrl: string;
  primaryColor: string;
  invoicePrefix: string;
  receiptPrefix: string;
  defaultCurrency: 'MDL' | 'EUR' | 'USD';
};

const INITIAL_FORM: OrgSettingsForm = {
  name: '',
  legalName: '',
  fiscalCode: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  bankName: '',
  bankAccountIban: '',
  bankSwift: '',
  paymentInstructions: '',
  treasurerName: '',
  administratorName: '',
  logoUrl: '',
  primaryColor: '#2563eb',
  invoicePrefix: 'INV',
  receiptPrefix: 'RCPT',
  defaultCurrency: 'MDL',
};

export default function AdminOrganizationSettingsPage() {
  const [form, setForm] = useState<OrgSettingsForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    organizationSettingsApi
      .adminGet()
      .then((res) => {
        const data = res.data;
        setForm({
          name: data?.name || '',
          legalName: data?.legalName || '',
          fiscalCode: data?.fiscalCode || '',
          address: data?.address || '',
          phone: data?.phone || '',
          email: data?.email || '',
          website: data?.website || '',
          bankName: data?.bankName || '',
          bankAccountIban: data?.bankAccountIban || '',
          bankSwift: data?.bankSwift || '',
          paymentInstructions: data?.paymentInstructions || '',
          treasurerName: data?.treasurerName || '',
          administratorName: data?.administratorName || '',
          logoUrl: data?.logoUrl || '',
          primaryColor: data?.primaryColor || '#2563eb',
          invoicePrefix: data?.invoicePrefix || 'INV',
          receiptPrefix: data?.receiptPrefix || 'RCPT',
          defaultCurrency: (data?.defaultCurrency || 'MDL') as 'MDL' | 'EUR' | 'USD',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const updateField = <K extends keyof OrgSettingsForm>(key: K, value: OrgSettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await organizationSettingsApi.adminUpdate({
        ...form,
        primaryColor: form.primaryColor || null,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-foreground">Organization settings</h1>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">General information</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="input" placeholder="Association name" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
          <input className="input" placeholder="Legal name" value={form.legalName} onChange={(e) => updateField('legalName', e.target.value)} />
          <input className="input" placeholder="Fiscal code" value={form.fiscalCode} onChange={(e) => updateField('fiscalCode', e.target.value)} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
          <input className="input md:col-span-2" placeholder="Website" value={form.website} onChange={(e) => updateField('website', e.target.value)} />
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Banking details</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="input" placeholder="Bank name" value={form.bankName} onChange={(e) => updateField('bankName', e.target.value)} />
          <input className="input" placeholder="IBAN" value={form.bankAccountIban} onChange={(e) => updateField('bankAccountIban', e.target.value)} />
          <input className="input" placeholder="SWIFT" value={form.bankSwift} onChange={(e) => updateField('bankSwift', e.target.value)} />
          <input
            className="input md:col-span-2"
            placeholder="Payment instructions"
            value={form.paymentInstructions}
            onChange={(e) => updateField('paymentInstructions', e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Responsible persons</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className="input"
            placeholder="Administrator name"
            value={form.administratorName}
            onChange={(e) => updateField('administratorName', e.target.value)}
          />
          <input className="input" placeholder="Treasurer name" value={form.treasurerName} onChange={(e) => updateField('treasurerName', e.target.value)} />
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Documents settings</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input className="input" placeholder="Invoice prefix" value={form.invoicePrefix} onChange={(e) => updateField('invoicePrefix', e.target.value)} />
          <input className="input" placeholder="Receipt prefix" value={form.receiptPrefix} onChange={(e) => updateField('receiptPrefix', e.target.value)} />
          <select className="select" value={form.defaultCurrency} onChange={(e) => updateField('defaultCurrency', e.target.value as 'MDL' | 'EUR' | 'USD')}>
            <option value="MDL">MDL</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Branding</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="input" placeholder="Logo URL" value={form.logoUrl} onChange={(e) => updateField('logoUrl', e.target.value)} />
          <div className="flex items-center gap-2">
            <input type="color" className="h-10 w-14 rounded border border-border/70 bg-background p-1" value={form.primaryColor} onChange={(e) => updateField('primaryColor', e.target.value)} />
            <input className="input" placeholder="Primary color hex" value={form.primaryColor} onChange={(e) => updateField('primaryColor', e.target.value)} />
          </div>
        </div>
      </section>

      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );
}
