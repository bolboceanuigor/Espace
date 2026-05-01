'use client';

import { useState } from 'react';
import { Building2, CreditCard, FileText, Palette, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, Tabs } from '@/components/ui';

type SettingsForm = {
  name: string;
  legalName: string;
  fiscalCode: string;
  address: string;
  phone: string;
  email: string;
  administrator: string;
  treasurer: string;
  iban: string;
  bank: string;
  invoicePrefix: string;
  receiptPrefix: string;
  currency: 'MDL' | 'RON' | 'EUR';
  primaryColor: string;
};

const initialForm: SettingsForm = {
  name: 'APC Alba Iulia 75',
  legalName: 'Asociația de Proprietari în Condominiu Alba Iulia 75',
  fiscalCode: '1024600012345',
  address: 'Bd. Alba Iulia 75, Chișinău',
  phone: '+373 22 000 111',
  email: 'admin@albaiulia75.md',
  administrator: 'Administrator Bloc',
  treasurer: 'Contabil APC',
  iban: 'MD00EX000000000000000000',
  bank: 'BC Moldova Agroindbank SA',
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

export default function AdminOrganizationSettingsPage() {
  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Setări bloc"
        description="Date administrative pentru asociație, facturare și documente."
        rightSlot={<Button onClick={() => setSaved(true)}><Save className="h-4 w-4" /> Salvează local</Button>}
      />
      {saved ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Setările au fost actualizate local. Salvarea în backend se conectează ulterior.</div> : null}
      <section className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><IconTitle icon={<Building2 className="h-5 w-5" />} title={form.name} subtitle={form.address} /></Card>
        <Card className="p-4"><IconTitle icon={<ShieldCheck className="h-5 w-5" />} title="Organizație activă" subtitle="Configurare administrativă locală" badge="activ" /></Card>
        <Card className="p-4"><IconTitle icon={<CreditCard className="h-5 w-5" />} title={form.currency} subtitle="Moneda implicită pentru facturi" /></Card>
      </section>
      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} ariaLabel="Setări bloc" />
      {activeTab === 'general' ? (
        <Card>
          <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Date generale" />
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Denumire" value={form.name} onChange={(event) => update('name', event.target.value)} />
            <Input label="Denumire juridică" value={form.legalName} onChange={(event) => update('legalName', event.target.value)} />
            <Input label="Cod fiscal" value={form.fiscalCode} onChange={(event) => update('fiscalCode', event.target.value)} />
            <Input label="Adresă" value={form.address} onChange={(event) => update('address', event.target.value)} />
            <Input label="Telefon" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            <Input label="Email" value={form.email} onChange={(event) => update('email', event.target.value)} />
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
              <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={form.currency} onChange={(event) => update('currency', event.target.value as SettingsForm['currency'])}>
                <option value="MDL">MDL</option>
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
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
