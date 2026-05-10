'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, CalendarDays, Eye, FileDown, FileText, Gauge, RefreshCw, Save, Trash2, TriangleAlert, WalletCards } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type DraftStatus = 'DRAFT' | 'LOCKED' | 'CANCELLED';
type LineStatus = 'READY' | 'WARNING' | 'ERROR' | 'EXCLUDED';
type CalculationType = 'PER_M2' | 'FIXED_PER_APARTMENT' | 'MANUAL' | 'PER_METER_CONSUMPTION';

type DraftLine = {
  id: string;
  lineType?: 'TARIFF' | 'MANUAL' | 'ADJUSTMENT' | 'METER_CONSUMPTION';
  tariffId: string | null;
  meterId?: string | null;
  meterReadingId?: string | null;
  meterType?: string | null;
  unit?: string | null;
  name: string;
  description: string;
  calculationType: CalculationType;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: 'MDL';
  formulaLabel: string;
  status: LineStatus;
  warnings: string[];
};

type DraftItem = {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  staircase: string;
  floor: string | null;
  areaM2: number | null;
  primaryContact: { id: string; fullName: string; phone: string | null } | null;
  lines: DraftLine[];
  total: number;
  status: LineStatus;
  warnings: string[];
  internalNotes?: string;
};

type DraftData = {
  id?: string;
  billingMonth: string;
  dueDate: string | null;
  description: string;
  status?: DraftStatus;
  invoicesGenerated?: boolean;
  finalizedAt?: string | null;
  currency: 'MDL';
  organization?: {
    shortName?: string;
    associationCode?: string;
    currency?: string;
  };
  summary: {
    billingMonth: string;
    currency: 'MDL';
    totalApartments: number;
    calculatedApartments: number;
    totalAmount: number;
    warningsCount: number;
    errorsCount: number;
    activeTariffsUsed: number;
    apartmentsWithoutArea: number;
    perM2Services: number;
    fixedServices: number;
    meterConsumptionServices?: number;
    meterConsumptionAmount?: number;
    apartmentsWithoutApprovedMeterReadings?: number;
    manualServicesExcluded: number;
  };
  tariffsUsed: Array<{ id: string; name: string; calculationType: CalculationType }>;
  items: DraftItem[];
  warnings: string[];
};

const emptyDraft: DraftData = {
  billingMonth: '',
  dueDate: null,
  description: '',
  currency: 'MDL',
  summary: {
    billingMonth: '',
    currency: 'MDL',
    totalApartments: 0,
    calculatedApartments: 0,
    totalAmount: 0,
    warningsCount: 0,
    errorsCount: 0,
    activeTariffsUsed: 0,
    apartmentsWithoutArea: 0,
    perM2Services: 0,
    fixedServices: 0,
    meterConsumptionServices: 0,
    meterConsumptionAmount: 0,
    apartmentsWithoutApprovedMeterReadings: 0,
    manualServicesExcluded: 0,
  },
  tariffsUsed: [],
  items: [],
  warnings: [],
};

const statusLabels: Record<LineStatus, string> = {
  READY: 'Gata',
  WARNING: 'Avertizare',
  ERROR: 'Eroare',
  EXCLUDED: 'Exclus',
};

const statusVariant = {
  READY: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  EXCLUDED: 'neutral',
} as const;

function currentBillingMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function defaultDueDate(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return '';
  return new Date(year, monthNumber - 1, 25).toISOString().slice(0, 10);
}

function recomputeDraft(data: DraftData): DraftData {
  const included = data.items.filter((item) => item.status !== 'EXCLUDED');
  const totalAmount = roundMoney(included.reduce((sum, item) => sum + item.total, 0));
  const warningsCount = data.items.filter((item) => item.status === 'WARNING').length;
  const errorsCount = data.items.filter((item) => item.status === 'ERROR').length;
  return {
    ...data,
    summary: {
      ...data.summary,
      totalAmount,
      calculatedApartments: included.filter((item) => item.status === 'READY' || item.status === 'WARNING').length,
      warningsCount,
      errorsCount,
    },
  };
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export default function AdminInvoiceDraftPage() {
  const localizedPath = useLocalizedPath();
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [dueDate, setDueDate] = useState(defaultDueDate(currentBillingMonth()));
  const [description, setDescription] = useState('');
  const [includeMeterCharges, setIncludeMeterCharges] = useState(true);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [calculated, setCalculated] = useState<DraftData | null>(null);
  const [selected, setSelected] = useState<DraftItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [lineAction, setLineAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const data = draft || calculated;

  const loadDraft = useCallback(async (month: string) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.draftGet({ billingMonth: month });
      const nextDraft = res.data?.draft || null;
      setDraft(nextDraft);
      setCalculated(null);
      if (nextDraft) {
        setDueDate(nextDraft.dueDate || defaultDueDate(month));
        setDescription(nextDraft.description || '');
        setIncludeMeterCharges(nextDraft.summary?.includeMeterCharges !== false);
      } else {
        setDueDate(defaultDueDate(month));
      }
    } catch (err: any) {
      setDraft(null);
      setCalculated(null);
      setError(String(err?.message || 'Nu am putut încărca draftul.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDraft(billingMonth);
  }, [billingMonth, loadDraft]);

  const badgeText = useMemo(() => {
    const org = data?.organization;
    return `${org?.shortName || 'A.P.C.'} · ${org?.associationCode || 'cod necompletat'} · MDL`;
  }, [data?.organization]);

  const validatePeriod = () => {
    if (!billingMonth.trim()) return 'Luna de facturare este obligatorie.';
    if (!/^\d{4}-\d{2}$/.test(billingMonth)) return 'Luna de facturare nu este validă.';
    if (dueDate && Number.isNaN(new Date(dueDate).getTime())) return 'Data scadentă nu este validă.';
    return '';
  };

  async function calculateDraft() {
    const validation = validatePeriod();
    if (validation) {
      setError(validation);
      return;
    }
    setCalculating(true);
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.draftCalculate({ billingMonth, dueDate: dueDate || null, description, includeMeterCharges });
      setCalculated(res.data || emptyDraft);
      setDraft(null);
      setMessage('Draftul a fost calculat. Nu au fost emise facturi finale.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut calcula draftul.'));
    } finally {
      setCalculating(false);
    }
  }

  async function saveDraft() {
    const validation = validatePeriod();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.draftSave({ billingMonth, dueDate: dueDate || null, description, includeMeterCharges });
      setDraft(res.data || null);
      setCalculated(null);
      setMessage('Draftul a fost salvat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva draftul.'));
    } finally {
      setSaving(false);
    }
  }

  async function recalculateDraft() {
    if (!draft?.id) {
      await calculateDraft();
      return;
    }
    setRecalculating(true);
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.draftRecalculate(draft.id, { billingMonth, dueDate: dueDate || null, description, includeMeterCharges });
      setDraft(res.data || null);
      setMessage('Draftul a fost recalculat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut recalcula draftul.'));
    } finally {
      setRecalculating(false);
    }
  }

  async function cancelDraft() {
    if (!draft?.id) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await invoicesApi.draftCancel(draft.id);
      setDraft(null);
      setCalculated(null);
      setMessage('Draftul a fost anulat. Nu au fost șterse facturi finale.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut anula draftul.'));
    } finally {
      setSaving(false);
    }
  }

  async function updateApartmentStatus(item: DraftItem, status: 'READY' | 'EXCLUDED') {
    if (draft?.id) {
      setLineAction(item.id);
      setError('');
      setMessage('');
      try {
        const res = await invoicesApi.draftUpdateLineStatus(draft.id, item.id, status);
        setDraft(res.data || null);
        setMessage(status === 'EXCLUDED' ? 'Apartamentul a fost exclus temporar din draft.' : 'Apartamentul a fost inclus înapoi în draft.');
      } catch (err: any) {
        setError(String(err?.message || 'Nu am putut actualiza statusul liniei.'));
      } finally {
        setLineAction('');
      }
      return;
    }

    setCalculated((current) => {
      if (!current) return current;
      return recomputeDraft({
        ...current,
        items: current.items.map((row) => (row.id === item.id ? { ...row, status } : row)),
      });
    });
  }

  const summary = data?.summary || emptyDraft.summary;
  const hasAreaWarning = Boolean(summary.apartmentsWithoutArea && summary.perM2Services);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Calcul draft facturi"
        description="Calculează sumele lunare estimate pentru apartamente pe baza tarifelor active."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{badgeText}</Badge>
            <Button type="button" variant="secondary" disabled title="Exportul va fi disponibil ulterior.">
              <FileDown className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {hasAreaWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Unele apartamente nu au suprafață completată. Tarifele per m² nu pot fi calculate pentru acestea.
        </div>
      ) : null}
      {data?.warnings?.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {data.warnings.join(' ')}
        </div>
      ) : null}

      <Card className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
          <Input label="Luna de facturare" type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
          <Input label="Data scadentă" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <Input label="Descriere" value={description} placeholder="Plata lunară pentru luna mai 2026" onChange={(event) => setDescription(event.target.value)} />
          <div className="flex flex-wrap items-end gap-2 lg:justify-end">
            <Button onClick={calculateDraft} isLoading={calculating}>
              <Calculator className="h-4 w-4" />
              Calculează draft
            </Button>
            <Button variant="secondary" onClick={saveDraft} isLoading={saving}>
              <Save className="h-4 w-4" />
              Salvează draft
            </Button>
            {draft?.id ? (
              <ButtonLink href={localizedPath(`/admin/invoices/draft/${draft.id}/review`)} variant="secondary">
                <Eye className="h-4 w-4" />
                {draft.status === 'LOCKED' ? 'Vezi draft blocat' : 'Revizuiește draft'}
              </ButtonLink>
            ) : null}
            {draft?.id && draft.status === 'LOCKED' && !draft.invoicesGenerated ? (
              <ButtonLink href={localizedPath(`/admin/invoices/finalize/${draft.id}`)}>
                Generează facturi finale
              </ButtonLink>
            ) : null}
            {draft?.invoicesGenerated ? (
              <ButtonLink href={localizedPath(`/admin/invoices?billingMonth=${draft.billingMonth}`)} variant="secondary">
                Vezi facturile generate
              </ButtonLink>
            ) : null}
            {draft?.id && draft.status === 'DRAFT' ? (
              <Button variant="secondary" onClick={recalculateDraft} isLoading={recalculating}>
                <RefreshCw className="h-4 w-4" />
                Recalculează
              </Button>
            ) : null}
            {draft?.id && draft.status === 'DRAFT' ? (
              <Button variant="danger" onClick={cancelDraft} disabled={saving}>
                <Trash2 className="h-4 w-4" />
                Șterge draft
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-foreground focus:ring-foreground/20"
              checked={includeMeterCharges}
              onChange={(event) => setIncludeMeterCharges(event.target.checked)}
            />
            Include tarife pe consum în draft
          </label>
          <ButtonLink href={localizedPath(`/admin/invoices/draft/meter-charges-preview?billingMonth=${billingMonth}`)} variant="secondary">
            <Gauge className="h-4 w-4" />
            Previzualizează sumele pe consum
          </ButtonLink>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        <StatCard label="Apartamente calculate" value={summary.calculatedApartments} description="Incluse în draft" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Total estimat" value={formatMdl(summary.totalAmount)} description="Nu este factură finală" icon={<Calculator className="h-5 w-5" />} />
        <StatCard label="Cu erori" value={summary.errorsCount} description="Necesită verificare" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.errorsCount ? 'danger' : 'neutral'} />
        <StatCard label="Fără suprafață" value={summary.apartmentsWithoutArea} description="Afectează per m²" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.apartmentsWithoutArea ? 'warning' : 'neutral'} />
        <StatCard label="Tarife active" value={summary.activeTariffsUsed} description="Folosite în calcul" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Consum contoare" value={formatMdl(Number(summary.meterConsumptionAmount || 0))} description={`${summary.meterConsumptionServices || 0} tarife pe consum`} icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Servicii per m²" value={summary.perM2Services} description="După suprafață" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Manuale excluse" value={summary.manualServicesExcluded} description="Nu se aplică automat" icon={<TriangleAlert className="h-5 w-5" />} tone={summary.manualServicesExcluded ? 'warning' : 'neutral'} />
      </section>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-24 animate-pulse bg-muted/40" />)}
        </div>
      ) : null}

      {!loading && !data ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Nu există draft calculat pentru această lună</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Selectează luna și apasă Calculează draft pentru a vedea sumele estimate pe apartamente.
          </p>
          <Button className="mt-5" onClick={calculateDraft} isLoading={calculating}>
            Calculează draft
          </Button>
        </Card>
      ) : null}

      {!loading && data ? (
        <>
          <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] xl:block">
            <div className="grid grid-cols-[0.85fr_0.6fr_0.55fr_0.75fr_1fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_0.8fr_1fr_1.3fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Apartament</span>
              <span>Scara</span>
              <span>Etaj</span>
              <span>Suprafață</span>
              <span>Contact principal</span>
              <span>Deservire bloc</span>
              <span>Fond reparație</span>
              <span>Fond investiții</span>
              <span>Alte servicii</span>
              <span>Total</span>
              <span>Status</span>
              <span>Avertizări</span>
              <span>Acțiuni</span>
            </div>
            {data.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[0.85fr_0.6fr_0.55fr_0.75fr_1fr_0.9fr_0.9fr_0.9fr_0.9fr_0.9fr_0.8fr_1fr_1.3fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
                <strong className="text-foreground">Apt. {item.apartmentNumber}</strong>
                <span className="text-muted-foreground">{item.staircase || '-'}</span>
                <span className="text-muted-foreground">{item.floor || '-'}</span>
                <span className="text-muted-foreground">{item.areaM2 ? `${item.areaM2} m²` : '-'}</span>
                <span className="text-muted-foreground">{item.primaryContact?.fullName || '-'}</span>
                <span>{formatMdl(lineAmount(item, 'Deservire'))}</span>
                <span>{formatMdl(lineAmount(item, 'repara'))}</span>
                <span>{formatMdl(lineAmount(item, 'invest'))}</span>
                <span>{formatMdl(otherServicesAmount(item))}</span>
                <strong className="text-foreground">{formatMdl(item.status === 'EXCLUDED' ? 0 : item.total)}</strong>
                <Badge variant={statusVariant[item.status]}>{statusLabels[item.status]}</Badge>
                <span className="text-xs text-muted-foreground">{item.warnings.length ? item.warnings.join(' ') : '-'}</span>
                <RowActions item={item} lineAction={lineAction} onOpen={() => setSelected(item)} onRecalculate={recalculateDraft} onStatus={updateApartmentStatus} />
              </div>
            ))}
          </section>

          <section className="grid gap-3 xl:hidden">
            {data.items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Apt. {item.apartmentNumber}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Scara {item.staircase || '-'} · Etaj {item.floor || '-'}</p>
                  </div>
                  <Badge variant={statusVariant[item.status]}>{statusLabels[item.status]}</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <Info label="Suprafață" value={item.areaM2 ? `${item.areaM2} m²` : '-'} />
                  <Info label="Contact principal" value={item.primaryContact?.fullName || '-'} />
                  <Info label="Total apartament" value={formatMdl(item.status === 'EXCLUDED' ? 0 : item.total)} strong />
                  <Info label="Avertizări" value={item.warnings.length ? item.warnings.join(' ') : '-'} />
                </div>
                <div className="mt-4">
                  <RowActions item={item} lineAction={lineAction} onOpen={() => setSelected(item)} onRecalculate={recalculateDraft} onStatus={updateApartmentStatus} />
                </div>
              </Card>
            ))}
          </section>
        </>
      ) : null}

      <DraftDetailsModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function RowActions({
  item,
  lineAction,
  onOpen,
  onRecalculate,
  onStatus,
}: {
  item: DraftItem;
  lineAction: string;
  onOpen: () => void;
  onRecalculate: () => void;
  onStatus: (item: DraftItem, status: 'READY' | 'EXCLUDED') => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={onOpen} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">
        <Eye className="mr-1 inline h-3.5 w-3.5" />
        Deschide
      </button>
      <button type="button" onClick={onRecalculate} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">
        Recalculează
      </button>
      <button
        type="button"
        onClick={() => onStatus(item, item.status === 'EXCLUDED' ? 'READY' : 'EXCLUDED')}
        disabled={lineAction === item.id}
        className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60 disabled:opacity-60"
      >
        {item.status === 'EXCLUDED' ? 'Include' : 'Exclude'}
      </button>
    </div>
  );
}

function DraftDetailsModal({ item, onClose }: { item: DraftItem | null; onClose: () => void }) {
  const localizedPath = useLocalizedPath();
  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} maxWidth="2xl">
      {item ? (
        <>
          <ModalHeader title={`Calcul apt. ${item.apartmentNumber}`} onClose={onClose} />
          <ModalBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Scara" value={item.staircase || '-'} />
              <Info label="Etaj" value={item.floor || '-'} />
              <Info label="Suprafață" value={item.areaM2 ? `${item.areaM2} m²` : '-'} />
              <Info label="Contact principal" value={item.primaryContact?.fullName || '-'} />
            </div>
            <div className="mt-4 space-y-2">
              {item.lines.map((line) => (
                <div key={line.id} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{line.name}</p>
                        {line.lineType === 'METER_CONSUMPTION' ? <Badge variant="neutral">Consum contor</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{line.formulaLabel} = {formatMdl(line.amount)}</p>
                      {line.lineType === 'METER_CONSUMPTION' ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                          {line.meterReadingId ? <Link className="text-primary hover:underline" href={localizedPath(`/admin/meter-readings/${line.meterReadingId}`)}>Vezi indicele</Link> : null}
                          {line.meterId ? <Link className="text-primary hover:underline" href={localizedPath(`/admin/meters/${line.meterId}`)}>Vezi contorul</Link> : null}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant={statusVariant[line.status]}>{statusLabels[line.status]}</Badge>
                  </div>
                  {line.warnings.length ? <p className="mt-2 text-xs font-medium text-amber-700">{line.warnings.join(' ')}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-4">
              <p className="text-sm text-muted-foreground">Total apartament</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{formatMdl(item.status === 'EXCLUDED' ? 0 : item.total)}</p>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
              {item.internalNotes || 'Nu există note interne pentru acest calcul.'}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={onClose}>Închide</Button>
          </ModalFooter>
        </>
      ) : null}
    </Modal>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{value}</span>
    </div>
  );
}

function lineAmount(item: DraftItem, needle: string) {
  const normalizedNeedle = needle.toLowerCase();
  return item.lines.find((line) => line.name.toLowerCase().includes(normalizedNeedle))?.amount || 0;
}

function otherServicesAmount(item: DraftItem) {
  return roundMoney(
    item.lines
      .filter((line) => {
        const name = line.name.toLowerCase();
        return !name.includes('deservire') && !name.includes('repara') && !name.includes('invest');
      })
      .reduce((sum, line) => sum + line.amount, 0),
  );
}
