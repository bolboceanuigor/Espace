'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleDollarSign, Copy, Layers3, PauseCircle, PlayCircle, Plus, RefreshCw, XCircle } from 'lucide-react';
import { billingSaasApi, superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const planStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
const subscriptionStatuses = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'] as const;
const billingCycles = ['MONTHLY', 'YEARLY', 'CUSTOM'] as const;
const featureKeys = [
  'apartmentsCrm',
  'residentsCrm',
  'internalInvoices',
  'manualPayments',
  'meterReadings',
  'meterBasedTariffs',
  'billingRun',
  'dataQuality',
  'announcements',
  'requests',
  'financialReports',
  'consumptionReports',
  'csvImport',
  'csvExport',
  'staffRoles',
  'auditLog',
  'supportAccess',
  'duplicateDetection',
  'advancedSecurity',
];

const featureLabels: Record<string, string> = {
  apartmentsCrm: 'Apartamente CRM',
  residentsCrm: 'Locatari CRM',
  internalInvoices: 'Facturi interne',
  manualPayments: 'Plăți manuale',
  meterReadings: 'Indici contoare',
  meterBasedTariffs: 'Tarife pe consum',
  billingRun: 'Proces facturare',
  dataQuality: 'Calitatea datelor',
  announcements: 'Anunțuri',
  requests: 'Solicitări',
  financialReports: 'Rapoarte financiare',
  consumptionReports: 'Rapoarte consum',
  csvImport: 'Import CSV',
  csvExport: 'Export CSV',
  staffRoles: 'Roluri staff',
  auditLog: 'Audit log',
  supportAccess: 'Support access',
  duplicateDetection: 'Duplicate detection',
  advancedSecurity: 'Securitate avansată',
};

const inputClass = 'min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400';
const softButtonClass = 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50';

const emptyPlan = {
  code: '',
  name: '',
  description: '',
  status: 'DRAFT',
  currency: 'MDL',
  monthlyPrice: '0',
  yearlyPrice: '',
  trialDays: '14',
  maxApartments: '',
  maxResidents: '',
  maxStaffMembers: '',
  maxMeters: '',
  maxInvoicesPerMonth: '',
  maxAnnouncementsPerMonth: '',
  maxRequestsPerMonth: '',
  maxStorageMB: '',
  isPublic: true,
  isDefault: false,
  features: featureKeys.reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: false }), {}),
};

function getData<T>(response: any, fallback: T): T {
  return response?.data ?? fallback;
}

function money(value: unknown, currency = 'MDL') {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ro-RO')} ${currency}`;
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    ACTIVE: 'Activ',
    ARCHIVED: 'Arhivat',
    TRIALING: 'Trial',
    PAST_DUE: 'Restant',
    SUSPENDED: 'Suspendat',
    CANCELLED: 'Anulat',
    EXPIRED: 'Expirat',
  };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'TRIALING' || status === 'PAST_DUE') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'SUSPENDED') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{children}</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function Header({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <Link
      href={href}
      className={variant === 'primary'
        ? 'inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white'
        : 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50'}
    >
      {children}
    </Link>
  );
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

function Loading() {
  return <Card><p className="text-sm text-slate-500">Se încarcă...</p></Card>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </Card>
  );
}

export function SaasBillingOverviewPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(getData(await billingSaasApi.overview(), null));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const summary = data?.summary || {};
  return (
    <div className="space-y-5">
      <Header
        title="Billing SaaS"
        subtitle="Gestionează planurile, abonamentele și statusul clienților APC."
        actions={
          <>
            <ButtonLink href={localizedPath('/superadmin/billing/plans/new')}><Plus className="h-4 w-4" /> Creează plan</ButtonLink>
            <ButtonLink href={localizedPath('/superadmin/billing/subscriptions')} variant="secondary">Vezi abonamente</ButtonLink>
            <ButtonLink href={localizedPath('/superadmin/billing/upgrade-requests')} variant="secondary">Cereri upgrade</ButtonLink>
          </>
        }
      />

      {loading ? <Loading /> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Asociații active" value={summary.activeAssociations || 0} />
            <Kpi label="În trial" value={summary.trialing || 0} />
            <Kpi label="Abonamente active" value={summary.activeSubscriptions || 0} />
            <Kpi label="Suspendate" value={summary.suspended || 0} />
            <Kpi label="Fără abonament" value={summary.withoutSubscription || 0} />
            <Kpi label="Planuri active" value={summary.activePlans || 0} />
            <Kpi label="Venit lunar estimat" value={money(summary.estimatedMonthlyRevenue, summary.currency)} />
            <Kpi label="Venit anual estimat" value={money(summary.estimatedYearlyRevenue, summary.currency)} />
          </div>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Cereri upgrade</h2>
                <p className="mt-1 text-sm text-slate-500">Procesează cererile de schimbare plan trimise de asociații.</p>
              </div>
              <ButtonLink href={localizedPath('/superadmin/billing/upgrade-requests')} variant="secondary">Deschide cererile</ButtonLink>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-950">Planuri active</h2>
                <ButtonLink href={localizedPath('/superadmin/billing/plans')} variant="secondary">Toate planurile</ButtonLink>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {(data.plans || []).map((plan: any) => (
                  <div key={plan.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-500">{plan.code} · {money(plan.monthlyPrice, plan.currency)}/lună</p>
                    </div>
                    <Badge status={plan.status}>{statusLabel(plan.status)}</Badge>
                  </div>
                ))}
                {!data.plans?.length ? <p className="py-4 text-sm text-slate-500">Nu există planuri active.</p> : null}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-950">Trial-uri care expiră curând</h2>
                <ButtonLink href={localizedPath('/superadmin/billing/subscriptions?trialEndingSoon=1')} variant="secondary">Vezi lista</ButtonLink>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {(data.trialsEndingSoon || []).map((subscription: any) => (
                  <div key={subscription.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-900">{subscription.association?.shortName || subscription.association?.name}</p>
                      <p className="text-xs text-slate-500">{subscription.planName} · expiră {fmtDate(subscription.trialEndsAt)}</p>
                    </div>
                    <ButtonLink href={localizedPath(`/superadmin/billing/subscriptions/${subscription.id}`)} variant="secondary">Deschide</ButtonLink>
                  </div>
                ))}
                {!data.trialsEndingSoon?.length ? <p className="py-4 text-sm text-slate-500">Nu sunt trial-uri aproape de expirare.</p> : null}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="font-semibold text-slate-950">Evenimente recente</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {(data.recentEvents || []).map((event: any) => (
                <div key={event.id} className="py-3">
                  <p className="font-medium text-slate-900">{event.title}</p>
                  <p className="text-sm text-slate-500">{event.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDate(event.createdAt)}</p>
                </div>
              ))}
              {!data.recentEvents?.length ? <p className="py-4 text-sm text-slate-500">Nu există evenimente încă.</p> : null}
            </div>
          </Card>
        </>
      ) : !loading ? <Empty title="Nu există date de billing" text="Planurile și abonamentele vor apărea după inițializarea API-ului." /> : null}
    </div>
  );
}

export function SaasPlansPage() {
  const localizedPath = useLocalizedPath();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const payload = getData(await billingSaasApi.listPlans(), { items: [] });
      setPlans(payload.items || payload || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <Header
        title="Planuri SaaS"
        subtitle="Configurează planurile disponibile pentru asociațiile din Espace."
        actions={<ButtonLink href={localizedPath('/superadmin/billing/plans/new')}><Plus className="h-4 w-4" /> Creează plan</ButtonLink>}
      />
      {loading ? <Loading /> : null}
      {!loading && !plans.length ? <Empty title="Nu există planuri SaaS" text="Creează primul plan pentru a putea asigna abonamente asociațiilor." /> : null}
      {plans.length ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-3">Cod</th>
                  <th>Nume</th>
                  <th>Status</th>
                  <th>Preț lunar</th>
                  <th>Trial</th>
                  <th>Limite principale</th>
                  <th>Asociații</th>
                  <th>Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="py-3 font-mono text-xs font-semibold text-slate-700">{plan.code}</td>
                    <td className="font-medium text-slate-950">{plan.name}</td>
                    <td><Badge status={plan.status}>{statusLabel(plan.status)}</Badge></td>
                    <td>{money(plan.monthlyPrice, plan.currency)}</td>
                    <td>{plan.trialDays} zile</td>
                    <td className="text-slate-500">{plan.maxApartments ?? '∞'} ap. · {plan.maxStaffMembers ?? '∞'} staff · {plan.maxStorageMB ?? '∞'} MB</td>
                    <td>{plan.subscriptionsCount || 0}</td>
                    <td>
                      <div className="flex gap-2">
                        <ButtonLink href={localizedPath(`/superadmin/billing/plans/${plan.id}`)} variant="secondary">Deschide</ButtonLink>
                        <ButtonLink href={localizedPath(`/superadmin/billing/plans/${plan.id}/edit`)} variant="secondary">Editează</ButtonLink>
                        <button
                          className="rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                          onClick={async () => {
                            await billingSaasApi.duplicateSaasPlan(plan.id);
                            await load();
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function SaasPlanFormPage({ id }: { id?: string }) {
  const localizedPath = useLocalizedPath();
  const [form, setForm] = useState<any>(emptyPlan);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    billingSaasApi.getSaasPlan(id).then((res) => {
      const payload = getData<any>(res, {});
      const plan = payload.plan || payload;
      setForm({
        ...emptyPlan,
        ...plan,
        monthlyPrice: String(plan.monthlyPrice ?? 0),
        yearlyPrice: plan.yearlyPrice === null || plan.yearlyPrice === undefined ? '' : String(plan.yearlyPrice),
        trialDays: String(plan.trialDays ?? 14),
        maxApartments: plan.maxApartments ?? '',
        maxResidents: plan.maxResidents ?? '',
        maxStaffMembers: plan.maxStaffMembers ?? '',
        maxMeters: plan.maxMeters ?? '',
        maxInvoicesPerMonth: plan.maxInvoicesPerMonth ?? '',
        maxAnnouncementsPerMonth: plan.maxAnnouncementsPerMonth ?? '',
        maxRequestsPerMonth: plan.maxRequestsPerMonth ?? '',
        maxStorageMB: plan.maxStorageMB ?? '',
        features: { ...emptyPlan.features, ...(plan.features || {}) },
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    const payload = {
      ...form,
      monthlyPrice: Number(form.monthlyPrice || 0),
      yearlyPrice: form.yearlyPrice === '' ? null : Number(form.yearlyPrice || 0),
      trialDays: Number(form.trialDays || 0),
      maxApartments: nullableNumber(form.maxApartments),
      maxResidents: nullableNumber(form.maxResidents),
      maxStaffMembers: nullableNumber(form.maxStaffMembers),
      maxMeters: nullableNumber(form.maxMeters),
      maxInvoicesPerMonth: nullableNumber(form.maxInvoicesPerMonth),
      maxAnnouncementsPerMonth: nullableNumber(form.maxAnnouncementsPerMonth),
      maxRequestsPerMonth: nullableNumber(form.maxRequestsPerMonth),
      maxStorageMB: nullableNumber(form.maxStorageMB),
      features: form.features,
    };
    try {
      const res = id ? await billingSaasApi.updateSaasPlan(id, payload) : await billingSaasApi.createSaasPlan(payload);
      const saved = getData<any>(res, {});
      setMessage('Planul a fost salvat.');
      if (!id && saved?.id) window.location.href = localizedPath(`/superadmin/billing/plans/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="space-y-5">
      <Header
        title={id ? 'Editează plan' : 'Creează plan'}
        subtitle="Definește prețuri, limite și funcționalități pentru un plan SaaS."
        actions={<ButtonLink href={localizedPath('/superadmin/billing/plans')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>}
      />
      {message ? <Card className="border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700">{message}</Card> : null}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cod" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase().replace(/\s+/g, '_') })} />
          <Field label="Nume" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Descriere</span>
            <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <Select label="Status" value={form.status} options={planStatuses} onChange={(value) => setForm({ ...form, status: value })} />
          <Select label="Monedă" value={form.currency} options={['MDL', 'EUR', 'USD']} onChange={(value) => setForm({ ...form, currency: value })} />
          <Field label="Preț lunar" type="number" value={form.monthlyPrice} onChange={(value) => setForm({ ...form, monthlyPrice: value })} />
          <Field label="Preț anual" type="number" value={form.yearlyPrice} onChange={(value) => setForm({ ...form, yearlyPrice: value })} />
          <Field label="Trial zile" type="number" value={form.trialDays} onChange={(value) => setForm({ ...form, trialDays: value })} />
          <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Public</label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default</label>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-slate-950">Limite</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {['maxApartments', 'maxResidents', 'maxStaffMembers', 'maxMeters', 'maxInvoicesPerMonth', 'maxAnnouncementsPerMonth', 'maxRequestsPerMonth', 'maxStorageMB'].map((key) => (
            <Field key={key} label={key} type="number" value={String(form[key] ?? '')} onChange={(value) => setForm({ ...form, [key]: value })} />
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-slate-950">Features</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {featureKeys.map((key) => (
            <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={Boolean(form.features?.[key])} onChange={(event) => setForm({ ...form, features: { ...form.features, [key]: event.target.checked } })} />
              {featureLabels[key]}
            </label>
          ))}
        </div>
      </Card>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={save}>
        {saving ? 'Se salvează...' : 'Salvează plan'}
      </button>
    </div>
  );
}

export function SaasPlanDetailsPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    billingSaasApi.getSaasPlan(id).then((res) => setData(getData(res, null)));
  }, [id]);
  if (!data) return <Loading />;
  const plan = data.plan || data;
  return (
    <div className="space-y-5">
      <Header
        title={`${plan.name} (${plan.code})`}
        subtitle="Detalii plan, limite, features și abonamente active."
        actions={<ButtonLink href={localizedPath(`/superadmin/billing/plans/${id}/edit`)}>Editează</ButtonLink>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Status" value={<Badge status={plan.status}>{statusLabel(plan.status)}</Badge>} />
        <Kpi label="Preț lunar" value={money(plan.monthlyPrice, plan.currency)} />
        <Kpi label="Preț anual" value={plan.yearlyPrice ? money(plan.yearlyPrice, plan.currency) : '—'} />
        <Kpi label="Trial" value={`${plan.trialDays} zile`} />
      </div>
      <Card>
        <h2 className="font-semibold text-slate-950">Funcționalități</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([key]) => (
            <span key={key} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{featureLabels[key] || key}</span>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-slate-950">Asociații pe plan</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {(data.subscriptions || []).map((subscription: any) => (
            <div key={subscription.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-slate-900">{subscription.association?.shortName || subscription.association?.name}</p>
                <p className="text-xs text-slate-500">{statusLabel(subscription.status)} · {money(subscription.price, subscription.currency)}</p>
              </div>
              <ButtonLink href={localizedPath(`/superadmin/billing/subscriptions/${subscription.id}`)} variant="secondary">Deschide</ButtonLink>
            </div>
          ))}
          {!data.subscriptions?.length ? <p className="py-4 text-sm text-slate-500">Nu există abonamente pe acest plan.</p> : null}
        </div>
      </Card>
    </div>
  );
}

export function SaasSubscriptionsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [form, setForm] = useState({ associationId: '', planId: '', status: 'TRIALING', billingCycle: 'MONTHLY', price: '', trialDays: '14', internalNotes: '' });

  const load = async () => {
    const [subRes, planRes, orgRes] = await Promise.all([
      billingSaasApi.listSaasSubscriptions(),
      billingSaasApi.listPlans(),
      superadminApi.listPublicOrganizations(),
    ]);
    const subscriptions = getData(subRes, { items: [] });
    const plansPayload = getData(planRes, { items: [] });
    setItems(subscriptions.items || []);
    setPlans(plansPayload.items || plansPayload || []);
    setOrgs(getData(orgRes, []));
  };
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const create = async () => {
    await billingSaasApi.createSaasSubscription({
      ...form,
      price: form.price === '' ? undefined : Number(form.price),
      trialDays: Number(form.trialDays || 0),
    });
    setForm({ associationId: '', planId: '', status: 'TRIALING', billingCycle: 'MONTHLY', price: '', trialDays: '14', internalNotes: '' });
    await load();
  };

  return (
    <div className="space-y-5">
      <Header title="Abonamente APC" subtitle="Urmărește planurile și statusul abonamentelor pentru fiecare asociație." />
      <Card>
        <h2 className="font-semibold text-slate-950">Asignează plan</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select className={inputClass} value={form.associationId} onChange={(e) => setForm({ ...form, associationId: e.target.value })}>
            <option value="">Asociație</option>
            {orgs.map((org) => <option key={org.id} value={org.id}>{org.name || org.shortName}</option>)}
          </select>
          <select className={inputClass} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
            <option value="">Plan</option>
            {plans.filter((plan) => plan.status === 'ACTIVE').map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
          <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{subscriptionStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
          <select className={inputClass} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>{billingCycles.map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}</select>
          <input className={inputClass} placeholder="Preț" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <button className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={!form.associationId || !form.planId} onClick={create}>Salvează</button>
        </div>
      </Card>
      {!items.length ? <Empty title="Nu există abonamente" text="Abonamentele APC-urilor vor apărea aici după asignarea unui plan." /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500"><tr className="border-b border-slate-200"><th className="py-3">Asociație</th><th>Plan</th><th>Status</th><th>Cycle</th><th>Preț</th><th>Trial ends</th><th>Utilizare</th><th>Acțiuni</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="py-3 font-medium text-slate-950">{subscription.association?.shortName || subscription.association?.name}</td>
                    <td>{subscription.planName}</td>
                    <td><Badge status={subscription.status}>{statusLabel(subscription.status)}</Badge></td>
                    <td>{subscription.billingCycle}</td>
                    <td>{money(subscription.price, subscription.currency)}</td>
                    <td>{fmtDate(subscription.trialEndsAt)}</td>
                    <td className="text-xs text-slate-500">{subscription.usage?.apartments?.used ?? 0}/{subscription.usage?.apartments?.limit ?? '∞'} ap.</td>
                    <td><ButtonLink href={localizedPath(`/superadmin/billing/subscriptions/${subscription.id}`)} variant="secondary">Deschide</ButtonLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export function SaasSubscriptionDetailsPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const load = async () => setData(getData(await billingSaasApi.getSaasSubscription(id), null));
  useEffect(() => { load().catch(() => undefined); }, [id]);
  if (!data) return <Loading />;
  const subscription = data.subscription || data;
  const action = async (kind: 'activate' | 'suspend' | 'reactivate' | 'cancel') => {
    if (kind === 'activate') await billingSaasApi.activateSaasSubscription(id);
    if (kind === 'reactivate') await billingSaasApi.reactivateSaasSubscription(id);
    if (kind === 'suspend') await billingSaasApi.suspendSaasSubscription(id, window.prompt('Motiv suspendare') || '');
    if (kind === 'cancel') await billingSaasApi.cancelSaasSubscription(id, window.prompt('Motiv anulare') || '');
    await load();
  };
  return (
    <div className="space-y-5">
      <Header
        title={`Abonament ${subscription.association?.shortName || subscription.association?.name || ''}`}
        subtitle="Status, plan, limite, usage și istoricul modificărilor."
        actions={<ButtonLink href={localizedPath('/superadmin/billing/subscriptions')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Plan" value={subscription.planName || subscription.plan?.name} />
        <Kpi label="Status" value={<Badge status={subscription.status}>{statusLabel(subscription.status)}</Badge>} />
        <Kpi label="Preț" value={money(subscription.price, subscription.currency)} />
        <Kpi label="Perioadă" value={`${fmtDate(subscription.currentPeriodStart)} - ${fmtDate(subscription.currentPeriodEnd)}`} />
      </div>
      <Card>
        <h2 className="font-semibold text-slate-950">Acțiuni</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={softButtonClass} onClick={() => action('activate')}><PlayCircle className="h-4 w-4" /> Activează</button>
          <button className={softButtonClass} onClick={() => action('suspend')}><PauseCircle className="h-4 w-4" /> Suspendă</button>
          <button className={softButtonClass} onClick={() => action('reactivate')}><RefreshCw className="h-4 w-4" /> Reactivează</button>
          <button className={softButtonClass} onClick={() => action('cancel')}><XCircle className="h-4 w-4" /> Anulează</button>
        </div>
      </Card>
      <UsageCard usage={subscription.usage} />
      <Card>
        <h2 className="font-semibold text-slate-950">Istoric</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {(data.events || []).map((event: any) => (
            <div key={event.id} className="py-3">
              <p className="font-medium text-slate-900">{event.title}</p>
              <p className="text-sm text-slate-500">{event.message}</p>
              <p className="mt-1 text-xs text-slate-400">{fmtDate(event.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AssociationSaasSubscriptionPage({ id }: { id: string }) {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({ planId: '', status: 'TRIALING', billingCycle: 'MONTHLY', trialDays: '14', price: '' });
  const load = async () => {
    const [subRes, planRes] = await Promise.all([billingSaasApi.getAssociationSaasSubscription(id), billingSaasApi.listPlans()]);
    setData(getData(subRes, null));
    setPlans(getData(planRes, { items: [] }).items || []);
  };
  useEffect(() => { load().catch(() => undefined); }, [id]);
  const assign = async () => {
    await billingSaasApi.assignAssociationSaasPlan(id, { ...form, price: form.price === '' ? undefined : Number(form.price), trialDays: Number(form.trialDays || 0) });
    await load();
  };
  if (!data) return <Loading />;
  const subscription = data.subscription;
  return (
    <div className="space-y-5">
      <Header
        title={`Abonament ${data.association?.shortName || data.association?.name || ''}`}
        subtitle="Gestionează planul, statusul și utilizarea acestei asociații."
        actions={<ButtonLink href={localizedPath(`/superadmin/organizations/${id}`)} variant="secondary"><ArrowLeft className="h-4 w-4" /> Asociație</ButtonLink>}
      />
      {subscription ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Plan" value={subscription.planName} />
          <Kpi label="Status" value={<Badge status={subscription.status}>{statusLabel(subscription.status)}</Badge>} />
          <Kpi label="Trial ends" value={fmtDate(subscription.trialEndsAt)} />
          <Kpi label="Preț" value={money(subscription.price, subscription.currency)} />
        </div>
      ) : <Empty title="Asociația nu are abonament" text="Asignează un plan pentru a activa accesul SaaS al acestei asociații." />}
      <Card>
        <h2 className="font-semibold text-slate-950">Asignează / schimbă plan</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <select className={inputClass} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}><option value="">Plan</option>{plans.filter((plan) => plan.status === 'ACTIVE').map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
          <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{subscriptionStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
          <select className={inputClass} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>{billingCycles.map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}</select>
          <input className={inputClass} placeholder="Preț" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <button className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={!form.planId} onClick={assign}>Aplică</button>
        </div>
      </Card>
      <UsageCard usage={data.usage} />
      <Card>
        <h2 className="font-semibold text-slate-950">Evenimente</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {(data.events || []).map((event: any) => (
            <div key={event.id} className="py-3">
              <p className="font-medium text-slate-900">{event.title}</p>
              <p className="text-sm text-slate-500">{event.message}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UsageCard({ usage }: { usage: any }) {
  const rows = Object.entries(usage || {});
  return (
    <Card>
      <h2 className="font-semibold text-slate-950">Usage summary</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map(([key, metric]: any) => (
          <div key={key} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{key}</span>
              <span className="text-slate-500">{metric.used ?? '—'} / {metric.limit ?? '∞'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.min(Number(metric.percent || 0), 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{metric.status}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input className={`${inputClass} w-full`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select className={`${inputClass} w-full`} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
      </select>
    </label>
  );
}

function nullableNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  return Number(value);
}
