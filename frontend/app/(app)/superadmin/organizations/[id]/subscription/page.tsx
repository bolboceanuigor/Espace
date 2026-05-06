'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, CalendarDays, CreditCard, Layers3 } from 'lucide-react';
import { Badge, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import {
  mockAssociations,
  mockPlans,
  mockUsage,
  normalizeApiAssociation,
  normalizeApiPlan,
  normalizeApiSubscription,
  normalizeApiUsage,
  statusLabel,
  type MvpAssociation,
  type MvpPlan,
  type MvpSubscription,
  type MvpUsage,
} from '@/lib/superadmin-mvp-data';

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO');
}

function inputDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export default function SuperadminOrganizationSubscriptionPage() {
  const localizedPath = useLocalizedPath();
  const params = useParams<{ id: string }>();
  const orgId = params?.id || '';
  const fallbackAssociation = useMemo<MvpAssociation>(
    () => mockAssociations.find((item) => item.id === orgId) || mockAssociations[0],
    [orgId],
  );
  const [association, setAssociation] = useState<MvpAssociation>(fallbackAssociation);
  const [plans, setPlans] = useState<MvpPlan[]>(mockPlans);
  const [usage, setUsage] = useState<MvpUsage>(mockUsage);
  const [subscription, setSubscription] = useState<MvpSubscription | null>(null);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    planId: '',
    status: 'TRIAL' as SubscriptionStatus,
    trialEndsAt: addDays(14),
    currentPeriodStart: new Date().toISOString().slice(0, 10),
    currentPeriodEnd: addMonth(),
    price: '1290',
    apartmentLimit: '150',
  });

  const selectedPlan = plans.find((plan) => plan.id === form.planId) || plans[0];

  const load = useCallback(async () => {
    if (!orgId) return;
    const [orgRes, plansRes, subRes, usageRes] = await Promise.allSettled([
      superadminApi.getPublicOrganization(orgId),
      superadminApi.listPlans(),
      superadminApi.getOrganizationSubscription(orgId),
      superadminApi.getOrganizationUsage(orgId),
    ]);

    if (orgRes.status === 'fulfilled') setAssociation(normalizeApiAssociation(orgRes.value.data));
    if (plansRes.status === 'fulfilled') {
      const apiPlans = (plansRes.value.data || []).map(normalizeApiPlan);
      if (apiPlans.length) setPlans(apiPlans);
    }
    if (usageRes.status === 'fulfilled') setUsage(normalizeApiUsage(usageRes.value.data));
    if (subRes.status === 'fulfilled') {
      const next = normalizeApiSubscription(subRes.value.data, orgId);
      setSubscription(next);
      if (next) {
        setForm({
          planId: next.planId || '',
          status: next.status,
          trialEndsAt: inputDate(next.trialEndsAt),
          currentPeriodStart: inputDate(next.currentPeriodStart),
          currentPeriodEnd: inputDate(next.currentPeriodEnd),
          price: String(next.monthlyCost || 0),
          apartmentLimit: String(next.apartmentLimit || 150),
        });
      }
    }
    if (orgRes.status === 'fulfilled' || plansRes.status === 'fulfilled' || subRes.status === 'fulfilled' || usageRes.status === 'fulfilled') {
      setSource('api');
      setError('');
    }
  }, [orgId]);

  useEffect(() => {
    load().catch(() => {
      setSource('mock');
      setError('API indisponibil temporar. Sunt afișate date temporare.');
    });
  }, [load]);

  const saveSubscription = async (override?: Partial<typeof form>) => {
    if (!orgId) return;
    const nextForm = { ...form, ...override };
    const plan = plans.find((item) => item.id === nextForm.planId) || selectedPlan;
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await superadminApi.upsertOrganizationSubscription(orgId, {
        planId: plan?.id || undefined,
        planCode: plan?.code,
        status: nextForm.status,
        trialEndsAt: nextForm.trialEndsAt || undefined,
        currentPeriodStart: nextForm.currentPeriodStart || undefined,
        currentPeriodEnd: nextForm.currentPeriodEnd || undefined,
        price: Number(nextForm.price || plan?.priceMonthly || 0),
        apartmentLimit: Number(nextForm.apartmentLimit || plan?.apartmentLimit || 150),
      });
      setSubscription(normalizeApiSubscription(saved.data, orgId));
      setForm(nextForm);
      setSource('api');
      setMessage('Abonamentul a fost actualizat.');
      await load().catch(() => undefined);
    } catch {
      setError('Nu am putut actualiza abonamentul.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Abonament asociație"
        description="Management manual pentru plan, trial și perioada curentă. Plățile online vor fi conectate separat."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            <Link href={localizedPath(`/superadmin/organizations/${orgId}`)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Înapoi la asociație
            </Link>
          </div>
        }
      />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="warning">{error}</Notice> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plan curent" value={subscription?.planName || selectedPlan?.name || 'Starter'} description={subscription?.status || 'Neconfigurat'} icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Cost lunar" value={`${Number(form.price || 0).toLocaleString('ro-RO')} MDL`} description="Management manual" icon={<CreditCard className="h-5 w-5" />} tone="warning" />
        <StatCard label="Apartamente" value={usage.apartmentsCount} description={`${usage.apartmentLimit} limită plan`} icon={<Building2 className="h-5 w-5" />} tone={usage.usagePercentage > 90 ? 'warning' : 'success'} />
        <StatCard label="Trial până la" value={formatDate(form.trialEndsAt)} description="Dată de expirare" icon={<CalendarDays className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{association.shortName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {association.legalName} · {association.city} · {association.apartmentsCount} apartamente · {statusLabel(association.status)}
              </p>
            </div>
            <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : subscription?.status === 'TRIAL' ? 'warning' : 'neutral'}>
              {subscription?.status || 'Neconfigurat'}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">Plan</span>
              <select
                className="select"
                value={form.planId || selectedPlan?.id || ''}
                onChange={(event) => {
                  const plan = plans.find((item) => item.id === event.target.value);
                  setForm({
                    ...form,
                    planId: event.target.value,
                    price: String(plan?.priceMonthly ?? form.price),
                    apartmentLimit: String(plan?.apartmentLimit ?? form.apartmentLimit),
                  });
                }}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.priceMonthly.toLocaleString('ro-RO')} {plan.currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Status abonament</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SubscriptionStatus })}>
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Activ</option>
                <option value="PAST_DUE">Restanță</option>
                <option value="CANCELLED">Anulat</option>
              </select>
            </label>
            <Field label="Trial până la" type="date" value={form.trialEndsAt} onChange={(value) => setForm({ ...form, trialEndsAt: value })} />
            <Field label="Început perioadă" type="date" value={form.currentPeriodStart} onChange={(value) => setForm({ ...form, currentPeriodStart: value })} />
            <Field label="Sfârșit perioadă" type="date" value={form.currentPeriodEnd} onChange={(value) => setForm({ ...form, currentPeriodEnd: value })} />
            <Field label="Cost lunar" type="number" value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
            <Field label="Limită apartamente" type="number" value={form.apartmentLimit} onChange={(value) => setForm({ ...form, apartmentLimit: value })} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ActionButton disabled={isSaving} onClick={() => saveSubscription()}>
              Schimbă plan
            </ActionButton>
            <ActionButton disabled={isSaving} onClick={() => saveSubscription({ status: 'ACTIVE' })}>
              Activează abonament
            </ActionButton>
            <ActionButton disabled={isSaving} onClick={() => saveSubscription({ status: 'CANCELLED' })}>
              Anulează abonament
            </ActionButton>
            <ActionButton disabled={isSaving} onClick={() => saveSubscription({ status: 'TRIAL', trialEndsAt: addDays(30) })}>
              Prelungește trial
            </ActionButton>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Utilizare și limite</h2>
          <div className="mt-5 space-y-3">
            <UsageRow label="Apartamente utilizate" value={usage.apartmentsCount} limit={usage.apartmentLimit} />
            <UsageMini label="Utilizatori" value={usage.usersCount} />
            <UsageMini label="Locatari" value={usage.residentsCount} />
            <UsageMini label="Contoare" value={usage.metersCount} />
            <UsageMini label="Facturi" value={usage.invoicesCount} />
          </div>
        </Card>
      </section>
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

function ActionButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function UsageRow({ label, value, limit }: { label: string; value: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{value} / {limit}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-foreground" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function UsageMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value.toLocaleString('ro-RO')}</span>
    </div>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: 'success' | 'warning' }) {
  const classes = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${classes}`}>{children}</div>;
}
