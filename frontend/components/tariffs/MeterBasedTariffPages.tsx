'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Activity, BadgeCheck, Calculator, Copy, Droplets, Gauge, Plus, RefreshCw, Save, Settings2, Zap } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi, tariffsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type MeterType = 'COLD_WATER' | 'HOT_WATER' | 'ELECTRICITY' | 'GAS' | 'HEAT' | 'OTHER';
type TariffStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
type Periodicity = 'MONTHLY' | 'ONE_TIME';
type MissingReadingPolicy = 'SKIP_WITH_WARNING' | 'ZERO_WITH_WARNING' | 'BLOCK_DRAFT';
type AppliesTo = 'ALL_APARTMENTS' | 'ONLY_OCCUPIED' | 'CUSTOM_SELECTION';

type MeterBasedTariff = {
  id: string;
  name: string;
  internalCode?: string;
  description?: string;
  calculationType: 'PER_METER_CONSUMPTION';
  meterType: MeterType;
  typeLabel?: string;
  unit: string;
  pricePerUnit: number;
  currency: 'MDL';
  periodicity: Periodicity;
  status: TariffStatus;
  appliesTo: AppliesTo;
  includeInMonthlyEstimate: boolean;
  includeInDraftInvoices: boolean;
  visibleToResidents: boolean;
  requiresApprovedReading: boolean;
  missingReadingPolicy: MissingReadingPolicy;
  startsAt?: string | null;
  endsAt?: string | null;
  monthlyEstimate?: number;
  affectedApartments?: number;
  updatedAt?: string;
  internalNotes?: string;
  organization?: AssociationBadge;
  impact?: Record<string, any>;
  previewItems?: MeterChargePreviewItem[];
};

type AssociationBadge = {
  shortName?: string;
  associationCode?: string;
  currency?: string;
};

type MeterTariffResponse = {
  organization?: AssociationBadge;
  items: MeterBasedTariff[];
  stats: {
    activeMeterTariffs: number;
    draftMeterTariffs: number;
    inactiveMeterTariffs: number;
    coveredMeterTypes: number;
    currentMonthEstimatedTotal: number;
    apartmentsWithApprovedReadings?: number;
    apartmentsWithoutApprovedReadings: number;
    needsReviewReadings: number;
    billingMonth?: string;
  };
};

type MeterChargePreviewItem = {
  apartment: { id: string; apartmentNumber: string; staircase?: string | null; floor?: string | null };
  primaryContact?: { id: string; fullName: string; phone?: string | null } | null;
  meter: { id: string; meterNumber?: string | null; type: MeterType; unit: string };
  reading?: {
    id: string;
    periodMonth: string;
    previousReadingValue?: number | null;
    readingValue?: number | null;
    consumptionValue?: number | null;
    status?: string;
  } | null;
  tariff: { id: string; name: string; pricePerUnit: number; currency: 'MDL'; missingReadingPolicy?: MissingReadingPolicy };
  amount: number;
  formulaLabel: string;
  status: 'READY' | 'WARNING' | 'ERROR' | 'EXCLUDED';
  warnings: string[];
};

type MeterChargePreview = {
  billingMonth: string;
  association?: AssociationBadge;
  summary: {
    currency: 'MDL';
    activeMeterTariffs: number;
    totalApprovedConsumption: Record<string, { value: number; unit: string }>;
    estimatedAmount: number;
    calculatedApartments: number;
    apartmentsWithoutApprovedReadings: number;
    warningsCount: number;
    errorsCount: number;
    needsReviewReadings?: number;
    rejectedReadings?: number;
  };
  items: MeterChargePreviewItem[];
  warnings: string[];
  meta: { page: number; limit: number; total: number };
};

const emptyResponse: MeterTariffResponse = {
  items: [],
  stats: {
    activeMeterTariffs: 0,
    draftMeterTariffs: 0,
    inactiveMeterTariffs: 0,
    coveredMeterTypes: 0,
    currentMonthEstimatedTotal: 0,
    apartmentsWithoutApprovedReadings: 0,
    needsReviewReadings: 0,
  },
};

const meterTypeLabels: Record<MeterType, string> = {
  COLD_WATER: 'Apă rece',
  HOT_WATER: 'Apă caldă',
  ELECTRICITY: 'Electricitate',
  GAS: 'Gaz',
  HEAT: 'Căldură',
  OTHER: 'Altul',
};

const defaultUnits: Record<MeterType, string> = {
  COLD_WATER: 'm³',
  HOT_WATER: 'm³',
  ELECTRICITY: 'kWh',
  GAS: 'm³',
  HEAT: 'Gcal',
  OTHER: 'unitate',
};

const statusLabels: Record<TariffStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Activ',
  INACTIVE: 'Inactiv',
};

const statusVariant = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'warning',
} as const;

const policyLabels: Record<MissingReadingPolicy, string> = {
  SKIP_WITH_WARNING: 'Omite cu avertizare',
  ZERO_WITH_WARNING: 'Zero cu avertizare',
  BLOCK_DRAFT: 'Blochează draft',
};

const appliesToLabels: Record<AppliesTo, string> = {
  ALL_APARTMENTS: 'Toate apartamentele',
  ONLY_OCCUPIED: 'Doar ocupate',
  CUSTOM_SELECTION: 'Selecție custom',
};

const emptyForm = {
  name: '',
  internalCode: '',
  description: '',
  meterType: 'COLD_WATER' as MeterType,
  unit: 'm³',
  pricePerUnit: '',
  periodicity: 'MONTHLY' as Periodicity,
  status: 'DRAFT' as TariffStatus,
  appliesTo: 'ALL_APARTMENTS' as AppliesTo,
  includeInMonthlyEstimate: true,
  includeInDraftInvoices: true,
  visibleToResidents: true,
  requiresApprovedReading: true,
  missingReadingPolicy: 'SKIP_WITH_WARNING' as MissingReadingPolicy,
  startsAt: '',
  endsAt: '',
  internalNotes: '',
};

function currentBillingMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatNumber(value?: number | null, unit = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('ro-RO', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

function associationBadge(organization?: AssociationBadge) {
  const shortName = organization?.shortName || 'A.P.C.';
  const code = organization?.associationCode || 'cod necompletat';
  return `${shortName} · ${code} · MDL`;
}

function selectClassName() {
  return 'h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm text-foreground outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10';
}

function checkboxClassName() {
  return 'h-4 w-4 rounded border-border text-foreground focus:ring-foreground/20';
}

export function MeterBasedTariffsListPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<MeterTariffResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tariffsApi.meterBasedList();
      setData(res.data || emptyResponse);
    } catch (err: any) {
      setData(emptyResponse);
      setError(String(err?.message || 'Nu am putut încărca tarifele pe consum.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(row: MeterBasedTariff, status: TariffStatus) {
    setSuccess('');
    setError('');
    try {
      await tariffsApi.meterBasedUpdateStatus(row.id, status);
      setSuccess(status === 'ACTIVE' ? 'Tariful a fost activat.' : 'Statusul tarifului a fost actualizat.');
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut actualiza tariful.'));
    }
  }

  async function duplicate(row: MeterBasedTariff) {
    setSuccess('');
    setError('');
    try {
      await tariffsApi.meterBasedDuplicate(row.id);
      setSuccess('Tariful a fost duplicat ca draft.');
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut duplica tariful.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Tarife pe consum"
        description="Configurează tarifele calculate pe baza indicilor aprobați ai contoarelor."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{associationBadge(data.organization)}</Badge>
            <Badge variant="neutral">Aceste tarife se includ doar în draftul de facturi.</Badge>
            <ButtonLink href="/admin/invoices/draft/meter-charges-preview" variant="secondary">
              <Calculator className="h-4 w-4" />
              Previzualizare calcul
            </ButtonLink>
            <ButtonLink href="/admin/tariffs/meter-based/new">
              <Plus className="h-4 w-4" />
              Adaugă tarif pe consum
            </ButtonLink>
          </div>
        }
      />

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tarife active" value={data.stats.activeMeterTariffs} description="Incluse în draft" icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Tarife draft" value={data.stats.draftMeterTariffs} description="În lucru" icon={<Settings2 className="h-5 w-5" />} />
        <StatCard label="Tipuri acoperite" value={data.stats.coveredMeterTypes} description="Tipuri de contoare" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Estimare curentă" value={formatMdl(data.stats.currentMonthEstimatedTotal)} description={data.stats.billingMonth || currentBillingMonth()} icon={<Calculator className="h-5 w-5" />} />
        <StatCard label="Fără indici aprobați" value={data.stats.apartmentsWithoutApprovedReadings} description="Pentru luna curentă" icon={<Droplets className="h-5 w-5" />} tone="warning" />
        <StatCard label="Needs review" value={data.stats.needsReviewReadings} description="Indici de verificat" icon={<Activity className="h-5 w-5" />} tone="warning" />
        <StatCard label="Tarife inactive" value={data.stats.inactiveMeterTariffs} description="Păstrate în istoric" icon={<RefreshCw className="h-5 w-5" />} />
        <StatCard label="Indici aprobați" value={data.stats.apartmentsWithApprovedReadings || 0} description="Apartamente calculate" icon={<Zap className="h-5 w-5" />} />
      </section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/admin/meters" variant="secondary">Vezi contoare</ButtonLink>
        <ButtonLink href="/admin/meter-readings/reports" variant="secondary">Vezi rapoarte consum</ButtonLink>
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Actualizează
        </Button>
      </div>

      {loading ? <SkeletonRows /> : null}

      {!loading && !data.items.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Nu există tarife pe consum</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Configurează tarifele calculate pe baza consumului aprobat al contoarelor pentru a le include în draftul facturilor.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/admin/tariffs/meter-based/new">Adaugă tarif pe consum</ButtonLink>
            <ButtonLink href="/admin/meters" variant="secondary">Vezi contoare</ButtonLink>
          </div>
        </Card>
      ) : null}

      {!loading && data.items.length ? (
        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="hidden grid-cols-[1.25fr_0.9fr_0.85fr_0.65fr_0.8fr_0.85fr_0.85fr_0.75fr_1.45fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid">
            <span>Nume tarif</span>
            <span>Tip contor</span>
            <span>Preț/unitate</span>
            <span>Unitate</span>
            <span>Status</span>
            <span>Aplicabilitate</span>
            <span>Include draft</span>
            <span>Actualizat</span>
            <span>Acțiuni</span>
          </div>
          {data.items.map((row) => (
            <div key={row.id} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[1.25fr_0.9fr_0.85fr_0.65fr_0.8fr_0.85fr_0.85fr_0.75fr_1.45fr] lg:items-center">
              <div>
                <strong className="text-foreground">{row.name}</strong>
                <p className="mt-1 text-xs text-muted-foreground">{row.internalCode || 'Fără cod intern'}</p>
              </div>
              <span className="text-muted-foreground">{meterTypeLabels[row.meterType] || row.meterType}</span>
              <span className="font-medium text-foreground">{formatMdl(Number(row.pricePerUnit || 0))}</span>
              <span className="text-muted-foreground">{row.unit}</span>
              <Badge variant={statusVariant[row.status]}>{statusLabels[row.status]}</Badge>
              <span className="text-muted-foreground">{appliesToLabels[row.appliesTo]}</span>
              <Badge variant={row.includeInDraftInvoices ? 'success' : 'neutral'}>{row.includeInDraftInvoices ? 'Da' : 'Nu'}</Badge>
              <span className="text-muted-foreground">{formatDate(row.updatedAt)}</span>
              <div className="flex flex-wrap gap-1.5">
                <Link href={localizedPath(`/admin/tariffs/meter-based/${row.id}`)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Deschide</Link>
                <Link href={localizedPath(`/admin/tariffs/meter-based/${row.id}/edit`)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Editează</Link>
                <button type="button" onClick={() => updateStatus(row, row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">
                  {row.status === 'ACTIVE' ? 'Dezactivează' : 'Activează'}
                </button>
                <button type="button" onClick={() => duplicate(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Duplicate</button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function MeterBasedTariffFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [association, setAssociation] = useState<AssociationBadge | undefined>();

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    setLoading(true);
    tariffsApi
      .meterBasedGet(id)
      .then((res) => {
        if (cancelled) return;
        const row = res.data as MeterBasedTariff;
        setAssociation(row.organization);
        setForm({
          name: row.name || '',
          internalCode: row.internalCode || '',
          description: row.description || '',
          meterType: row.meterType || 'COLD_WATER',
          unit: row.unit || defaultUnits[row.meterType || 'COLD_WATER'],
          pricePerUnit: row.pricePerUnit === undefined || row.pricePerUnit === null ? '' : String(row.pricePerUnit),
          periodicity: row.periodicity || 'MONTHLY',
          status: row.status || 'DRAFT',
          appliesTo: row.appliesTo || 'ALL_APARTMENTS',
          includeInMonthlyEstimate: row.includeInMonthlyEstimate !== false,
          includeInDraftInvoices: row.includeInDraftInvoices !== false,
          visibleToResidents: row.visibleToResidents !== false,
          requiresApprovedReading: row.requiresApprovedReading !== false,
          missingReadingPolicy: row.missingReadingPolicy || 'SKIP_WITH_WARNING',
          startsAt: row.startsAt || '',
          endsAt: row.endsAt || '',
          internalNotes: row.internalNotes || '',
        });
      })
      .catch((err: any) => setError(String(err?.message || 'Nu am putut încărca tariful.')))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, mode]);

  function patchForm(patch: Partial<typeof emptyForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function changeMeterType(value: MeterType) {
    patchForm({ meterType: value, unit: defaultUnits[value] });
  }

  function validate() {
    if (!form.name.trim()) return 'Numele tarifului este obligatoriu.';
    if (!form.meterType) return 'Tipul contorului este obligatoriu.';
    if (!form.unit.trim()) return 'Unitatea este obligatorie.';
    const price = Number(form.pricePerUnit);
    if (!Number.isFinite(price) || price <= 0) return 'Prețul per unitate trebuie să fie pozitiv.';
    if (form.startsAt && form.endsAt && new Date(form.startsAt) > new Date(form.endsAt)) return 'Data activării nu poate fi după data finală.';
    return '';
  }

  async function submit() {
    setError('');
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        internalCode: form.internalCode.trim(),
        description: form.description.trim(),
        calculationType: 'PER_METER_CONSUMPTION',
        meterType: form.meterType,
        unit: form.unit.trim(),
        pricePerUnit: Number(form.pricePerUnit),
        currency: 'MDL',
        periodicity: form.periodicity,
        status: form.status,
        appliesTo: form.appliesTo,
        includeInMonthlyEstimate: form.includeInMonthlyEstimate,
        includeInDraftInvoices: form.includeInDraftInvoices,
        visibleToResidents: form.visibleToResidents,
        requiresApprovedReading: form.requiresApprovedReading,
        missingReadingPolicy: form.missingReadingPolicy,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        internalNotes: form.internalNotes.trim(),
      };
      const res = mode === 'edit' && id ? await tariffsApi.meterBasedUpdate(id, payload) : await tariffsApi.meterBasedCreate(payload);
      router.push(localizedPath(`/admin/tariffs/meter-based/${res.data?.id || id}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva tariful.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={mode === 'edit' ? 'Editează tarif pe consum' : 'Adaugă tarif pe consum'}
        description="Tariful va calcula linii în draft pe baza consumului aprobat al contoarelor."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{associationBadge(association)}</Badge>
            <ButtonLink href="/admin/tariffs/meter-based" variant="secondary">Înapoi la tarife</ButtonLink>
            <Button onClick={submit} isLoading={saving}>
              <Save className="h-4 w-4" />
              Salvează
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {loading ? <SkeletonRows /> : null}

      {!loading ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Configurare tarif</h2>
              <p className="text-sm text-muted-foreground">Formula este transparentă: consum aprobat × preț per unitate.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nume tarif" value={form.name} onChange={(event) => patchForm({ name: event.target.value })} />
              <Input label="Cod intern" value={form.internalCode} onChange={(event) => patchForm({ internalCode: event.target.value })} />
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Tip contor</span>
                <select className={selectClassName()} value={form.meterType} onChange={(event) => changeMeterType(event.target.value as MeterType)}>
                  {Object.entries(meterTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Input label="Unitate" value={form.unit} onChange={(event) => patchForm({ unit: event.target.value })} />
              <Input label="Preț per unitate" type="number" value={form.pricePerUnit} onChange={(event) => patchForm({ pricePerUnit: event.target.value })} />
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Status</span>
                <select className={selectClassName()} value={form.status} onChange={(event) => patchForm({ status: event.target.value as TariffStatus })}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Activ</option>
                  <option value="INACTIVE">Inactiv</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Periodicitate</span>
                <select className={selectClassName()} value={form.periodicity} onChange={(event) => patchForm({ periodicity: event.target.value as Periodicity })}>
                  <option value="MONTHLY">Lunar</option>
                  <option value="ONE_TIME">O singură dată</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Aplicabilitate</span>
                <select className={selectClassName()} value={form.appliesTo} onChange={(event) => patchForm({ appliesTo: event.target.value as AppliesTo })}>
                  <option value="ALL_APARTMENTS">Toate apartamentele</option>
                  <option value="ONLY_OCCUPIED">Doar ocupate</option>
                  <option value="CUSTOM_SELECTION">Selecție custom</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Politică indici lipsă</span>
                <select className={selectClassName()} value={form.missingReadingPolicy} onChange={(event) => patchForm({ missingReadingPolicy: event.target.value as MissingReadingPolicy })}>
                  {Object.entries(policyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Input label="Activ din" type="date" value={form.startsAt} onChange={(event) => patchForm({ startsAt: event.target.value })} />
              <Input label="Activ până la" type="date" value={form.endsAt} onChange={(event) => patchForm({ endsAt: event.target.value })} />
            </div>
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              <span>Descriere</span>
              <textarea className="min-h-24 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10" value={form.description} onChange={(event) => patchForm({ description: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-foreground">
              <span>Note interne</span>
              <textarea className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10" value={form.internalNotes} onChange={(event) => patchForm({ internalNotes: event.target.value })} />
            </label>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold text-foreground">Opțiuni calcul</h2>
            <ToggleRow label="Include în estimare lunară" checked={form.includeInMonthlyEstimate} onChange={(checked) => patchForm({ includeInMonthlyEstimate: checked })} />
            <ToggleRow label="Include în draft facturi" checked={form.includeInDraftInvoices} onChange={(checked) => patchForm({ includeInDraftInvoices: checked })} />
            <ToggleRow label="Vizibil pentru locatari" checked={form.visibleToResidents} onChange={(checked) => patchForm({ visibleToResidents: checked })} />
            <ToggleRow label="Necesită indice aprobat" checked={form.requiresApprovedReading} onChange={(checked) => patchForm({ requiresApprovedReading: checked })} />
            <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <strong className="block text-foreground">Formulă</strong>
              Consum aprobat {form.unit || 'unitate'} × {Number(form.pricePerUnit || 0).toLocaleString('ro-RO')} MDL
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function MeterBasedTariffDetailPage() {
  const params = useParams<{ id?: string }>();
  const localizedPath = useLocalizedPath();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [tariff, setTariff] = useState<MeterBasedTariff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await tariffsApi.meterBasedGet(id);
      setTariff(res.data || null);
    } catch (err: any) {
      setError(String(err?.message || 'Tariful nu a fost găsit.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function duplicate() {
    if (!tariff) return;
    await tariffsApi.meterBasedDuplicate(tariff.id);
    await load();
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={tariff?.name || 'Tarif pe consum'}
        description="Detalii, impact și setări pentru calculul pe consum aprobat."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/admin/tariffs/meter-based" variant="secondary">Înapoi la tarife</ButtonLink>
            {tariff ? <ButtonLink href={`/admin/tariffs/meter-based/${tariff.id}/edit`} variant="secondary">Editează</ButtonLink> : null}
            {tariff ? <ButtonLink href={`/admin/invoices/draft/meter-charges-preview?tariffId=${tariff.id}`} variant="secondary">Previzualizează calcul</ButtonLink> : null}
            {tariff ? <Button onClick={duplicate} variant="secondary"><Copy className="h-4 w-4" />Duplicate</Button> : null}
          </div>
        }
      />

      {error ? <Card className="p-8 text-center"><h2 className="text-xl font-semibold">Tariful nu a fost găsit</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p></Card> : null}
      {loading ? <SkeletonRows /> : null}

      {!loading && tariff ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Preț/unitate" value={`${formatMdl(tariff.pricePerUnit)} / ${tariff.unit}`} description={meterTypeLabels[tariff.meterType]} icon={<Gauge className="h-5 w-5" />} />
            <StatCard label="Estimare lunară" value={formatMdl(Number(tariff.monthlyEstimate || tariff.impact?.estimatedAmount || 0))} description="Luna curentă" icon={<Calculator className="h-5 w-5" />} />
            <StatCard label="Apartamente calculate" value={tariff.impact?.calculatedApartments || 0} description="Cu indici aprobați" icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
            <StatCard label="Fără indici" value={tariff.impact?.apartmentsWithoutApprovedReadings || 0} description={policyLabels[tariff.missingReadingPolicy]} icon={<Droplets className="h-5 w-5" />} tone="warning" />
          </section>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="space-y-3 p-5">
              <h2 className="text-lg font-semibold text-foreground">Setări tarif</h2>
              <Info label="Status" value={<Badge variant={statusVariant[tariff.status]}>{statusLabels[tariff.status]}</Badge>} />
              <Info label="Tip contor" value={meterTypeLabels[tariff.meterType]} />
              <Info label="Unitate" value={tariff.unit} />
              <Info label="Periodicitate" value={tariff.periodicity === 'MONTHLY' ? 'Lunar' : 'O singură dată'} />
              <Info label="Aplicabilitate" value={appliesToLabels[tariff.appliesTo]} />
              <Info label="Include în draft" value={tariff.includeInDraftInvoices ? 'Da' : 'Nu'} />
              <Info label="Politică indici lipsă" value={policyLabels[tariff.missingReadingPolicy]} />
              <Info label="Actualizat" value={formatDate(tariff.updatedAt)} />
              {tariff.description ? <p className="rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground">{tariff.description}</p> : null}
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Impact lunar</h2>
                  <p className="text-sm text-muted-foreground">Primele apartamente calculate pentru luna curentă.</p>
                </div>
                <Badge variant="neutral">MDL</Badge>
              </div>
              {!tariff.previewItems?.length ? <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Nu există consum aprobat pentru această perioadă.</p> : null}
              <div className="space-y-2">
                {(tariff.previewItems || []).map((item) => (
                  <div key={`${item.apartment.id}-${item.meter.id}-${item.tariff.id}`} className="rounded-2xl border border-border/70 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>Apartament {item.apartment.apartmentNumber}</strong>
                      <span className="font-semibold">{formatMdl(item.amount)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{item.meter.meterNumber || item.meter.type} · {item.formulaLabel}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function MeterChargesPreviewPage() {
  const localizedPath = useLocalizedPath();
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [tariffId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('tariffId') || '';
  });
  const [meterType, setMeterType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [staircase, setStaircase] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [data, setData] = useState<MeterChargePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.meterChargesPreview({
        billingMonth,
        tariffId: tariffId || undefined,
        meterType,
        status,
        staircase: staircase || undefined,
        apartmentNumber: apartmentNumber || undefined,
        warningsOnly,
        limit: 50,
      });
      setData(res.data);
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca previzualizarea.'));
    } finally {
      setLoading(false);
    }
  }, [apartmentNumber, billingMonth, meterType, staircase, status, tariffId, warningsOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const totalsByType = data?.summary.totalApprovedConsumption || {};

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Previzualizare sume pe consum"
        description="Verifică sumele calculate pe baza indicilor aprobați înainte de includerea în draftul facturilor."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{associationBadge(data?.association)}</Badge>
            <ButtonLink href="/admin/tariffs/meter-based" variant="secondary">Tarife pe consum</ButtonLink>
            <ButtonLink href="/admin/meter-readings" variant="secondary">Vezi indici</ButtonLink>
            <Button onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <Card className="grid gap-3 p-4 md:grid-cols-6">
        <Input label="Luna" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
        <label className="space-y-1.5 text-sm font-medium text-foreground">
          <span>Tip contor</span>
          <select className={selectClassName()} value={meterType} onChange={(event) => setMeterType(event.target.value)}>
            <option value="ALL">Toate</option>
            {Object.entries(meterTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium text-foreground">
          <span>Status indici</span>
          <select className={selectClassName()} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">Toate</option>
            <option value="APPROVED">Aprobați</option>
            <option value="SUBMITTED">Transmiși</option>
            <option value="NEEDS_REVIEW">Needs review</option>
            <option value="REJECTED">Respinsi</option>
          </select>
        </label>
        <Input label="Scara" value={staircase} onChange={(event) => setStaircase(event.target.value)} />
        <Input label="Apartament" value={apartmentNumber} onChange={(event) => setApartmentNumber(event.target.value)} />
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-foreground">
          <input className={checkboxClassName()} type="checkbox" checked={warningsOnly} onChange={(event) => setWarningsOnly(event.target.checked)} />
          Doar avertizări
        </label>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tarife active" value={data?.summary.activeMeterTariffs || 0} description={billingMonth} icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Suma estimată" value={formatMdl(data?.summary.estimatedAmount || 0)} description="Pe consum aprobat" icon={<Calculator className="h-5 w-5" />} tone="success" />
        <StatCard label="Apartamente calculate" value={data?.summary.calculatedApartments || 0} description="Cu linii generate" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Fără indici aprobați" value={data?.summary.apartmentsWithoutApprovedReadings || 0} description="Necesită verificare" icon={<Droplets className="h-5 w-5" />} tone="warning" />
      </section>

      {Object.keys(totalsByType).length ? (
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Consum aprobat pe tip</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {Object.entries(totalsByType).map(([type, total]) => (
              <div key={type} className="rounded-2xl border border-border/70 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{meterTypeLabels[type as MeterType] || type}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(total.value, total.unit)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {loading ? <SkeletonRows /> : null}

      {!loading && data && !data.items.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Nu există consum aprobat pentru luna selectată</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Pentru a calcula sumele pe consum, trebuie să existe indici aprobați pentru contoarele apartamentelor.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <ButtonLink href="/admin/meter-readings" variant="secondary">Vezi indici</ButtonLink>
            <ButtonLink href="/admin/meter-readings/reports" variant="secondary">Vezi rapoarte consum</ButtonLink>
          </div>
        </Card>
      ) : null}

      {!loading && data?.items.length ? (
        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="hidden grid-cols-[0.85fr_0.65fr_0.9fr_0.95fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr_0.75fr_0.8fr_1.1fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground xl:grid">
            <span>Apartament</span>
            <span>Scara</span>
            <span>Contact</span>
            <span>Contor</span>
            <span>Anterior</span>
            <span>Curent</span>
            <span>Consum</span>
            <span>Tarif</span>
            <span>Preț/unitate</span>
            <span>Sumă</span>
            <span>Status</span>
            <span>Acțiuni</span>
          </div>
          {data.items.map((item, index) => (
            <div key={`${item.apartment.id}-${item.meter.id}-${item.tariff.id}-${index}`} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 xl:grid-cols-[0.85fr_0.65fr_0.9fr_0.95fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr_0.75fr_0.8fr_1.1fr] xl:items-center">
              <strong>Apt. {item.apartment.apartmentNumber}</strong>
              <span className="text-muted-foreground">{item.apartment.staircase || '—'}</span>
              <span className="text-muted-foreground">{item.primaryContact?.fullName || '—'}</span>
              <span className="text-muted-foreground">{item.meter.meterNumber || meterTypeLabels[item.meter.type]}</span>
              <span>{formatNumber(item.reading?.previousReadingValue, item.meter.unit)}</span>
              <span>{formatNumber(item.reading?.readingValue, item.meter.unit)}</span>
              <span className="font-medium">{formatNumber(item.reading?.consumptionValue, item.meter.unit)}</span>
              <span>{item.tariff.name}</span>
              <span>{formatMdl(item.tariff.pricePerUnit)}</span>
              <span className="font-semibold">{formatMdl(item.amount)}</span>
              <Badge variant={item.status === 'READY' ? 'success' : item.status === 'ERROR' ? 'error' : 'warning'}>{item.status === 'READY' ? 'Calculat' : item.status === 'ERROR' ? 'Eroare' : 'Avertizare'}</Badge>
              <div className="flex flex-wrap gap-1.5">
                {item.reading?.id ? <Link className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60" href={localizedPath(`/admin/meter-readings/${item.reading.id}`)}>Indice</Link> : null}
                <Link className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60" href={localizedPath(`/admin/meters/${item.meter.id}`)}>Contor</Link>
                <Link className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60" href={localizedPath(`/admin/apartments/${item.apartment.id}`)}>Apartament</Link>
              </div>
              {item.warnings.length ? <p className="xl:col-span-12 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{item.warnings.join(' ')}</p> : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-3 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input className={checkboxClassName()} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-[1.35rem] bg-muted" />
      ))}
    </div>
  );
}
