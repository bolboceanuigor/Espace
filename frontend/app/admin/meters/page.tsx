'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Plus, Search, TimerReset } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { apartmentsApi, metersApi } from '@/lib/api';
import {
  adminMeters,
  meterStatusVariant,
  normalizeApiApartment,
  normalizeApiMeter,
  type AdminApartment,
  type AdminMeter,
  type MeterStatus,
  type MeterType,
} from '@/lib/admin-mvp-data';

const statusOptions: Array<'Toate' | MeterStatus> = ['Toate', 'Actualizat', 'Lipsă citire', 'Suspect'];
const typeOptions: Array<'Toate' | MeterType> = ['Toate', 'Apă rece', 'Apă caldă', 'Gaz', 'Electricitate', 'Încălzire'];
const meterTypeLabels = {
  COLD_WATER: 'Apă rece',
  HOT_WATER: 'Apă caldă',
  GAS: 'Gaz',
  ELECTRICITY: 'Electricitate',
  HEATING: 'Încălzire',
} as const;
const meterStatusLabels = {
  ACTIVE: 'Actualizat',
  MISSING_READING: 'Lipsă citire',
  SUSPICIOUS: 'Suspect',
  INACTIVE: 'Inactiv',
} as const;
const emptyForm = {
  apartmentId: '',
  type: 'COLD_WATER' as keyof typeof meterTypeLabels,
  serialNumber: '',
  status: 'ACTIVE' as keyof typeof meterStatusLabels,
};
const emptyReadingForm = {
  meterId: '',
  value: '',
  readingDate: new Date().toISOString().slice(0, 10),
};

export default function AdminMetersPage() {
  const [staircase, setStaircase] = useState('Toate');
  const [apartment, setApartment] = useState('Toate');
  const [type, setType] = useState<'Toate' | MeterType>('Toate');
  const [status, setStatus] = useState<'Toate' | MeterStatus>('Toate');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminMeter[]>(adminMeters);
  const [apartmentRows, setApartmentRows] = useState<AdminApartment[]>([]);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [readingForm, setReadingForm] = useState(emptyReadingForm);
  const [isAddingReading, setIsAddingReading] = useState(false);
  const [readingError, setReadingError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadMeters = async () => {
    const [metersRes, apartmentsRes] = await Promise.all([
      metersApi.list(),
      apartmentsApi.list(),
    ]);
    const apiRows = (metersRes.data || []).map(normalizeApiMeter);
    const apiApartments = (apartmentsRes.data || []).map(normalizeApiApartment);
    if (apiRows.length) {
      setRows(apiRows);
      setSource('api');
    }
    setApartmentRows(apiApartments);
    setForm((current) => {
      if (current.apartmentId || !apiApartments[0]?.id) return current;
      return { ...current, apartmentId: apiApartments[0].id };
    });
  };

  useEffect(() => {
    let active = true;
    loadMeters().catch(() => {
      if (!active) return;
      setRows(adminMeters);
      setApartmentRows([]);
      setSource('mock');
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((meter) => {
      const matchesSearch = !needle || `${meter.apartment} ${meter.staircase} ${meter.type} ${meter.serial}`.toLowerCase().includes(needle);
      const matchesStaircase = staircase === 'Toate' || meter.staircase === staircase;
      const matchesApartment = apartment === 'Toate' || meter.apartment === apartment;
      const matchesType = type === 'Toate' || meter.type === type;
      const matchesStatus = status === 'Toate' || meter.status === status;
      return matchesSearch && matchesStaircase && matchesApartment && matchesType && matchesStatus;
    });
  }, [apartment, query, rows, staircase, status, type]);

  const staircases = ['Toate', ...Array.from(new Set(rows.map((meter) => meter.staircase)))];
  const apartments = ['Toate', ...Array.from(new Set(rows.map((meter) => meter.apartment)))];
  const totals = useMemo(() => ({
    total: rows.length,
    updated: rows.filter((meter) => meter.status === 'Actualizat').length,
    missing: rows.filter((meter) => meter.status === 'Lipsă citire').length,
    suspicious: rows.filter((meter) => meter.status === 'Suspect').length,
  }), [rows]);

  const createMeter = async () => {
    setFormError('');
    setSuccessMessage('');
    const selectedApartment = apartmentRows.find((item) => item.id === form.apartmentId);
    if (!selectedApartment?.organizationId) {
      setFormError('Alege un apartament real din lista API.');
      return;
    }
    if (!form.serialNumber.trim()) {
      setFormError('Completează seria contorului.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await metersApi.create({
        organizationId: selectedApartment.organizationId,
        apartmentId: selectedApartment.id,
        type: form.type,
        serialNumber: form.serialNumber.trim(),
        status: form.status,
      });
      const next = normalizeApiMeter(created.data);
      setRows((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setSource('api');
      setForm({ ...emptyForm, apartmentId: selectedApartment.id });
      setModalOpen(false);
      setSuccessMessage('Contorul a fost creat.');
      await loadMeters().catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setFormError(message.includes('Acest contor există deja') ? 'Acest contor există deja.' : 'Nu am putut crea contorul.');
    } finally {
      setIsCreating(false);
    }
  };

  const openReadingModal = (meter: AdminMeter) => {
    setReadingError('');
    setSuccessMessage('');
    setReadingForm({
      meterId: meter.id,
      value: '',
      readingDate: new Date().toISOString().slice(0, 10),
    });
    setReadingModalOpen(true);
  };

  const addReading = async () => {
    setReadingError('');
    setSuccessMessage('');
    const value = Number(readingForm.value);
    if (!readingForm.meterId) {
      setReadingError('Alege contorul.');
      return;
    }
    if (!Number.isFinite(value)) {
      setReadingError('Completează o valoare numerică.');
      return;
    }

    setIsAddingReading(true);
    try {
      await metersApi.addReading(readingForm.meterId, {
        value,
        readingDate: readingForm.readingDate,
        source: 'ADMIN',
      });
      setReadingModalOpen(false);
      setReadingForm(emptyReadingForm);
      setSource('api');
      setSuccessMessage('Citirea a fost adăugată.');
      await loadMeters().catch(() => undefined);
    } catch {
      setReadingError('Nu am putut adăuga citirea.');
    } finally {
      setIsAddingReading(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Contoare"
        description="Citiri pentru apă, gaz, electricitate și încălzire în APC Alba Iulia 75."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date demo'}
            </span>
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
              <Plus className="h-4 w-4" />
              Adaugă contor
            </button>
          </div>
        }
      />
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total contoare" value={String(totals.total)} description="În apartamentele conectate" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Citiri actualizate" value={String(totals.updated)} description="Citiri confirmate luna curentă" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Citiri lipsă" value={String(totals.missing)} description="Necesită transmitere" icon={<TimerReset className="h-5 w-5" />} tone="warning" />
        <StatCard label="Citiri suspecte" value={String(totals.suspicious)} description="Valori de verificat" icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută apartament, tip sau serie" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={staircase} onChange={setStaircase} options={staircases} label="Scara" />
          <Select value={apartment} onChange={setApartment} options={apartments} label="Apartament" />
          <Select value={type} onChange={(value) => setType(value as 'Toate' | MeterType)} options={typeOptions} label="Tip contor" />
          <Select value={status} onChange={(value) => setStatus(value as 'Toate' | MeterStatus)} options={statusOptions} label="Status" />
        </div>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        {filtered.map((meter) => (
          <MeterCard key={meter.id} meter={meter} onAddReading={openReadingModal} />
        ))}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă contor" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">Apartament</span>
              <select className="select" value={form.apartmentId} onChange={(event) => setForm({ ...form, apartmentId: event.target.value })}>
                <option value="">Alege apartamentul</option>
                {apartmentRows.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>Apt. {apartment.number} · {apartment.staircase}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Tip contor</span>
              <select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })}>
                {Object.entries(meterTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <Field label="Serie contor" value={form.serialNumber} onChange={(value) => setForm({ ...form, serialNumber: value })} required />
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}>
                {Object.entries(meterStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Crearea necesită API real. Datele demo rămân doar pentru afișare.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isCreating} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createMeter} disabled={isCreating} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreating ? 'Se creează...' : 'Creează contor'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={readingModalOpen} onClose={() => setReadingModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Adaugă citire" onClose={() => setReadingModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="label">Contor</span>
              <select className="select" value={readingForm.meterId} onChange={(event) => setReadingForm({ ...readingForm, meterId: event.target.value })}>
                {rows.map((meter) => (
                  <option key={meter.id} value={meter.id}>Apt. {meter.apartment} · {meter.type} · {meter.serial}</option>
                ))}
              </select>
            </label>
            <Field label="Valoare" value={readingForm.value} onChange={(value) => setReadingForm({ ...readingForm, value })} type="number" required />
            <Field label="Data citirii" value={readingForm.readingDate} onChange={(value) => setReadingForm({ ...readingForm, readingDate: value })} type="date" required />
          </div>
          {readingError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {readingError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setReadingModalOpen(false)} disabled={isAddingReading} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={addReading} disabled={isAddingReading} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isAddingReading ? 'Se adaugă...' : 'Adaugă citire'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function MeterCard({ meter, onAddReading }: { meter: AdminMeter; onAddReading: (meter: AdminMeter) => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Apt. {meter.apartment}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{meter.staircase} · Etaj {meter.floor}</p>
        </div>
        <Badge variant={meterStatusVariant[meter.status]}>{meter.status}</Badge>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Tip" value={meter.type} />
        <Info label="Serie" value={meter.serial} />
        <Info label="Ultima citire" value={meter.reading} />
        <Info label="Data citirii" value={meter.readingDate} />
      </div>

      <Button type="button" onClick={() => onAddReading(meter)} className="mt-4 w-full sm:w-auto" variant={meter.status === 'Actualizat' ? 'secondary' : 'primary'}>
        <Plus className="h-4 w-4" />
        Adaugă citire
      </Button>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10"
      >
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
