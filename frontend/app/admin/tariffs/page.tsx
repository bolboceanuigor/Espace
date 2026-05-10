'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Pencil, Plus, Power, Ruler, WalletCards } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { tariffsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type CalculationType = 'PER_M2' | 'FIXED_PER_APARTMENT' | 'MANUAL';
type TariffStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
type Periodicity = 'MONTHLY' | 'ONE_TIME';
type AppliesTo = 'ALL_APARTMENTS' | 'ONLY_OCCUPIED' | 'CUSTOM_SELECTION';

type Tariff = {
  id: string;
  name: string;
  internalCode: string;
  description: string;
  calculationType: CalculationType;
  pricePerM2: number | null;
  fixedAmount: number | null;
  defaultManualAmount: number | null;
  amount: number;
  currency: 'MDL';
  periodicity: Periodicity;
  status: TariffStatus;
  appliesTo: AppliesTo;
  includeInMonthlyEstimate: boolean;
  visibleToResidents: boolean;
  startsAt: string | null;
  endsAt: string | null;
  monthlyEstimate: number;
  affectedApartments: number;
  unit: string;
  updatedAt: string;
  internalNotes?: string;
};

type TariffResponse = {
  organization?: {
    shortName?: string;
    associationCode?: string;
    currency?: string;
  };
  items: Tariff[];
  stats: {
    activeTariffs: number;
    inactiveTariffs: number;
    perM2Services: number;
    fixedServices: number;
    estimatedMonthlyTotal: number;
    apartmentsWithoutArea: number;
  };
};

const emptyData: TariffResponse = {
  items: [],
  stats: {
    activeTariffs: 0,
    inactiveTariffs: 0,
    perM2Services: 0,
    fixedServices: 0,
    estimatedMonthlyTotal: 0,
    apartmentsWithoutArea: 0,
  },
};

const emptyForm = {
  name: '',
  internalCode: '',
  description: '',
  calculationType: 'PER_M2' as CalculationType,
  pricePerM2: '',
  fixedAmount: '',
  defaultManualAmount: '',
  periodicity: 'MONTHLY' as Periodicity,
  status: 'DRAFT' as TariffStatus,
  appliesTo: 'ALL_APARTMENTS' as AppliesTo,
  includeInMonthlyEstimate: true,
  visibleToResidents: true,
  startsAt: '',
  endsAt: '',
  internalNotes: '',
};

const typeLabels: Record<CalculationType, string> = {
  PER_M2: 'Per m²',
  FIXED_PER_APARTMENT: 'Fix per apartament',
  MANUAL: 'Manual / custom',
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

const periodicityLabels: Record<Periodicity, string> = {
  MONTHLY: 'Lunar',
  ONE_TIME: 'O singură dată',
};

const appliesToLabels: Record<AppliesTo, string> = {
  ALL_APARTMENTS: 'Toate apartamentele',
  ONLY_OCCUPIED: 'Doar ocupate',
  CUSTOM_SELECTION: 'Selecție custom',
};

export default function AdminTariffsPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<TariffResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [details, setDetails] = useState<Tariff | null>(null);
  const [editing, setEditing] = useState<Tariff | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTariffs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tariffsApi.list();
      setData(res.data || emptyData);
    } catch (err: any) {
      setData(emptyData);
      setError(String(err?.message || 'Nu am putut încărca tarifele.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTariffs();
  }, [loadTariffs]);

  const badgeText = useMemo(() => {
    const shortName = data.organization?.shortName || 'A.P.C.';
    const code = data.organization?.associationCode || 'cod necompletat';
    return `${shortName} · ${code} · MDL`;
  }, [data.organization]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(row: Tariff) {
    setEditing(row);
    setForm({
      name: row.name,
      internalCode: row.internalCode || '',
      description: row.description || '',
      calculationType: row.calculationType,
      pricePerM2: row.pricePerM2 === null || row.pricePerM2 === undefined ? '' : String(row.pricePerM2),
      fixedAmount: row.fixedAmount === null || row.fixedAmount === undefined ? '' : String(row.fixedAmount),
      defaultManualAmount: row.defaultManualAmount === null || row.defaultManualAmount === undefined ? '' : String(row.defaultManualAmount),
      periodicity: row.periodicity,
      status: row.status,
      appliesTo: row.appliesTo,
      includeInMonthlyEstimate: row.includeInMonthlyEstimate,
      visibleToResidents: row.visibleToResidents,
      startsAt: row.startsAt || '',
      endsAt: row.endsAt || '',
      internalNotes: row.internalNotes || '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function validateForm() {
    if (!form.name.trim()) return 'Numele tarifului este obligatoriu.';
    if (form.calculationType === 'PER_M2') {
      const value = Number(form.pricePerM2);
      if (!Number.isFinite(value) || value <= 0) return 'Valoarea per m² trebuie să fie pozitivă.';
    }
    if (form.calculationType === 'FIXED_PER_APARTMENT') {
      const value = Number(form.fixedAmount);
      if (!Number.isFinite(value) || value <= 0) return 'Suma fixă trebuie să fie pozitivă.';
    }
    if (form.defaultManualAmount.trim()) {
      const value = Number(form.defaultManualAmount);
      if (!Number.isFinite(value) || value < 0) return 'Suma manuală trebuie să fie pozitivă.';
    }
    if (form.startsAt && form.endsAt && new Date(form.startsAt) > new Date(form.endsAt)) return 'Data activării nu poate fi după data finală.';
    return '';
  }

  async function saveTariff() {
    setFormError('');
    setSuccess('');
    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        internalCode: form.internalCode.trim(),
        description: form.description.trim(),
        calculationType: form.calculationType,
        pricePerM2: form.calculationType === 'PER_M2' ? Number(form.pricePerM2) : null,
        fixedAmount: form.calculationType === 'FIXED_PER_APARTMENT' ? Number(form.fixedAmount) : null,
        defaultManualAmount: form.defaultManualAmount.trim() ? Number(form.defaultManualAmount) : null,
        currency: 'MDL' as const,
        periodicity: form.periodicity,
        status: form.status,
        appliesTo: form.appliesTo,
        includeInMonthlyEstimate: form.includeInMonthlyEstimate,
        visibleToResidents: form.visibleToResidents,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        internalNotes: form.internalNotes.trim(),
      };
      if (editing) {
        await tariffsApi.update(editing.id, payload);
      } else {
        await tariffsApi.create(payload);
      }
      setFormOpen(false);
      setSuccess('Tariful a fost salvat.');
      await loadTariffs();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva tariful.'));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row: Tariff, status: TariffStatus) {
    setError('');
    setSuccess('');
    try {
      await tariffsApi.updateStatus(row.id, status);
      setSuccess(status === 'ACTIVE' ? 'Tariful a fost activat.' : 'Tariful a fost dezactivat.');
      await loadTariffs();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva statusul tarifului.'));
    }
  }

  async function duplicate(row: Tariff) {
    setError('');
    setSuccess('');
    try {
      await tariffsApi.duplicate(row.id);
      setSuccess('Tariful a fost duplicat ca draft.');
      await loadTariffs();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut duplica tariful.'));
    }
  }

  async function createDefaults() {
    setError('');
    setSuccess('');
    try {
      const res = await tariffsApi.createDefaults();
      setSuccess(res.data?.createdCount ? 'Tarifele recomandate au fost create.' : 'Tarifele recomandate există deja.');
      await loadTariffs();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut crea tarifele recomandate.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Tarife și servicii"
        description="Configurează tarifele folosite pentru calcularea plăților lunare ale asociației."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{badgeText}</Badge>
            <Link href={localizedPath('/admin/tariffs/preview')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/70">
              <Calculator className="h-4 w-4" />
              Previzualizare calcul
            </Link>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Adaugă tarif
            </Button>
          </div>
        }
      />

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Tarife active" value={data.stats.activeTariffs} description="Servicii folosite" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={data.stats.inactiveTariffs} description="Păstrate ca istoric" icon={<Power className="h-5 w-5" />} tone="warning" />
        <StatCard label="Servicii per m²" value={data.stats.perM2Services} description="După suprafață" icon={<Ruler className="h-5 w-5" />} />
        <StatCard label="Fix per apartament" value={data.stats.fixedServices} description="Sume lunare fixe" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Total estimat lunar" value={formatMdl(data.stats.estimatedMonthlyTotal)} description="Fără facturi create" icon={<Calculator className="h-5 w-5" />} />
        <StatCard label="Fără suprafață" value={data.stats.apartmentsWithoutArea} description="Afectează per m²" icon={<Ruler className="h-5 w-5" />} tone="warning" />
      </section>

      {loading ? <TariffSkeleton /> : null}

      {!loading && !data.items.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Nu există tarife configurate</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Configurează tarifele lunare ale asociației pentru a pregăti calcularea facturilor interne.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={openCreate}>Adaugă tarif</Button>
            <Button variant="secondary" onClick={createDefaults}>Creează tarife recomandate</Button>
          </div>
        </Card>
      ) : null}

      {!loading && data.items.length ? (
        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="hidden grid-cols-[1.2fr_0.9fr_1fr_0.85fr_0.6fr_0.8fr_0.8fr_1fr_0.9fr_1.5fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Nume tarif</span>
            <span>Cod intern</span>
            <span>Tip calcul</span>
            <span>Valoare</span>
            <span>Monedă</span>
            <span>Periodicitate</span>
            <span>Status</span>
            <span>Aplicabilitate</span>
            <span>Actualizat</span>
            <span>Acțiuni</span>
          </div>
          {data.items.map((row) => (
            <div key={row.id} className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[1.2fr_0.9fr_1fr_0.85fr_0.6fr_0.8fr_0.8fr_1fr_0.9fr_1.5fr] lg:items-center">
              <div>
                <strong className="text-foreground">{row.name}</strong>
                <p className="mt-1 text-xs text-muted-foreground lg:hidden">{typeLabels[row.calculationType]} · {formatTariffValue(row)}</p>
              </div>
              <span className="text-muted-foreground">{row.internalCode || '-'}</span>
              <span className="text-muted-foreground">{typeLabels[row.calculationType]}</span>
              <span className="font-medium text-foreground">{formatTariffValue(row)}</span>
              <span className="text-muted-foreground">MDL</span>
              <span className="text-muted-foreground">{periodicityLabels[row.periodicity]}</span>
              <Badge variant={statusVariant[row.status]}>{statusLabels[row.status]}</Badge>
              <span className="text-muted-foreground">{appliesToLabels[row.appliesTo]}</span>
              <span className="text-muted-foreground">{formatDate(row.updatedAt)}</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setDetails(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Deschide</button>
                <button type="button" onClick={() => openEdit(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Editează</button>
                <button type="button" onClick={() => updateStatus(row, row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">
                  {row.status === 'ACTIVE' ? 'Dezactivează' : 'Activează'}
                </button>
                <button type="button" onClick={() => duplicate(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Duplicate</button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <TariffFormModal
        open={formOpen}
        title={editing ? 'Editează tarif' : 'Adaugă tarif'}
        form={form}
        error={formError}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onChange={setForm}
        onSave={saveTariff}
      />

      <TariffDetailsModal tariff={details} onClose={() => setDetails(null)} onEdit={(row) => { setDetails(null); openEdit(row); }} />
    </div>
  );
}

function TariffFormModal({
  open,
  title,
  form,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  title: string;
  form: typeof emptyForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Nume tarif" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          <Input label="Cod intern" value={form.internalCode} onChange={(event) => onChange({ ...form, internalCode: event.target.value })} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Tip calcul</span>
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.calculationType} onChange={(event) => onChange({ ...form, calculationType: event.target.value as CalculationType })}>
              <option value="PER_M2">Per m²</option>
              <option value="FIXED_PER_APARTMENT">Fix per apartament</option>
              <option value="MANUAL">Manual / custom</option>
            </select>
          </label>
          {form.calculationType === 'PER_M2' ? <Input label="Valoare MDL/m²" type="number" value={form.pricePerM2} onChange={(event) => onChange({ ...form, pricePerM2: event.target.value })} /> : null}
          {form.calculationType === 'FIXED_PER_APARTMENT' ? <Input label="Sumă fixă MDL/apartament" type="number" value={form.fixedAmount} onChange={(event) => onChange({ ...form, fixedAmount: event.target.value })} /> : null}
          {form.calculationType === 'MANUAL' ? <Input label="Sumă manuală default" type="number" value={form.defaultManualAmount} onChange={(event) => onChange({ ...form, defaultManualAmount: event.target.value })} /> : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Periodicitate</span>
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.periodicity} onChange={(event) => onChange({ ...form, periodicity: event.target.value as Periodicity })}>
              <option value="MONTHLY">Lunar</option>
              <option value="ONE_TIME">O singură dată</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as TariffStatus })}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Activ</option>
              <option value="INACTIVE">Inactiv</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Aplicabilitate</span>
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.appliesTo} onChange={(event) => onChange({ ...form, appliesTo: event.target.value as AppliesTo })}>
              <option value="ALL_APARTMENTS">Toate apartamentele</option>
              <option value="ONLY_OCCUPIED">Doar ocupate</option>
              <option value="CUSTOM_SELECTION">Selecție custom</option>
            </select>
          </label>
          <Input label="Data activării" type="date" value={form.startsAt} onChange={(event) => onChange({ ...form, startsAt: event.target.value })} />
          <Input label="Data finală" type="date" value={form.endsAt} onChange={(event) => onChange({ ...form, endsAt: event.target.value })} />
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Descriere</span>
            <textarea className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-medium">
            <input type="checkbox" checked={form.includeInMonthlyEstimate} onChange={(event) => onChange({ ...form, includeInMonthlyEstimate: event.target.checked })} />
            Include în estimarea lunară
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-medium">
            <input type="checkbox" checked={form.visibleToResidents} onChange={(event) => onChange({ ...form, visibleToResidents: event.target.checked })} />
            Vizibil locatarilor
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Note interne</span>
            <textarea className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={form.internalNotes} onChange={(event) => onChange({ ...form, internalNotes: event.target.value })} />
          </label>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Această configurare pregătește calculul intern. Nu se generează facturi și nu se procesează plăți din acest pas.</p>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={onClose}>Anulează</Button>
        <Button isLoading={saving} onClick={onSave}>Salvează tarif</Button>
      </ModalFooter>
    </Modal>
  );
}

function TariffDetailsModal({ tariff, onClose, onEdit }: { tariff: Tariff | null; onClose: () => void; onEdit: (tariff: Tariff) => void }) {
  return (
    <Modal isOpen={Boolean(tariff)} onClose={onClose} maxWidth="2xl">
      {tariff ? (
        <>
          <ModalHeader title={tariff.name} onClose={onClose} />
          <ModalBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoLine label="Tip calcul" value={typeLabels[tariff.calculationType]} />
              <InfoLine label="Valoare" value={formatTariffValue(tariff)} />
              <InfoLine label="Status" value={statusLabels[tariff.status]} />
              <InfoLine label="Periodicitate" value={periodicityLabels[tariff.periodicity]} />
              <InfoLine label="Aplicabilitate" value={appliesToLabels[tariff.appliesTo]} />
              <InfoLine label="Estimare lunară" value={formatMdl(tariff.monthlyEstimate)} />
              <InfoLine label="Apartamente afectate" value={String(tariff.affectedApartments)} />
              <InfoLine label="Ultima actualizare" value={formatDate(tariff.updatedAt)} />
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
              {tariff.description || 'Nu există descriere pentru acest tarif.'}
            </p>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
              {tariff.internalNotes || 'Nu există note interne pentru acest tarif.'}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={onClose}>Închide</Button>
            <Button onClick={() => onEdit(tariff)}>
              <Pencil className="h-4 w-4" />
              Editează
            </Button>
          </ModalFooter>
        </>
      ) : null}
    </Modal>
  );
}

function TariffSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => <Card key={item} className="h-24 animate-pulse bg-muted/40" />)}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatTariffValue(row: Tariff) {
  if (row.calculationType === 'PER_M2') return `${Number(row.pricePerM2 || 0).toLocaleString('ro-RO')} MDL/m²`;
  if (row.calculationType === 'FIXED_PER_APARTMENT') return `${formatMdl(Number(row.fixedAmount || 0))}/apartament`;
  return row.defaultManualAmount ? `${formatMdl(Number(row.defaultManualAmount))} default` : 'Manual';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO');
}
