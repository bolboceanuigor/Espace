'use client';

import { useEffect, useState } from 'react';
import { Building2, CreditCard, FileText, Palette, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, Tabs } from '@/components/ui';
import { organizationSettingsApi } from '@/lib/api';

type SettingsForm = {
  name: string;
  legalName: string;
  fiscalCode: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  administrator: string;
  treasurer: string;
  iban: string;
  bank: string;
  paymentInstructions: string;
  invoicePrefix: string;
  receiptPrefix: string;
  currency: 'MDL';
  primaryColor: string;
};

const initialForm: SettingsForm = {
  name: '',
  legalName: '',
  fiscalCode: '',
  address: '',
  city: '',
  country: 'Moldova',
  phone: '',
  email: '',
  website: '',
  administrator: '',
  treasurer: '',
  iban: '',
  bank: '',
  paymentInstructions: '',
  invoicePrefix: 'FAC',
  receiptPrefix: 'CH',
  currency: 'MDL',
  primaryColor: '#111827',
};

const tabs = [
  { key: 'general', label: 'General' },
  { key: 'finance', label: 'Financiar' },
  { key: 'people', label: 'Responsabili' },
  { key: 'documents', label: 'Documente' },
  { key: 'brand', label: 'Aspect' },
];

function toForm(row: any): SettingsForm {
  return {
    name: row?.name || '',
    legalName: row?.legalName || '',
    fiscalCode: row?.fiscalCode || '',
    address: row?.address || '',
    city: row?.city || '',
    country: row?.country || 'Moldova',
    phone: row?.phone || '',
    email: row?.email || '',
    website: row?.website || '',
    administrator: row?.administratorName || '',
    treasurer: row?.treasurerName || '',
    iban: row?.bankAccountIban || '',
    bank: row?.bankName || '',
    paymentInstructions: row?.paymentInstructions || '',
    invoicePrefix: row?.invoicePrefix || 'FAC',
    receiptPrefix: row?.receiptPrefix || 'CH',
    currency: 'MDL',
    primaryColor: row?.primaryColor || '#111827',
  };
}

function normalizeAssociationCode(value: string) {
  return value.trim().toUpperCase();
}

function recommendedApcCode(value: string) {
  return /^A\d{4}-\d{4}$/.test(normalizeAssociationCode(value));
}

function legalNameForCode(code: string) {
  return `Asociația de Proprietari din Condominiu ${code}`;
}

function shortNameForCode(code: string) {
  return `A.P.C. ${code}`;
}

function associationNumberFromCode(code: string) {
  const match = normalizeAssociationCode(code).match(/-(\d{4})$/);
  return match?.[1] || 'Necompletat';
}

export default function AdminOrganizationSettingsPage() {
  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<'api' | 'offline'>('api');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    organizationSettingsApi
      .adminGet()
      .then((res) => {
        if (!active) return;
        setForm(toForm(res.data));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setSource('offline');
        setError('Nu am putut încărca setările A.P.C.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setMessage('');
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateAssociationCode = (value: string) => {
    const nextCode = normalizeAssociationCode(value);
    setMessage('');
    setError('');
    setForm((current) => {
      if (!recommendedApcCode(nextCode)) return { ...current, fiscalCode: nextCode };
      const previousCode = normalizeAssociationCode(current.fiscalCode);
      const legalWasGenerated = !current.legalName || current.legalName === legalNameForCode(previousCode);
      const shortWasGenerated = !current.name || current.name === shortNameForCode(previousCode);
      return {
        ...current,
        fiscalCode: nextCode,
        legalName: legalWasGenerated ? legalNameForCode(nextCode) : current.legalName,
        name: shortWasGenerated ? shortNameForCode(nextCode) : current.name,
      };
    });
  };

  const save = async () => {
    setMessage('');
    setError('');
    if (!form.name.trim()) {
      setError('Denumirea scurtă este obligatorie.');
      return;
    }
    setSaving(true);
    try {
      await organizationSettingsApi.adminUpdate({
        name: form.name.trim(),
        legalName: form.legalName.trim(),
        fiscalCode: form.fiscalCode.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim() || 'Moldova',
        phone: form.phone.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.website.trim() ? { website: form.website.trim() } : {}),
        bankName: form.bank.trim(),
        bankAccountIban: form.iban.trim(),
        paymentInstructions: form.paymentInstructions.trim(),
        treasurerName: form.treasurer.trim(),
        administratorName: form.administrator.trim(),
        primaryColor: form.primaryColor.trim() || '#111827',
        invoicePrefix: form.invoicePrefix.trim() || 'FAC',
        receiptPrefix: form.receiptPrefix.trim() || 'CH',
        defaultCurrency: 'MDL',
      });
      setMessage('Datele asociației au fost salvate.');
      setSource('api');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva datele asociației.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Profil A.P.C."
        description="Date administrative pentru asociație, facturare și documente."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {loading ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'API indisponibil'}
            </span>
            <Button type="button" onClick={save} isLoading={saving}>
              <Save className="h-4 w-4" />
              Salvează
            </Button>
          </div>
        }
      />

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><IconTitle icon={<Building2 className="h-5 w-5" />} title={form.name || 'A.P.C.'} subtitle={form.address || 'Adresă necompletată'} /></Card>
        <Card className="p-4"><IconTitle icon={<ShieldCheck className="h-5 w-5" />} title="Republica Moldova" subtitle={form.legalName || 'Asociația de Proprietari din Condominiu'} badge="MVP v1" /></Card>
        <Card className="p-4"><IconTitle icon={<CreditCard className="h-5 w-5" />} title="MDL" subtitle="Moneda implicită pentru facturi" /></Card>
      </section>

      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} ariaLabel="Profil A.P.C." />

      {activeTab === 'general' ? (
        <Card>
          <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Date generale" />
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Denumire scurtă" value={form.name} onChange={(event) => update('name', event.target.value)} />
            <Input label="Denumire lungă" value={form.legalName} onChange={(event) => update('legalName', event.target.value)} />
            <Input
              label="Cod APC"
              value={form.fiscalCode}
              onChange={(event) => updateAssociationCode(event.target.value)}
              hint={form.fiscalCode && !recommendedApcCode(form.fiscalCode) ? 'Format recomandat: A0123-0940' : undefined}
            />
            <Input label="Număr intern" value={associationNumberFromCode(form.fiscalCode)} disabled />
            <Input label="Adresă" value={form.address} onChange={(event) => update('address', event.target.value)} />
            <Input label="Oraș" value={form.city} onChange={(event) => update('city', event.target.value)} />
            <Input label="Țară" value={form.country} onChange={(event) => update('country', event.target.value)} />
            <Input label="Telefon" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            <Input label="Email" value={form.email} onChange={(event) => update('email', event.target.value)} />
            <Input label="Website" value={form.website} onChange={(event) => update('website', event.target.value)} />
          </div>
        </Card>
      ) : null}

      {activeTab === 'finance' ? (
        <Card>
          <SectionTitle icon={<CreditCard className="h-5 w-5" />} title="Financiar" />
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Bancă" value={form.bank} onChange={(event) => update('bank', event.target.value)} />
            <Input label="IBAN" value={form.iban} onChange={(event) => update('iban', event.target.value)} />
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Monedă
              <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value="MDL" disabled>
                <option value="MDL">MDL</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-foreground md:col-span-2">
              Instrucțiuni de plată
              <textarea
                className="min-h-28 w-full rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
                value={form.paymentInstructions}
                onChange={(event) => update('paymentInstructions', event.target.value)}
                placeholder="Ex: Transfer bancar către contul A.P.C. sau numerar la administrator."
              />
            </label>
          </div>
        </Card>
      ) : null}

      {activeTab === 'people' ? (
        <Card>
          <SectionTitle icon={<UserRound className="h-5 w-5" />} title="Responsabili" />
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Administrator" value={form.administrator} onChange={(event) => update('administrator', event.target.value)} />
            <Input label="Contabil / trezorier" value={form.treasurer} onChange={(event) => update('treasurer', event.target.value)} />
          </div>
        </Card>
      ) : null}

      {activeTab === 'documents' ? (
        <Card>
          <SectionTitle icon={<FileText className="h-5 w-5" />} title="Documente" />
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Prefix facturi" value={form.invoicePrefix} onChange={(event) => update('invoicePrefix', event.target.value)} />
            <Input label="Prefix chitanțe" value={form.receiptPrefix} onChange={(event) => update('receiptPrefix', event.target.value)} />
          </div>
        </Card>
      ) : null}

      {activeTab === 'brand' ? (
        <Card>
          <SectionTitle icon={<Palette className="h-5 w-5" />} title="Aspect" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Culoare principală
              <input type="color" className="h-11 w-20 rounded-2xl border border-border/70 bg-white p-1" value={form.primaryColor} onChange={(event) => update('primaryColor', event.target.value)} />
            </label>
            <Input label="Cod culoare" value={form.primaryColor} onChange={(event) => update('primaryColor', event.target.value)} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function IconTitle({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle: string; badge?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{title}</p>{badge ? <Badge variant="success">{badge}</Badge> : null}</div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">{icon}</span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}
