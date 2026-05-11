'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Gauge,
  History,
  ListChecks,
  Plus,
  RefreshCw,
  Send,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { adminApartmentsCrmApi, metersApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const meterTypes = [
  { value: 'COLD_WATER', label: 'Apă rece', unit: 'm³' },
  { value: 'HOT_WATER', label: 'Apă caldă', unit: 'm³' },
  { value: 'ELECTRICITY', label: 'Electricitate', unit: 'kWh' },
  { value: 'GAS', label: 'Gaz', unit: 'm³' },
  { value: 'HEAT', label: 'Căldură', unit: 'Gcal' },
  { value: 'OTHER', label: 'Altul', unit: 'unit' },
];

const readingStatuses: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  SUBMITTED: { label: 'În așteptare', variant: 'warning' },
  APPROVED: { label: 'Aprobat', variant: 'success' },
  REJECTED: { label: 'Respins', variant: 'error' },
  NEEDS_REVIEW: { label: 'Necesită verificare', variant: 'warning' },
  CANCELLED: { label: 'Anulat', variant: 'neutral' },
};

const meterStatuses: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  ACTIVE: { label: 'Activ', variant: 'success' },
  INACTIVE: { label: 'Inactiv', variant: 'neutral' },
  REPLACED: { label: 'Înlocuit', variant: 'warning' },
  ARCHIVED: { label: 'Arhivat', variant: 'neutral' },
  MISSING_READING: { label: 'Lipsă citire', variant: 'warning' },
  SUSPICIOUS: { label: 'Suspect', variant: 'error' },
};

function useRouteId() {
  const params = useParams<{ id?: string }>();
  return typeof params?.id === 'string' ? params.id : '';
}

function formatMoney(value: unknown, unit = 'MDL') {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(number)} ${unit}`;
}

function formatValue(value: unknown, unit?: string | null) {
  if (value === null || value === undefined || value === '') return 'Necompletat';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 3 }).format(number)}${unit ? ` ${unit}` : ''}`;
}

function formatDate(value: unknown) {
  if (!value) return 'Necompletat';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Necompletat';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function statusBadge(status?: string, kind: 'meter' | 'reading' = 'reading') {
  const map = kind === 'meter' ? meterStatuses : readingStatuses;
  const item = map[String(status || '').toUpperCase()] || { label: status || 'Necunoscut', variant: 'neutral' as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none transition focus:border-foreground/20 focus:ring-2 focus:ring-foreground/10"
      >
        {children}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground/20 focus:ring-2 focus:ring-foreground/10"
      />
    </label>
  );
}

function LoadingCard() {
  return (
    <Card className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
    </Card>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <Gauge className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </Card>
  );
}

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{message}</div>;
}

function MeterCard({ meter, children }: { meter: any; children?: React.ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meter.typeLabel || 'Contor'}</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{meter.label || meter.meterNumber || 'Contor'}</h3>
          <p className="text-sm text-muted-foreground">
            Apartament {meter.apartment?.apartmentNumber || 'Necompletat'}
            {meter.apartment?.staircase ? `, scara ${meter.apartment.staircase}` : ''}
          </p>
        </div>
        {statusBadge(meter.status, 'meter')}
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <Info label="Număr contor" value={meter.meterNumber || 'Necompletat'} />
        <Info label="Unitate" value={meter.unit || 'Necompletat'} />
        <Info
          label="Ultimul indice aprobat"
          value={meter.lastApprovedReading ? `${formatValue(meter.lastApprovedReading.readingValue, meter.unit)} (${meter.lastApprovedReading.periodMonth})` : 'Primul indice'}
        />
      </div>
      {children}
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ReadingRow({ reading, admin = false, onAction }: { reading: any; admin?: boolean; onAction?: () => void }) {
  const localizedPath = useLocalizedPath();
  const href = admin ? `/admin/meter-readings/${reading.id}` : `/resident/meter-readings/${reading.id}`;
  return (
    <div className="grid gap-3 border-b border-border/70 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_120px]">
      <div>
        <Link href={localizedPath(href)} className="font-semibold text-foreground hover:text-primary">
          {reading.periodMonth}
        </Link>
        <p className="text-xs text-muted-foreground">
          {reading.apartment?.apartmentNumber ? `Ap. ${reading.apartment.apartmentNumber}` : 'Apartament necompletat'}
        </p>
      </div>
      <div>
        <p className="font-medium text-foreground">{reading.meter?.typeLabel || 'Contor'}</p>
        <p className="text-xs text-muted-foreground">{reading.meter?.meterNumber || 'Fără număr'}</p>
      </div>
      <div>{formatValue(reading.previousReadingValue, reading.unit)}</div>
      <div>{formatValue(reading.readingValue, reading.unit)}</div>
      <div>{formatValue(reading.consumptionValue, reading.unit)}</div>
      <div className="flex items-center justify-between gap-2">
        {statusBadge(reading.status)}
        {onAction ? (
          <Button variant="ghost" size="sm" onClick={onAction}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminMetersPage() {
  const searchParams = useSearchParams();
  const apartmentIdFromQuery = searchParams.get('apartmentId') || '';
  const [data, setData] = useState<any>(null);
  const [apartments, setApartments] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ apartmentId: '', type: 'COLD_WATER', meterNumber: '', label: '', unit: 'm³', location: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [metersRes, apartmentsRes] = await Promise.all([
        metersApi.adminList({ search: query, status, type, apartmentId: apartmentIdFromQuery, limit: 100 }),
        adminApartmentsCrmApi.list({ limit: 500 }),
      ]);
      const apartmentItems = apartmentsRes.data?.items || apartmentsRes.data || [];
      setData(metersRes.data);
      setApartments(apartmentItems);
      setForm((current) => ({ ...current, apartmentId: current.apartmentId || apartmentItems[0]?.id || '' }));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca contoarele.'));
    } finally {
      setLoading(false);
    }
  }, [apartmentIdFromQuery, query, status, type]);

  useEffect(() => {
    load();
  }, [load]);

  const createMeter = async () => {
    setSaving(true);
    setError('');
    try {
      await metersApi.adminCreate(form);
      setModalOpen(false);
      setForm({ apartmentId: apartments[0]?.id || '', type: 'COLD_WATER', meterNumber: '', label: '', unit: 'm³', location: '' });
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut crea contorul.'));
    } finally {
      setSaving(false);
    }
  };

  const stats = data?.stats || {};
  const items = data?.items || [];

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Contoare"
        description="Gestionează contoarele apartamentelor din asociație."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/meter-readings/reports" variant="secondary">
              <History className="h-4 w-4" />
              Rapoarte consum
            </ButtonLink>
            <ButtonLink href="/admin/meter-readings" variant="secondary">
              <ListChecks className="h-4 w-4" />
              Vezi indici transmiși
            </ButtonLink>
            <ButtonLink href="/admin/imports/meters" variant="secondary">
              <UploadCloud className="h-4 w-4" />
              Importă contoare
            </ButtonLink>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Adaugă contor
            </Button>
          </div>
        }
      />

      <InlineError message={error} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contoare" value={String(stats.totalMeters || 0)} description="În asociație" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Contoare active" value={String(stats.activeMeters || 0)} description="Disponibile pentru indici" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Apă rece" value={String(stats.coldWater || 0)} description="Contoare apă rece" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Apartamente fără contoare" value={String(stats.apartmentsWithoutMeters || 0)} description="Necesită configurare" icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
      </section>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
          <Input label="Caută" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Număr contor, apartament, scară" />
          <SelectField label="Tip" value={type} onChange={setType}>
            <option value="">Toate</option>
            {meterTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" value={status} onChange={setStatus}>
            <option value="">Toate</option>
            {Object.entries(meterStatuses).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <div className="flex items-end">
            <Button variant="secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingCard />
          <LoadingCard />
        </div>
      ) : items.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((meter: any) => (
            <MeterCard key={meter.id} meter={meter}>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/admin/meters/${meter.id}`} variant="secondary" size="sm">
                  <Eye className="h-4 w-4" />
                  Deschide
                </ButtonLink>
                <ButtonLink href={`/admin/meter-readings?meterId=${meter.id}`} variant="ghost" size="sm">
                  <History className="h-4 w-4" />
                  Indici
                </ButtonLink>
              </div>
            </MeterCard>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nu există contoare"
          text="Adaugă contoarele apartamentelor pentru a putea colecta indicii lunar."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/admin/imports/meters" variant="secondary">Importă contoare</ButtonLink>
              <Button onClick={() => setModalOpen(true)}>Adaugă contor</Button>
            </div>
          }
        />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Adaugă contor" onClose={() => setModalOpen(false)} />
        <ModalBody className="space-y-4">
          <SelectField label="Apartament" value={form.apartmentId} onChange={(value) => setForm((current) => ({ ...current, apartmentId: value }))}>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                Ap. {apartment.apartmentNumber || apartment.number}
                {apartment.staircase ? `, scara ${apartment.staircase}` : ''}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Tip"
              value={form.type}
              onChange={(value) => {
                const item = meterTypes.find((candidate) => candidate.value === value);
                setForm((current) => ({ ...current, type: value, unit: item?.unit || current.unit }));
              }}
            >
              {meterTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            <Input label="Unitate" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} />
            <Input label="Număr contor" value={form.meterNumber} onChange={(event) => setForm((current) => ({ ...current, meterNumber: event.target.value }))} />
            <Input label="Etichetă" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Contor baie" />
          </div>
          <Input label="Locație" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Baie, bucătărie, hol" />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Anulează
          </Button>
          <Button onClick={createMeter} isLoading={saving} disabled={!form.apartmentId || !form.type}>
            Salvează contor
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export function AdminMeterDetailPage() {
  const id = useRouteId();
  const [meter, setMeter] = useState<any>(null);
  const [editForm, setEditForm] = useState({ meterNumber: '', label: '', unit: '', location: '', status: 'ACTIVE' });
  const [readingValue, setReadingValue] = useState('');
  const [periodMonth, setPeriodMonth] = useState(currentMonth());
  const [adminComment, setAdminComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await metersApi.adminGet(id);
      setMeter(response.data);
      setEditForm({
        meterNumber: response.data?.meterNumber || '',
        label: response.data?.label || '',
        unit: response.data?.unit || '',
        location: response.data?.location || '',
        status: response.data?.status || 'ACTIVE',
      });
    } catch (err: any) {
      setError(String(err?.message || 'Contorul nu a fost găsit.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitManualReading = async () => {
    setError('');
    try {
      await metersApi.adminCreateReading({
        meterId: id,
        periodMonth,
        readingValue: Number(readingValue),
        adminComment,
        status: 'APPROVED',
      });
      setReadingValue('');
      setAdminComment('');
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut adăuga indicele.'));
    }
  };

  const saveMeter = async () => {
    setError('');
    try {
      await metersApi.adminUpdate(id, editForm);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva contorul.'));
    }
  };

  if (loading) return <LoadingCard />;
  if (!meter) {
    return <EmptyState title="Contorul nu a fost găsit" text="Contorul nu există sau nu aparține asociației tale." action={<ButtonLink href="/admin/meters">Înapoi la contoare</ButtonLink>} />;
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title={meter.label || meter.meterNumber || 'Contor'}
        description={`Apartament ${meter.apartment?.apartmentNumber || 'Necompletat'} • ${meter.typeLabel}`}
        rightSlot={
          <ButtonLink href="/admin/meters" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Înapoi
          </ButtonLink>
        }
      />
      <InlineError message={error} />
      <MeterCard meter={meter} />
      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Editare contor</h2>
          <p className="text-sm text-muted-foreground">Actualizează eticheta, numărul, unitatea sau statusul contorului.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Număr contor" value={editForm.meterNumber} onChange={(event) => setEditForm((current) => ({ ...current, meterNumber: event.target.value }))} />
          <Input label="Etichetă" value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
          <Input label="Unitate" value={editForm.unit} onChange={(event) => setEditForm((current) => ({ ...current, unit: event.target.value }))} />
          <SelectField label="Status" value={editForm.status} onChange={(value) => setEditForm((current) => ({ ...current, status: value }))}>
            <option value="ACTIVE">Activ</option>
            <option value="INACTIVE">Inactiv</option>
            <option value="REPLACED">Înlocuit</option>
            <option value="ARCHIVED">Arhivat</option>
          </SelectField>
        </div>
        <Input label="Locație" value={editForm.location} onChange={(event) => setEditForm((current) => ({ ...current, location: event.target.value }))} />
        <Button onClick={saveMeter}>
          Salvează contor
        </Button>
      </Card>
      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Adaugă indice manual</h2>
          <p className="text-sm text-muted-foreground">Indicele se salvează ca APPROVED și nu generează facturi.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Perioadă" type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} />
          <Input label={`Indice (${meter.unit || ''})`} type="number" min="0" step="0.001" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} />
          <Input label="Comentariu admin" value={adminComment} onChange={(event) => setAdminComment(event.target.value)} />
        </div>
        <Button onClick={submitManualReading} disabled={!readingValue}>
          <Plus className="h-4 w-4" />
          Adaugă indice
        </Button>
      </Card>
      <Card noPadding>
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="font-semibold text-foreground">Istoric indici</h2>
        </div>
        {(meter.readings || []).length ? (
          meter.readings.map((reading: any) => <ReadingRow key={reading.id} reading={reading} admin />)
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Nu există indici pentru acest contor.</div>
        )}
      </Card>
    </div>
  );
}

export function AdminMeterReadingsPage() {
  const searchParams = useSearchParams();
  const initialMeterId = searchParams.get('meterId') || '';
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [periodMonth, setPeriodMonth] = useState(currentMonth());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await metersApi.adminReadings({
        status,
        periodMonth,
        search,
        meterId: initialMeterId,
        limit: 100,
      });
      setData(response.data);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca indicii.'));
    } finally {
      setLoading(false);
    }
  }, [initialMeterId, periodMonth, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    await metersApi.adminApproveReading(id, {});
    await load();
  };
  const needsReview = async (id: string) => {
    await metersApi.adminNeedsReviewReading(id, {});
    await load();
  };
  const reject = async (id: string) => {
    const reason = window.prompt('Motiv respingere');
    if (!reason) return;
    await metersApi.adminRejectReading(id, { rejectionReason: reason });
    await load();
  };

  const stats = data?.stats || {};
  const items = data?.items || [];
  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Indici contoare"
        description="Verifică și aprobă indicii transmiși de locatari."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/meter-readings/reports" variant="secondary">
              <History className="h-4 w-4" />
              Vezi raport consum
            </ButtonLink>
            <ButtonLink href="/admin/meters" variant="secondary">
              <Gauge className="h-4 w-4" />
              Contoare
            </ButtonLink>
            <ButtonLink href="/admin/imports/meter-readings" variant="secondary">
              <UploadCloud className="h-4 w-4" />
              Importă indici
            </ButtonLink>
          </div>
        }
      />
      <InlineError message={error} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="În așteptare" value={String(stats.submitted || 0)} description="Indici transmiși" icon={<Send className="h-5 w-5" />} tone="warning" />
        <StatCard label="Aprobați" value={String(stats.approved || 0)} description="Indici confirmați" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Needs review" value={String(stats.needsReview || 0)} description="Valori suspecte" icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <StatCard label="Consum apă rece" value={formatValue(stats.coldWaterConsumption, 'm³')} description="Indici aprobați" icon={<Gauge className="h-5 w-5" />} />
      </section>
      <Card className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input label="Perioadă" type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} />
        <SelectField label="Status" value={status} onChange={setStatus}>
          <option value="">Toate</option>
          {Object.entries(readingStatuses).map(([value, item]) => (
            <option key={value} value={value}>
              {item.label}
            </option>
          ))}
        </SelectField>
        <Input label="Caută" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Contor, apartament, telefon" />
        <div className="flex items-end">
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Actualizează
          </Button>
        </div>
      </Card>
      {loading ? (
        <LoadingCard />
      ) : items.length ? (
        <Card noPadding>
          {items.map((reading: any) => (
            <div key={reading.id} className="space-y-3 border-b border-border/70 p-4 last:border-b-0">
              <ReadingRow reading={reading} admin />
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/admin/meter-readings/${reading.id}`} variant="secondary" size="sm">
                  Deschide
                </ButtonLink>
                {reading.status !== 'APPROVED' && reading.status !== 'CANCELLED' ? (
                  <>
                    <Button size="sm" onClick={() => approve(reading.id)}>
                      Aprobă
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => needsReview(reading.id)}>
                      Needs review
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => reject(reading.id)}>
                      Respinge
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState
          title="Nu există indici transmiși"
          text="Indicii trimiși de locatari sau importați de administrator vor apărea aici."
          action={<ButtonLink href="/admin/imports/meter-readings" variant="secondary">Importă indici</ButtonLink>}
        />
      )}
    </div>
  );
}

export function AdminMeterReadingDetailPage() {
  const id = useRouteId();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const response = await metersApi.adminGetReading(id);
      setData(response.data);
    } catch (err: any) {
      setError(String(err?.message || 'Indicele nu a fost găsit.'));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const reading = data?.reading;
  if (!reading && !error) return <LoadingCard />;
  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Detalii indice" description="Verificare indice contor." rightSlot={<ButtonLink href="/admin/meter-readings" variant="secondary">Înapoi</ButtonLink>} />
      <InlineError message={error} />
      {reading ? (
        <>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{reading.meter?.typeLabel}</h2>
                <p className="text-sm text-muted-foreground">
                  Ap. {reading.apartment?.apartmentNumber || 'Necompletat'} • {reading.periodMonth}
                </p>
              </div>
              {statusBadge(reading.status)}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Indice anterior" value={formatValue(reading.previousReadingValue, reading.unit)} />
              <Info label="Indice curent" value={formatValue(reading.readingValue, reading.unit)} />
              <Info label="Consum" value={formatValue(reading.consumptionValue, reading.unit)} />
              <Info label="Transmis la" value={formatDate(reading.submittedAt)} />
            </div>
            {reading.residentComment ? <Info label="Comentariu locatar" value={reading.residentComment} /> : null}
            {reading.rejectionReason ? <Info label="Motiv respingere" value={reading.rejectionReason} /> : null}
            <div className="flex flex-wrap gap-2">
              {reading.status !== 'APPROVED' && reading.status !== 'CANCELLED' ? (
                <>
                  <Button onClick={async () => { await metersApi.adminApproveReading(reading.id, {}); await load(); }}>Aprobă</Button>
                  <Button variant="secondary" onClick={async () => { await metersApi.adminNeedsReviewReading(reading.id, {}); await load(); }}>Needs review</Button>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      const reason = window.prompt('Motiv respingere');
                      if (!reason) return;
                      await metersApi.adminRejectReading(reading.id, { rejectionReason: reason });
                      await load();
                    }}
                  >
                    Respinge
                  </Button>
                </>
              ) : null}
            </div>
          </Card>
          <Card noPadding>
            <div className="border-b border-border/70 px-4 py-3 font-semibold text-foreground">Istoric contor</div>
            {(data?.history || []).map((item: any) => <ReadingRow key={item.id} reading={item} admin />)}
          </Card>
        </>
      ) : null}
    </div>
  );
}

export function ResidentMetersPage() {
  const [data, setData] = useState<any>(null);
  const [apartmentId, setApartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await metersApi.residentList({ apartmentId });
      setData(response.data);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca contoarele.'));
    } finally {
      setLoading(false);
    }
  }, [apartmentId]);
  useEffect(() => {
    load();
  }, [load]);
  const items = data?.items || [];
  const apartments = Array.from(
    new Map(
      items
        .map((meter: any) => [meter.apartment?.id, meter.apartment] as [string | undefined, any])
        .filter((entry: [string | undefined, any]) => Boolean(entry[0])),
    ).values(),
  ) as any[];
  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Contoarele mele"
        description="Vezi contoarele apartamentului și transmite indicii lunari."
        rightSlot={<ButtonLink href="/resident/meter-readings/new">Transmite indice</ButtonLink>}
      />
      <InlineError message={error} />
      {apartments.length > 1 ? (
        <Card>
          <SelectField label="Apartament" value={apartmentId} onChange={setApartmentId}>
            <option value="">Toate apartamentele</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                Apartament {apartment.apartmentNumber}
              </option>
            ))}
          </SelectField>
        </Card>
      ) : null}
      {loading ? (
        <LoadingCard />
      ) : items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((meter: any) => (
            <MeterCard key={meter.id} meter={meter}>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/resident/meter-readings/new?meterId=${meter.id}&apartmentId=${meter.apartmentId}`} size="sm">
                  <Send className="h-4 w-4" />
                  Transmite indice
                </ButtonLink>
                <ButtonLink href={`/resident/meters/${meter.id}`} variant="secondary" size="sm">
                  Vezi istoric
                </ButtonLink>
              </div>
            </MeterCard>
          ))}
        </div>
      ) : (
        <EmptyState title="Nu ai contoare asociate" text="Contoarele apartamentului vor apărea aici după ce administratorul le adaugă." />
      )}
    </div>
  );
}

export function ResidentMeterDetailPage() {
  const id = useRouteId();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    metersApi.residentGet(id).then((response) => setData(response.data)).catch((err) => setError(String(err?.message || 'Contorul nu a fost găsit.')));
  }, [id]);
  const meter = data?.meter;
  if (!meter && !error) return <LoadingCard />;
  return (
    <div className="space-y-5 pb-6">
      <PageHeader title={meter?.label || 'Contor'} description="Istoric indici contor." rightSlot={<ButtonLink href="/resident/meters" variant="secondary">Înapoi</ButtonLink>} />
      <InlineError message={error} />
      {meter ? (
        <>
          <MeterCard meter={meter}>
            <ButtonLink href={`/resident/meter-readings/new?meterId=${meter.id}&apartmentId=${meter.apartmentId}`} size="sm">Transmite indice nou</ButtonLink>
          </MeterCard>
          <Card noPadding>
            <div className="border-b border-border/70 px-4 py-3 font-semibold text-foreground">Istoric indici</div>
            {(data?.readings || []).length ? (data.readings.map((reading: any) => <ReadingRow key={reading.id} reading={reading} />)) : <div className="p-6 text-sm text-muted-foreground">Nu există indici transmiși.</div>}
          </Card>
        </>
      ) : null}
    </div>
  );
}

export function ResidentNewMeterReadingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [meters, setMeters] = useState<any[]>([]);
  const [meterId, setMeterId] = useState(searchParams.get('meterId') || '');
  const [periodMonth, setPeriodMonth] = useState(currentMonth());
  const [readingValue, setReadingValue] = useState('');
  const [residentComment, setResidentComment] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    metersApi.residentList({ apartmentId: searchParams.get('apartmentId') || '' })
      .then((response) => {
        const items = response.data?.items || [];
        setMeters(items);
        setMeterId((current) => current || items[0]?.id || '');
      })
      .catch((err) => setError(String(err?.message || 'Nu am putut încărca contoarele.')));
  }, [searchParams]);
  const meter = meters.find((item) => item.id === meterId);
  const previous = meter?.lastApprovedReading?.readingValue;
  const estimated = readingValue && previous !== null && previous !== undefined ? Number(readingValue) - Number(previous) : null;
  const submit = async () => {
    setError('');
    try {
      const response = await metersApi.residentCreateReading({ meterId, periodMonth, readingValue: Number(readingValue), residentComment });
      router.push(localizedPath(`/resident/meter-readings/${response.data.id}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut transmite indicele.'));
    }
  };
  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Transmite indice" description="Completează indicele curent pentru contorul apartamentului." rightSlot={<ButtonLink href="/resident/meters" variant="secondary">Înapoi</ButtonLink>} />
      <InlineError message={error} />
      <Card className="space-y-4">
        <SelectField label="Contor" value={meterId} onChange={setMeterId}>
          {meters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.typeLabel} • Ap. {item.apartment?.apartmentNumber} • {item.meterNumber || 'fără număr'}
            </option>
          ))}
        </SelectField>
        {meter ? (
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Ultimul indice aprobat" value={meter.lastApprovedReading ? formatValue(meter.lastApprovedReading.readingValue, meter.unit) : 'Primul indice transmis'} />
            <Info label="Unitate" value={meter.unit || 'Necompletat'} />
            <Info label="Consum estimat" value={estimated === null || Number.isNaN(estimated) ? 'Introdu indicele' : formatValue(estimated, meter.unit)} />
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Perioadă" type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} />
          <Input label="Indice curent" type="number" min="0" step="0.001" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} />
        </div>
        {estimated !== null && !Number.isNaN(estimated) && estimated < 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Indicele introdus este mai mic decât indicele aprobat anterior. Administratorul îl va verifica.
          </div>
        ) : null}
        <TextareaField label="Comentariu" value={residentComment} onChange={setResidentComment} placeholder="Opțional" />
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
          Încărcarea pozelor va fi disponibilă într-un pas următor.
        </div>
        <Button onClick={submit} disabled={!meterId || !readingValue}>
          <Send className="h-4 w-4" />
          Transmite indice
        </Button>
      </Card>
    </div>
  );
}

export function ResidentMeterReadingDetailPage() {
  const id = useRouteId();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const response = await metersApi.residentGetReading(id);
      setData(response.data);
    } catch (err: any) {
      setError(String(err?.message || 'Indicele nu a fost găsit.'));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const reading = data?.reading;
  const cancel = async () => {
    await metersApi.residentCancelReading(id);
    await load();
  };
  if (!reading && !error) return <LoadingCard />;
  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Detalii indice" description="Statusul indicelui transmis." rightSlot={<ButtonLink href="/resident/meters" variant="secondary">Înapoi la contoare</ButtonLink>} />
      <InlineError message={error} />
      {reading ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{reading.meter?.typeLabel || 'Contor'}</h2>
              <p className="text-sm text-muted-foreground">Perioada {reading.periodMonth}</p>
            </div>
            {statusBadge(reading.status)}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Info label="Indice precedent" value={formatValue(reading.previousReadingValue, reading.unit)} />
            <Info label="Indice transmis" value={formatValue(reading.readingValue, reading.unit)} />
            <Info label="Consum calculat" value={formatValue(reading.consumptionValue, reading.unit)} />
            <Info label="Trimis la" value={formatDate(reading.submittedAt)} />
          </div>
          {reading.residentComment ? <Info label="Comentariul tău" value={reading.residentComment} /> : null}
          {reading.adminComment ? <Info label="Comentariu admin" value={reading.adminComment} /> : null}
          {reading.rejectionReason ? <Info label="Motiv respingere" value={reading.rejectionReason} /> : null}
          <div className="flex flex-wrap gap-2">
            {reading.status === 'REJECTED' ? <ButtonLink href={`/resident/meter-readings/new?meterId=${reading.meterId}`}>Transmite din nou</ButtonLink> : null}
            {reading.status === 'SUBMITTED' ? (
              <Button variant="danger" onClick={cancel}>
                <XCircle className="h-4 w-4" />
                Anulează indice
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
