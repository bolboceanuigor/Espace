'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileDown,
  Gauge,
  History,
  ListChecks,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Send,
  UnlockKeyhole,
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
            <ButtonLink href="/admin/meter-readings" variant="secondary">
              <Gauge className="h-4 w-4" />
              Adaugă citire lunară
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
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/admin/meter-readings?meterId=${meter.id}`} variant="secondary">
              <Gauge className="h-4 w-4" />
              Adaugă citire lunară
            </ButtonLink>
            <ButtonLink href="/admin/meters" variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Înapoi
            </ButtonLink>
          </div>
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
  const initialPeriodId = searchParams.get('periodId') || '';
  const now = useMemo(() => currentMonth(), []);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialPeriodId);
  const [overview, setOverview] = useState<any>(null);
  const [residentReadingsOverview, setResidentReadingsOverview] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [tab, setTab] = useState<'workspace' | 'missing' | 'issues' | 'history'>('workspace');
  const [filters, setFilters] = useState({
    search: '',
    buildingId: '',
    entranceId: '',
    meterType: '',
    onlyMissing: false,
    onlyIssues: false,
    meterId: initialMeterId,
  });
  const [dirty, setDirty] = useState<Record<string, { value: string; readingDate: string; comment: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState(() => {
    const [year, month] = now.split('-').map(Number);
    return { year: String(year), month: String(month), note: '' };
  });
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) || null;

  const periodStatus = (status?: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'neutral' }> = {
      DRAFT: { label: 'Draft', variant: 'neutral' },
      OPEN: { label: 'Deschisă', variant: 'success' },
      IN_REVIEW: { label: 'În verificare', variant: 'warning' },
      LOCKED: { label: 'Blocată', variant: 'neutral' },
      CANCELLED: { label: 'Anulată', variant: 'error' },
    };
    const item = map[String(status || '').toUpperCase()] || { label: status || 'Necunoscut', variant: 'neutral' as const };
    return <Badge variant={item.variant}>{item.label}</Badge>;
  };

  const issueSeverity = (severity?: string) => (
    <Badge variant={String(severity).toUpperCase() === 'CRITICAL' ? 'error' : 'warning'}>
      {String(severity).toUpperCase() === 'CRITICAL' ? 'Critică' : 'Warning'}
    </Badge>
  );

  const toDateInput = (value: unknown) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
  };

  const loadPeriods = useCallback(async (preferredId?: string) => {
    setError('');
    try {
      const response = await metersApi.getAdminMeterReadingPeriods();
      const items = response.data?.items || [];
      setPeriods(items);
      const nextId = preferredId || selectedPeriodId || initialPeriodId || items[0]?.id || '';
      if (nextId && items.some((period: any) => period.id === nextId)) {
        setSelectedPeriodId(nextId);
      } else if (items[0]?.id) {
        setSelectedPeriodId(items[0].id);
      }
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca perioadele de citire.'));
    }
  }, [initialPeriodId, selectedPeriodId]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const loadWorkspace = useCallback(async () => {
    if (!selectedPeriodId) {
      setOverview(null);
      setResidentReadingsOverview(null);
      setWorkspace(null);
      setIssues([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [overviewResponse, workspaceResponse, issuesResponse] = await Promise.all([
        metersApi.getAdminMeterReadingPeriodOverview(selectedPeriodId),
        metersApi.getAdminMeterReadingWorkspace(selectedPeriodId, { ...filters, limit: 500 }),
        metersApi.getAdminMeterReadingIssues(selectedPeriodId, { limit: 500 }),
      ]);
      const residentOverviewResponse = await metersApi.getAdminResidentReadingsOverview({ periodId: selectedPeriodId }).catch(() => ({ data: null }));
      setOverview(overviewResponse.data);
      setResidentReadingsOverview(residentOverviewResponse.data);
      setWorkspace(workspaceResponse.data);
      setIssues(issuesResponse.data?.items || []);
      setDirty({});
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca workspace-ul de citiri.'));
    } finally {
      setLoading(false);
    }
  }, [filters, selectedPeriodId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const updateDirty = (meterId: string, patch: Partial<{ value: string; readingDate: string; comment: string }>, row?: any) => {
    setDirty((current) => ({
      ...current,
      [meterId]: {
        value: current[meterId]?.value ?? String(row?.currentReading?.readingValue ?? ''),
        readingDate: current[meterId]?.readingDate ?? toDateInput(row?.currentReading?.readingDate),
        comment: current[meterId]?.comment ?? row?.currentReading?.adminComment ?? '',
        ...patch,
      },
    }));
  };

  const createPeriod = async () => {
    setError('');
    setSuccess('');
    try {
      const response = await metersApi.createAdminMeterReadingPeriod({
        year: Number(newPeriod.year),
        month: Number(newPeriod.month),
        note: newPeriod.note || undefined,
      });
      const period = response.data?.period;
      setShowPeriodModal(false);
      setSuccess(response.data?.alreadyExists ? 'Perioada exista deja și a fost deschisă.' : 'Perioada de citiri a fost creată.');
      await loadPeriods(period?.id);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut crea perioada.'));
    }
  };

  const saveRow = async (row: any) => {
    if (!selectedPeriodId) return;
    const payload = dirty[row.meter.id] || {
      value: String(row.currentReading?.readingValue ?? ''),
      readingDate: toDateInput(row.currentReading?.readingDate),
      comment: row.currentReading?.adminComment || '',
    };
    setSavingRows((current) => ({ ...current, [row.meter.id]: true }));
    setError('');
    setSuccess('');
    try {
      await metersApi.saveAdminMeterReading(selectedPeriodId, row.meter.id, {
        value: payload.value,
        readingDate: payload.readingDate,
        comment: payload.comment,
      });
      setDirty((current) => {
        const next = { ...current };
        delete next[row.meter.id];
        return next;
      });
      setSuccess('Citirea a fost salvată.');
      await Promise.all([loadWorkspace(), loadPeriods(selectedPeriodId)]);
    } catch (err: any) {
      setError(String(err?.message || 'Citirea nu a putut fi salvată.'));
    } finally {
      setSavingRows((current) => ({ ...current, [row.meter.id]: false }));
    }
  };

  const bulkSave = async () => {
    if (!selectedPeriodId) return;
    const readings = Object.entries(dirty)
      .filter(([, item]) => item.value !== '')
      .map(([meterId, item]) => ({
        meterId,
        value: item.value,
        readingDate: item.readingDate,
        comment: item.comment,
      }));
    if (!readings.length) return;
    setBulkSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await metersApi.bulkSaveAdminMeterReadings(selectedPeriodId, { readings });
      setSuccess(`Au fost salvate ${response.data?.savedCount || 0} citiri. Erori: ${response.data?.errorCount || 0}.`);
      await Promise.all([loadWorkspace(), loadPeriods(selectedPeriodId)]);
    } catch (err: any) {
      setError(String(err?.message || 'Citirile nu au putut fi salvate.'));
    } finally {
      setBulkSaving(false);
    }
  };

  const recalculate = async () => {
    if (!selectedPeriodId) return;
    setError('');
    setSuccess('');
    try {
      await metersApi.recalculateAdminMeterReadingPeriod(selectedPeriodId);
      setSuccess('Perioada a fost recalculată.');
      await Promise.all([loadWorkspace(), loadPeriods(selectedPeriodId)]);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut recalcula perioada.'));
    }
  };

  const lockPeriod = async () => {
    if (!selectedPeriodId) return;
    setError('');
    setSuccess('');
    try {
      await metersApi.lockAdminMeterReadingPeriod(selectedPeriodId, { confirmWarnings });
      setLockModalOpen(false);
      setConfirmWarnings(false);
      setSuccess('Perioada a fost blocată.');
      await Promise.all([loadWorkspace(), loadPeriods(selectedPeriodId)]);
    } catch (err: any) {
      setError(String(err?.message || 'Perioada nu a putut fi blocată.'));
    }
  };

  const unlockPeriod = async () => {
    if (!selectedPeriodId) return;
    if (!window.confirm('Deblochezi perioada pentru editare?')) return;
    setError('');
    setSuccess('');
    try {
      await metersApi.unlockAdminMeterReadingPeriod(selectedPeriodId);
      setSuccess('Perioada a fost deblocată.');
      await Promise.all([loadWorkspace(), loadPeriods(selectedPeriodId)]);
    } catch (err: any) {
      setError(String(err?.message || 'Perioada nu a putut fi deblocată.'));
    }
  };

  const rows = workspace?.items || [];
  const visibleRows = tab === 'missing' ? rows.filter((row: any) => row.status === 'MISSING') : rows;
  const isLocked = selectedPeriod?.status === 'LOCKED' || overview?.status === 'LOCKED';
  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Citiri contoare"
        description="Introdu și verifică citirile lunare ale contoarelor."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowPeriodModal(true)}>
              <Plus className="h-4 w-4" />
              Perioadă nouă
            </Button>
            <Button variant="secondary" onClick={recalculate} disabled={!selectedPeriodId}>
              <RefreshCw className="h-4 w-4" />
              Recalculează
            </Button>
            <Button variant="secondary" onClick={recalculate} disabled={!selectedPeriodId}>
              <CheckCircle2 className="h-4 w-4" />
              Validează
            </Button>
            {isLocked ? (
              <Button variant="secondary" onClick={unlockPeriod} disabled={!selectedPeriodId}>
                <UnlockKeyhole className="h-4 w-4" />
                Deblochează perioada
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setLockModalOpen(true)} disabled={!selectedPeriodId}>
                <Lock className="h-4 w-4" />
                Blochează perioada
              </Button>
            )}
            <Button variant="secondary" disabled>
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
            <ButtonLink href="/admin/meter-readings/reports" variant="secondary">
              <History className="h-4 w-4" />
              Rapoarte consum
            </ButtonLink>
            <ButtonLink href="/admin/resident-readings" variant="secondary">
              <ListChecks className="h-4 w-4" />
              Citiri locatari
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
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div> : null}

      {residentReadingsOverview?.pendingReview ? (
        <Card className="border-sky-200 bg-sky-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-950">Citiri de la locatari în așteptare</p>
              <p className="mt-1 text-sm text-sky-800">
                {residentReadingsOverview.pendingReview} citiri trebuie aprobate înainte să fie folosite în perioada lunară.
              </p>
            </div>
            <ButtonLink href={`/admin/resident-readings?periodId=${selectedPeriodId}&status=SUBMITTED`} variant="secondary">
              Verifică citiri
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      {!periods.length && !loading ? (
        <EmptyState
          title="Nu există perioade de citire încă."
          text="Creează prima perioadă lunară după ce ai configurat contoarele."
          action={<Button onClick={() => setShowPeriodModal(true)}>Creează prima perioadă</Button>}
        />
      ) : (
        <>
          <Card className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_auto]">
            <SelectField label="Perioadă" value={selectedPeriodId} onChange={setSelectedPeriodId}>
              <option value="">Alege perioada</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label || period.periodMonth} · {period.status}
                </option>
              ))}
            </SelectField>
            <div className="flex items-end gap-2">
              {selectedPeriod ? periodStatus(selectedPeriod.status) : null}
              {overview?.progressPercent !== undefined ? <Badge variant="neutral">{overview.progressPercent}% completat</Badge> : null}
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={loadWorkspace} disabled={!selectedPeriodId}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Total contoare active" value={String(overview?.totalActiveMeters || 0)} description="În perioada selectată" icon={<Gauge className="h-5 w-5" />} />
            <StatCard label="Citiri introduse" value={String(overview?.readingsSubmitted || 0)} description={`${overview?.readingsApproved || 0} aprobate`} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
            <StatCard label="Lipsesc citiri" value={String(overview?.readingsMissing || 0)} description="Necesare pentru lock" icon={<XCircle className="h-5 w-5" />} tone={overview?.readingsMissing ? 'warning' : 'success'} />
            <StatCard label="Progres" value={`${overview?.progressPercent || 0}%`} description={`${overview?.readingsSubmitted || 0} din ${overview?.totalActiveMeters || 0}`} icon={<ListChecks className="h-5 w-5" />} />
            <StatCard label="Probleme critice" value={String(overview?.criticalIssuesCount || 0)} description="Blochează perioada" icon={<AlertTriangle className="h-5 w-5" />} tone={overview?.criticalIssuesCount ? 'danger' : 'success'} />
            <StatCard label="Warning-uri" value={String(overview?.warningsCount || 0)} description="Permit lock cu confirmare" icon={<AlertTriangle className="h-5 w-5" />} tone={overview?.warningsCount ? 'warning' : 'success'} />
          </section>

          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${overview?.progressPercent || 0}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {overview?.readingsSubmitted || 0} din {overview?.totalActiveMeters || 0} contoare citite.
                </p>
              </div>
              {dirtyCount ? (
                <Button onClick={bulkSave} disabled={bulkSaving || isLocked}>
                  <Save className="h-4 w-4" />
                  {bulkSaving ? 'Se salvează...' : `Salvează ${dirtyCount} modificări`}
                </Button>
              ) : null}
            </div>
          </Card>

          {isLocked ? (
            <Card className="border-sky-200 bg-sky-50">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-sky-950">Perioada este blocată și poate intra în facturare.</p>
                  <p className="mt-1 text-sm text-sky-800">Generează drafturi de facturare din citirile verificate pentru perioada selectată.</p>
                </div>
                <ButtonLink href={`/admin/billing-drafts?meterReadingPeriodId=${selectedPeriodId}`} variant="secondary">
                  Generează drafturi de facturare
                </ButtonLink>
              </div>
            </Card>
          ) : null}

          <Card className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto_auto]">
            <Input label="Caută" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Apartament, contor, bloc" />
            <SelectField label="Bloc" value={filters.buildingId} onChange={(value) => setFilters({ ...filters, buildingId: value })}>
              <option value="">Toate</option>
              {(workspace?.filters?.buildings || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </SelectField>
            <SelectField label="Scară" value={filters.entranceId} onChange={(value) => setFilters({ ...filters, entranceId: value })}>
              <option value="">Toate</option>
              {(workspace?.filters?.entrances || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </SelectField>
            <SelectField label="Tip contor" value={filters.meterType} onChange={(value) => setFilters({ ...filters, meterType: value })}>
              <option value="">Toate</option>
              {meterTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </SelectField>
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-foreground">
              <input type="checkbox" checked={filters.onlyMissing} onChange={(event) => setFilters({ ...filters, onlyMissing: event.target.checked })} />
              Doar lipsă
            </label>
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-foreground">
              <input type="checkbox" checked={filters.onlyIssues} onChange={(event) => setFilters({ ...filters, onlyIssues: event.target.checked })} />
              Doar probleme
            </label>
          </Card>

          <div className="flex flex-wrap gap-2">
            {[
              ['workspace', 'Workspace'],
              ['missing', 'Lipsesc citiri'],
              ['issues', 'Probleme'],
              ['history', 'Istoric perioade'],
            ].map(([key, label]) => (
              <Button key={key} variant={tab === key ? 'primary' : 'secondary'} onClick={() => setTab(key as any)}>
                {label}
              </Button>
            ))}
          </div>

          {loading ? (
            <LoadingCard />
          ) : tab === 'history' ? (
            <Card noPadding>
              {periods.map((period) => (
                <div key={period.id} className="grid gap-3 border-b border-border/70 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_120px]">
                  <span className="font-semibold text-foreground">{period.label || period.periodMonth}</span>
                  <span>{periodStatus(period.status)}</span>
                  <span>{period.readingsCount || 0} citiri</span>
                  <span>{period.missingReadingsCount || 0} lipsă</span>
                  <span>{period.issuesCount || 0} probleme</span>
                  <Button size="sm" variant="secondary" onClick={() => { setSelectedPeriodId(period.id); setTab('workspace'); }}>
                    Deschide
                  </Button>
                </div>
              ))}
            </Card>
          ) : tab === 'issues' ? (
            issues.length ? (
              <Card noPadding>
                {issues.map((issue: any, index: number) => (
                  <div key={`${issue.type}-${issue.meter?.id}-${index}`} className="grid gap-3 border-b border-border/70 p-4 text-sm last:border-b-0 lg:grid-cols-[1fr_1fr_120px_1.4fr_160px]">
                    <div>
                      <p className="font-semibold text-foreground">{issue.title || issue.type}</p>
                      <p className="text-xs text-muted-foreground">{issue.message}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Apt. {issue.apartment?.number || issue.apartment?.apartmentNumber || '-'}</p>
                      <p className="text-xs text-muted-foreground">{issue.meter?.typeLabel || 'Contor'} · {issue.meter?.meterNumber || '-'}</p>
                    </div>
                    <div>{issueSeverity(issue.severity)}</div>
                    <p className="text-muted-foreground">{issue.recommendation}</p>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={`/admin/meters/${issue.meter?.id}`} variant="secondary" size="sm">Contor</ButtonLink>
                      {issue.apartment?.id ? <ButtonLink href={`/admin/apartments/${issue.apartment.id}`} variant="secondary" size="sm">Apartament</ButtonLink> : null}
                    </div>
                  </div>
                ))}
              </Card>
            ) : (
              <EmptyState title="Nu există probleme detectate." text="Citirile perioadei selectate nu au probleme critice sau warning-uri." />
            )
          ) : visibleRows.length ? (
            <Card noPadding>
              {visibleRows.map((row: any) => {
                const draft = dirty[row.meter.id];
                const value = draft?.value ?? String(row.currentReading?.readingValue ?? '');
                const readingDate = draft?.readingDate ?? toDateInput(row.currentReading?.readingDate);
                const comment = draft?.comment ?? row.currentReading?.adminComment ?? '';
                return (
                  <div key={row.meter.id} className="grid gap-3 border-b border-border/70 p-4 text-sm last:border-b-0 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_1.2fr_130px]">
                    <div>
                      <p className="font-semibold text-foreground">Apt. {row.apartment?.number || row.apartment?.apartmentNumber || '-'}</p>
                      <p className="text-xs text-muted-foreground">Etaj {row.apartment?.floor ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{row.building?.name || '-'}</p>
                      <p className="text-xs text-muted-foreground">{row.entrance?.name ? `Scara ${row.entrance.name}` : 'Scară neindicată'}</p>
                    </div>
                    <div>{row.meter?.typeLabel || row.meter?.type || 'Contor'}</div>
                    <div>{row.meter?.meterNumber || row.meter?.serialNumber || '-'}</div>
                    <div>{row.previousReading ? `${formatValue(row.previousReading.readingValue, row.meter?.unit)} · ${formatDate(row.previousReading.readingDate)}` : 'Primul indice'}</div>
                    <div className="space-y-2">
                      <input type="number" inputMode="decimal" value={value} disabled={isLocked} onChange={(event) => updateDirty(row.meter.id, { value: event.target.value }, row)} className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:border-foreground disabled:bg-muted" placeholder="0" />
                      <input type="date" value={readingDate} disabled={isLocked} onChange={(event) => updateDirty(row.meter.id, { readingDate: event.target.value }, row)} className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:border-foreground disabled:bg-muted" />
                      <input value={comment} disabled={isLocked} onChange={(event) => updateDirty(row.meter.id, { comment: event.target.value }, row)} className="h-10 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:border-foreground disabled:bg-muted" placeholder="Comentariu" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{formatValue(row.consumption, row.meter?.unit)}</p>
                      {statusBadge(row.status)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.issues?.length ? row.issues.slice(0, 3).map((issue: any) => (
                        <Badge key={issue.type} variant={issue.severity === 'CRITICAL' ? 'error' : 'warning'}>{issue.title}</Badge>
                      )) : <Badge variant="success">OK</Badge>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => saveRow(row)} disabled={isLocked || savingRows[row.meter.id]}>
                        <Save className="h-4 w-4" />
                        {savingRows[row.meter.id] ? '...' : 'Save'}
                      </Button>
                      <ButtonLink href={`/admin/meters/${row.meter.id}`} variant="secondary" size="sm">Contor</ButtonLink>
                    </div>
                  </div>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              title={tab === 'missing' ? 'Nu lipsesc citiri.' : 'Nu există contoare pentru criteriile selectate.'}
              text={tab === 'missing' ? 'Toate contoarele active au citiri în perioada selectată.' : 'Configurează contoarele sau ajustează filtrele pentru a vedea citiri.'}
              action={<ButtonLink href="/admin/meters" variant="secondary">Mergi la contoare</ButtonLink>}
            />
          )}
        </>
      )}

      <Modal isOpen={showPeriodModal} onClose={() => setShowPeriodModal(false)} maxWidth="lg">
        <ModalHeader title="Perioadă nouă" onClose={() => setShowPeriodModal(false)} />
        <ModalBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Anul" type="number" value={newPeriod.year} onChange={(event) => setNewPeriod({ ...newPeriod, year: event.target.value })} />
            <SelectField label="Luna" value={newPeriod.month} onChange={(value) => setNewPeriod({ ...newPeriod, month: value })}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={String(month)}>{month}</option>)}
            </SelectField>
          </div>
          <TextareaField label="Notă opțională" value={newPeriod.note} onChange={(value) => setNewPeriod({ ...newPeriod, note: value })} placeholder="Citiri luna curentă" />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowPeriodModal(false)}>Anulează</Button>
          <Button onClick={createPeriod}>
            <CalendarDays className="h-4 w-4" />
            Creează perioada
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={lockModalOpen} onClose={() => setLockModalOpen(false)} maxWidth="lg">
        <ModalHeader title="Blochează perioada" onClose={() => setLockModalOpen(false)} />
        <ModalBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info label="Citiri lipsă" value={overview?.readingsMissing || 0} />
            <Info label="Critice" value={overview?.criticalIssuesCount || 0} />
            <Info label="Warning-uri" value={overview?.warningsCount || 0} />
          </div>
          {overview?.criticalIssuesCount ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Perioada nu poate fi blocată cât timp există probleme critice.</div>
          ) : overview?.warningsCount ? (
            <label className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <input type="checkbox" checked={confirmWarnings} onChange={(event) => setConfirmWarnings(event.target.checked)} />
              Confirm că am verificat warning-urile.
            </label>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Nu există probleme critice. Perioada poate fi blocată.</div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setLockModalOpen(false)}>Anulează</Button>
          <Button onClick={lockPeriod} disabled={Boolean(overview?.criticalIssuesCount) || (Boolean(overview?.warningsCount) && !confirmWarnings)}>
            <Lock className="h-4 w-4" />
            Blochează
          </Button>
        </ModalFooter>
      </Modal>
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
