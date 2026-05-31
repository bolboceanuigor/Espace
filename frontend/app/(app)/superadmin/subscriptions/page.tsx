'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, CreditCard, Layers3, Plus } from 'lucide-react';
import { Badge, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { normalizeApiPlan, type MvpPlan } from '@/lib/superadmin-mvp-data';

const emptyForm = {
  name: '',
  code: 'STARTER' as MvpPlan['code'],
  priceMonthly: '1290',
  currency: 'MDL' as MvpPlan['currency'],
  apartmentLimit: '150',
  features: 'Apartamente, Locatari, Contoare, Plăți, Cereri',
  status: 'ACTIVE' as MvpPlan['status'],
};

export default function SuperadminSubscriptionsPage() {
  const [plans, setPlans] = useState<MvpPlan[]>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'unavailable'>('loading');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPlans = async () => {
    const res = await superadminApi.listPlans();
    const apiPlans = (res.data || []).map(normalizeApiPlan);
    setPlans(apiPlans);
    setSource('api');
  };

  useEffect(() => {
    let active = true;
    loadPlans().catch(() => {
      if (!active) return;
      setPlans([]);
      setSource('unavailable');
      setError('API indisponibil temporar. Reîncearcă după ce serviciul revine.');
    });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    return {
      plans: plans.length,
      active: plans.filter((plan) => plan.status === 'ACTIVE').length,
      maxLimit: Math.max(...plans.map((plan) => plan.apartmentLimit), 0),
      revenue: plans.reduce((sum, plan) => sum + plan.priceMonthly, 0),
    };
  }, [plans]);

  const createPlan = async () => {
    setError('');
    setMessage('');
    const payload = {
      name: form.name.trim(),
      code: form.code,
      priceMonthly: Number(form.priceMonthly || 0),
      currency: form.currency,
      apartmentLimit: Number(form.apartmentLimit || 0),
      features: form.features.split(',').map((item) => item.trim()).filter(Boolean),
      status: form.status,
    };
    if (!payload.name || !payload.code) {
      setError('Completează numele și codul planului.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await superadminApi.createPlan(payload);
      const next = normalizeApiPlan(created.data);
      setPlans((current) => [next, ...current.filter((plan) => plan.id !== next.id)]);
      setSource('api');
      setForm(emptyForm);
      setModalOpen(false);
      setMessage('Planul a fost creat.');
      await loadPlans().catch(() => undefined);
    } catch (err: any) {
      const apiMessage = String(err?.message || '');
      setError(apiMessage.includes('există deja') ? 'Există deja un plan cu acest cod.' : 'Nu am putut crea planul.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Abonamente"
        description="Planuri SaaS și abonamente manuale pentru asociațiile din Espace."
        rightSlot={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            Adaugă plan
          </button>
        }
      />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="warning">{error}</Notice> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Planuri" value={totals.plans} description="Configurate în platformă" icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Active" value={totals.active} description="Disponibile pentru asociații" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Limită maximă" value={totals.maxLimit} description="Apartamente per plan" icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Prețuri listă" value={`${totals.revenue.toLocaleString('ro-RO')} MDL`} description="Sumă planuri lunare" icon={<CreditCard className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Planuri disponibile</h2>
            <p className="mt-1 text-sm text-muted-foreground">Limitele și funcționalitățile sunt folosite pentru management manual MVP.</p>
          </div>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'API indisponibil'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-[1.25rem] border border-border/70 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.code}</p>
                </div>
                <Badge variant={plan.status === 'ACTIVE' ? 'success' : 'neutral'}>{plan.status === 'ACTIVE' ? 'Activ' : 'Inactiv'}</Badge>
              </div>
              <p className="mt-5 text-3xl font-semibold text-foreground">
                {plan.priceMonthly.toLocaleString('ro-RO')} <span className="text-sm font-medium text-muted-foreground">{plan.currency}/lună</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Limită: {plan.apartmentLimit} apartamente</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.features.map((feature) => (
                  <span key={feature} className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!plans.length ? <div className="rounded-[1.25rem] border border-border/70 bg-white p-4 text-sm font-medium text-muted-foreground">Nu există planuri încă.</div> : null}
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă plan" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nume plan" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <label className="block">
              <span className="label">Cod</span>
              <select className="select" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value as MvpPlan['code'] })}>
                <option value="FREE">FREE</option>
                <option value="TRIAL">TRIAL</option>
                <option value="STARTER">STARTER</option>
                <option value="PRO">PRO</option>
              </select>
            </label>
            <Field label="Preț lunar" value={form.priceMonthly} onChange={(value) => setForm({ ...form, priceMonthly: value })} type="number" />
            <Field label="Limită apartamente" value={form.apartmentLimit} onChange={(value) => setForm({ ...form, apartmentLimit: value })} type="number" />
            <label className="block">
              <span className="label">Monedă</span>
              <select className="select" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as MvpPlan['currency'] })}>
                <option value="MDL">MDL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MvpPlan['status'] })}>
                <option value="ACTIVE">Activ</option>
                <option value="INACTIVE">Inactiv</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="label">Funcționalități</span>
              <textarea className="min-h-24 rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm outline-none focus:border-foreground md:w-full" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} />
            </label>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            În schema actuală se persistă numele, codul, moneda și prețul lunar. Limitele și funcționalitățile sunt normalizate de API pentru MVP.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isSaving} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createPlan} disabled={isSaving} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isSaving ? 'Se salvează...' : 'Creează plan'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: 'success' | 'warning' }) {
  const classes = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${classes}`}>{children}</div>;
}
