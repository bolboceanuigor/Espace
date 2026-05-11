'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Download, FileUp, Home, Pencil, Plus, Search, UserPlus } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { adminApartmentsCrmApi, exportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ApartmentStatus = 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
type ContactRole = 'OWNER' | 'TENANT' | 'REPRESENTATIVE';
type ContactStatus = 'ACTIVE' | 'INVITED' | 'NOT_INVITED';
type ContactMethod = 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';

type ApartmentRow = {
  id: string;
  apartmentNumber: string;
  buildingName: string;
  staircase: string;
  floor: string;
  areaM2: number | null;
  cadastralNumber: string;
  status: ApartmentStatus;
  primaryContact: { id: string; fullName: string; phone: string; email?: string } | null;
  residentsCount: number;
  completenessStatus: 'COMPLETE' | 'NO_CONTACT' | 'NO_AREA' | 'INCOMPLETE';
  updatedAt: string;
};

type ListResponse = {
  organization?: {
    shortName?: string;
    legalName?: string;
    associationCode?: string;
  };
  items: ApartmentRow[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
  stats: {
    totalApartments: number;
    totalAreaM2: number;
    withPrimaryContact: number;
    withoutPrimaryContact: number;
    withoutArea: number;
    occupied: number;
    vacant: number;
    unknown: number;
  };
  filters?: {
    staircases?: string[];
    floors?: string[];
  };
};

const emptyList: ListResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  stats: {
    totalApartments: 0,
    totalAreaM2: 0,
    withPrimaryContact: 0,
    withoutPrimaryContact: 0,
    withoutArea: 0,
    occupied: 0,
    vacant: 0,
    unknown: 0,
  },
  filters: { staircases: [], floors: [] },
};

const emptyApartmentForm = {
  apartmentNumber: '',
  building: 'Bloc principal',
  entrance: '1',
  floor: '',
  areaM2: '',
  rooms: '',
  cadastralNumber: '',
  status: 'UNKNOWN' as ApartmentStatus,
  internalNotes: '',
};

const emptyContactForm = {
  fullName: '',
  phone: '',
  email: '',
  role: 'OWNER' as ContactRole,
  isPrimaryContact: true,
  preferredContactMethod: 'PHONE' as ContactMethod,
  status: 'NOT_INVITED' as ContactStatus,
};

const statusLabels: Record<ApartmentStatus, string> = {
  OCCUPIED: 'Ocupat',
  VACANT: 'Liber',
  UNKNOWN: 'Necunoscut',
};

const completenessLabels = {
  COMPLETE: 'Complet',
  NO_CONTACT: 'Fără contact',
  NO_AREA: 'Fără suprafață',
  INCOMPLETE: 'Incomplet',
} as const;

const completenessVariant = {
  COMPLETE: 'success',
  NO_CONTACT: 'warning',
  NO_AREA: 'warning',
  INCOMPLETE: 'error',
} as const;

export default function AdminApartmentsPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<ListResponse>(emptyList);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    staircase: 'ALL',
    floor: 'ALL',
    status: 'ALL',
    hasPrimaryContact: 'ALL',
    hasArea: 'ALL',
    sortBy: 'apartmentNumber',
    sortDirection: 'asc' as 'asc' | 'desc',
    page: 1,
    limit: 20,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApartmentRow | null>(null);
  const [apartmentForm, setApartmentForm] = useState(emptyApartmentForm);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactApartment, setContactApartment] = useState<ApartmentRow | null>(null);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadApartments = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await adminApartmentsCrmApi.list({
        ...filters,
        staircase: filters.staircase === 'ALL' ? undefined : filters.staircase,
        floor: filters.floor === 'ALL' ? undefined : filters.floor,
        status: filters.status === 'ALL' ? undefined : filters.status,
        hasPrimaryContact: filters.hasPrimaryContact === 'ALL' ? undefined : filters.hasPrimaryContact,
        hasArea: filters.hasArea === 'ALL' ? undefined : filters.hasArea,
      });
      setData(res.data || emptyList);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca apartamentele.'));
      setData(emptyList);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  const badgeText = useMemo(() => {
    const shortName = data.organization?.shortName || 'A.P.C.';
    const code = data.organization?.associationCode || 'cod necompletat';
    return `${shortName} · ${code} · ${data.stats.totalApartments} apartamente`;
  }, [data.organization, data.stats.totalApartments]);

  function openCreateModal() {
    setEditing(null);
    setApartmentForm(emptyApartmentForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEditModal(row: ApartmentRow) {
    setEditing(row);
    setApartmentForm({
      apartmentNumber: row.apartmentNumber,
      building: row.buildingName || 'Bloc principal',
      entrance: row.staircase || '1',
      floor: row.floor || '',
      areaM2: row.areaM2 ? String(row.areaM2) : '',
      rooms: '',
      cadastralNumber: row.cadastralNumber || '',
      status: row.status || 'UNKNOWN',
      internalNotes: '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function openContactModal(row: ApartmentRow) {
    setContactApartment(row);
    setContactForm(emptyContactForm);
    setFormError('');
    setContactOpen(true);
  }

  function validateApartmentForm() {
    if (!apartmentForm.apartmentNumber.trim()) return 'Numărul apartamentului este obligatoriu.';
    if (apartmentForm.areaM2.trim()) {
      const area = Number(apartmentForm.areaM2);
      if (!Number.isFinite(area) || area <= 0) return 'Suprafața m² trebuie să fie un număr pozitiv.';
    }
    if (apartmentForm.floor.trim() && !Number.isFinite(Number(apartmentForm.floor))) return 'Etajul trebuie să fie un număr.';
    return '';
  }

  async function saveApartment() {
    setFormError('');
    setSuccess('');
    const validation = validateApartmentForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        apartmentNumber: apartmentForm.apartmentNumber.trim(),
        building: apartmentForm.building.trim() || 'Bloc principal',
        entrance: apartmentForm.entrance.trim() || '1',
        floor: apartmentForm.floor.trim() ? Number(apartmentForm.floor) : null,
        areaM2: apartmentForm.areaM2.trim() ? Number(apartmentForm.areaM2) : null,
        rooms: apartmentForm.rooms.trim() ? Number(apartmentForm.rooms) : null,
        cadastralNumber: apartmentForm.cadastralNumber.trim(),
        status: apartmentForm.status,
        internalNotes: apartmentForm.internalNotes.trim(),
      };
      if (editing) {
        await adminApartmentsCrmApi.update(editing.id, payload);
        setSuccess('Apartamentul a fost actualizat.');
      } else {
        await adminApartmentsCrmApi.create(payload);
        setSuccess('Apartamentul a fost creat.');
      }
      setFormOpen(false);
      await loadApartments();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva apartamentul.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveContact() {
    if (!contactApartment) return;
    setFormError('');
    setSuccess('');
    if (!contactForm.fullName.trim()) {
      setFormError('Numele locatarului este obligatoriu.');
      return;
    }
    setSaving(true);
    try {
      await adminApartmentsCrmApi.linkResident(contactApartment.id, {
        fullName: contactForm.fullName.trim(),
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim(),
        role: contactForm.role,
        isPrimaryContact: contactForm.isPrimaryContact,
        preferredContactMethod: contactForm.preferredContactMethod,
        status: contactForm.status,
      });
      setContactOpen(false);
      setSuccess('Locatarul a fost salvat și conectat la apartament.');
      await loadApartments();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva locatarul.'));
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    setError('');
    setSuccess('');
    try {
      const res = await exportsApi.adminApartmentsCsv({
        staircase: filters.staircase === 'ALL' ? undefined : filters.staircase,
        status: filters.status === 'ALL' ? undefined : filters.status,
        hasPrimaryContact: filters.hasPrimaryContact === 'ALL' ? undefined : filters.hasPrimaryContact,
        hasArea: filters.hasArea === 'ALL' ? undefined : filters.hasArea,
      });
      downloadBlob(res.data, 'apartamente.csv');
      setSuccess('Exportul CSV pentru apartamente a fost generat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera exportul CSV.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Apartamente"
        description="Gestionează apartamentele, suprafețele și contactele principale din asociație."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{badgeText}</Badge>
            <Link href={localizedPath('/admin/imports/apartments')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/70">
              <FileUp className="h-4 w-4" />
              Importă apartamente
            </Link>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Adaugă apartament
            </Button>
          </div>
        }
      />

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total apartamente" value={data.stats.totalApartments} description="În asociația curentă" icon={<Home className="h-5 w-5" />} />
        <StatCard label="Total m²" value={data.stats.totalAreaM2.toFixed(1)} description="Suprafață declarată" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Cu contact principal" value={data.stats.withPrimaryContact} description="Apartamente complete" icon={<UserPlus className="h-5 w-5" />} tone="success" />
        <StatCard label="Fără contact principal" value={data.stats.withoutPrimaryContact} description="Necesită completare" icon={<UserPlus className="h-5 w-5" />} tone="warning" />
        <StatCard label="Fără suprafață" value={data.stats.withoutArea} description="Necesită m²" icon={<Building2 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Ocupate / necunoscute" value={`${data.stats.occupied}/${data.stats.unknown}`} description={`${data.stats.vacant} libere`} icon={<Home className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.6fr_repeat(6,minmax(0,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Caută după apartament, contact, telefon sau cadastru"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
            />
          </label>
          <Select value={filters.staircase} onChange={(value) => setFilters({ ...filters, staircase: value, page: 1 })} options={['ALL', ...(data.filters?.staircases || [])]} labels={{ ALL: 'Toate scările' }} />
          <Select value={filters.floor} onChange={(value) => setFilters({ ...filters, floor: value, page: 1 })} options={['ALL', ...(data.filters?.floors || [])]} labels={{ ALL: 'Toate etajele' }} />
          <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value, page: 1 })} options={['ALL', 'OCCUPIED', 'VACANT', 'UNKNOWN']} labels={{ ALL: 'Toate statusurile', OCCUPIED: 'Ocupat', VACANT: 'Liber', UNKNOWN: 'Necunoscut' }} />
          <Select value={filters.hasPrimaryContact} onChange={(value) => setFilters({ ...filters, hasPrimaryContact: value, page: 1 })} options={['ALL', 'true', 'false']} labels={{ ALL: 'Contact: toate', true: 'Cu contact', false: 'Fără contact' }} />
          <Select value={filters.hasArea} onChange={(value) => setFilters({ ...filters, hasArea: value, page: 1 })} options={['ALL', 'true', 'false']} labels={{ ALL: 'Suprafață: toate', true: 'Completată', false: 'Lipsă' }} />
          <Select
            value={`${filters.sortBy}:${filters.sortDirection}`}
            onChange={(value) => {
              const [sortBy, sortDirection] = value.split(':') as [string, 'asc' | 'desc'];
              setFilters({ ...filters, sortBy, sortDirection, page: 1 });
            }}
            options={['apartmentNumber:asc', 'apartmentNumber:desc', 'areaM2:asc', 'areaM2:desc', 'floor:asc', 'staircase:asc']}
            labels={{
              'apartmentNumber:asc': 'Nr. crescător',
              'apartmentNumber:desc': 'Nr. descrescător',
              'areaM2:asc': 'Suprafață crescător',
              'areaM2:desc': 'Suprafață descrescător',
              'floor:asc': 'Etaj',
              'staircase:asc': 'Scara',
            }}
          />
        </div>
      </Card>

      {loading ? <ApartmentSkeleton /> : null}

      {!loading && !data.items.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Nu există apartamente introduse</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Adaugă primul apartament sau importă structura blocului pentru a începe administrarea asociației.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={openCreateModal}>Adaugă apartament</Button>
            <Link href={localizedPath('/admin/imports/apartments')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold">
              Importă apartamente
            </Link>
          </div>
        </Card>
      ) : null}

      {!loading && data.items.length ? (
        <>
          <section className="grid gap-3 md:hidden">
            {data.items.map((row) => (
              <ApartmentMobileCard key={row.id} row={row} onEdit={() => openEditModal(row)} onAddContact={() => openContactModal(row)} />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
            <div className="grid grid-cols-[0.8fr_0.7fr_0.6fr_0.9fr_1fr_1.3fr_0.9fr_0.8fr_0.9fr_1.2fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Apartament</span>
              <span>Scara</span>
              <span>Etaj</span>
              <span>Suprafață</span>
              <span>Cadastral</span>
              <span>Contact principal</span>
              <span>Telefon</span>
              <span>Status</span>
              <span>Actualizat</span>
              <span>Acțiuni</span>
            </div>
            {data.items.map((row) => (
              <div key={row.id} className="grid grid-cols-[0.8fr_0.7fr_0.6fr_0.9fr_1fr_1.3fr_0.9fr_0.8fr_0.9fr_1.2fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
                <strong className="text-foreground">Apt. {row.apartmentNumber}</strong>
                <span className="text-muted-foreground">{row.staircase || '-'}</span>
                <span className="text-muted-foreground">{row.floor || '-'}</span>
                <span className="text-muted-foreground">{row.areaM2 ? `${row.areaM2} m²` : '-'}</span>
                <span className="truncate text-muted-foreground">{row.cadastralNumber || '-'}</span>
                <span className="truncate font-medium text-foreground">{row.primaryContact?.fullName || 'Fără contact'}</span>
                <span className="truncate text-muted-foreground">{row.primaryContact?.phone || '-'}</span>
                <Badge variant={completenessVariant[row.completenessStatus]}>{completenessLabels[row.completenessStatus]}</Badge>
                <span className="text-muted-foreground">{formatDate(row.updatedAt)}</span>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={localizedPath(`/admin/apartments/${row.id}`)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Deschide</Link>
                  <button type="button" onClick={() => openEditModal(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Editează</button>
                  <button type="button" onClick={() => openContactModal(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Adaugă locatar</button>
                </div>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {data.meta.total} rezultate · pagina {data.meta.page} din {data.meta.totalPages || 1}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Înapoi</Button>
              <Button variant="secondary" disabled={filters.page >= (data.meta.totalPages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Înainte</Button>
            </div>
          </div>
        </>
      ) : null}

      <ApartmentFormModal
        open={formOpen}
        title={editing ? 'Editează apartament' : 'Adaugă apartament'}
        form={apartmentForm}
        error={formError}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onChange={setApartmentForm}
        onSave={saveApartment}
      />

      <ContactModal
        open={contactOpen}
        apartment={contactApartment}
        form={contactForm}
        error={formError}
        saving={saving}
        onClose={() => setContactOpen(false)}
        onChange={setContactForm}
        onSave={saveContact}
      />
    </div>
  );
}

function ApartmentMobileCard({ row, onEdit, onAddContact }: { row: ApartmentRow; onEdit: () => void; onAddContact: () => void }) {
  const localizedPath = useLocalizedPath();
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Apt. {row.apartmentNumber}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Scara {row.staircase || '-'} · Etaj {row.floor || '-'} · {row.areaM2 ? `${row.areaM2} m²` : 'fără suprafață'}</p>
        </div>
        <Badge variant={completenessVariant[row.completenessStatus]}>{completenessLabels[row.completenessStatus]}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <InfoLine label="Contact" value={row.primaryContact?.fullName || 'Fără contact'} />
        <InfoLine label="Telefon" value={row.primaryContact?.phone || '-'} />
        <InfoLine label="Cadastral" value={row.cadastralNumber || '-'} />
        <InfoLine label="Status" value={statusLabels[row.status]} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link href={localizedPath(`/admin/apartments/${row.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-foreground px-3 text-sm font-semibold text-background">Deschide</Link>
        <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-semibold"><Pencil className="h-4 w-4" /> Editează</button>
        <button type="button" onClick={onAddContact} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 px-3 text-sm font-semibold"><UserPlus className="h-4 w-4" /> Locatar</button>
      </div>
    </Card>
  );
}

function ApartmentSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <Card key={item} className="h-24 animate-pulse bg-muted/40" />
      ))}
    </div>
  );
}

function ApartmentFormModal({
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
  form: typeof emptyApartmentForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyApartmentForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Număr apartament" value={form.apartmentNumber} onChange={(event) => onChange({ ...form, apartmentNumber: event.target.value })} />
          <Input label="Bloc / corp" value={form.building} onChange={(event) => onChange({ ...form, building: event.target.value })} />
          <Input label="Scara" value={form.entrance} onChange={(event) => onChange({ ...form, entrance: event.target.value })} />
          <Input label="Etaj" value={form.floor} onChange={(event) => onChange({ ...form, floor: event.target.value })} />
          <Input label="Suprafață m²" value={form.areaM2} onChange={(event) => onChange({ ...form, areaM2: event.target.value })} />
          <Input label="Număr cadastral" value={form.cadastralNumber} onChange={(event) => onChange({ ...form, cadastralNumber: event.target.value })} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as ApartmentStatus })}>
              <option value="OCCUPIED">Ocupat</option>
              <option value="VACANT">Liber</option>
              <option value="UNKNOWN">Necunoscut</option>
            </select>
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Note interne</span>
            <textarea className="min-h-24 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={form.internalNotes} onChange={(event) => onChange({ ...form, internalNotes: event.target.value })} />
          </label>
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={onClose}>Anulează</Button>
        <Button isLoading={saving} onClick={onSave}>Salvează</Button>
      </ModalFooter>
    </Modal>
  );
}

function ContactModal({
  open,
  apartment,
  form,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  apartment: ApartmentRow | null;
  form: typeof emptyContactForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyContactForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={`Adaugă locatar/proprietar${apartment ? ` · Apt. ${apartment.apartmentNumber}` : ''}`} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Nume complet" value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} />
          <Input label="Telefon" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
          <Input label="Email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
          <Select value={form.role} onChange={(value) => onChange({ ...form, role: value as ContactRole })} options={['OWNER', 'TENANT', 'REPRESENTATIVE']} labels={{ OWNER: 'Proprietar', TENANT: 'Chiriaș', REPRESENTATIVE: 'Reprezentant' }} />
          <Select value={form.preferredContactMethod} onChange={(value) => onChange({ ...form, preferredContactMethod: value as ContactMethod })} options={['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM']} labels={{ PHONE: 'Telefon', EMAIL: 'Email', APP: 'Aplicație', WHATSAPP: 'WhatsApp', TELEGRAM: 'Telegram' }} />
          <Select value={form.status} onChange={(value) => onChange({ ...form, status: value as ContactStatus })} options={['NOT_INVITED', 'INVITED', 'ACTIVE']} labels={{ NOT_INVITED: 'Neinvitat', INVITED: 'Invitat', ACTIVE: 'Activ' }} />
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-medium">
            <input type="checkbox" checked={form.isPrimaryContact} onChange={(event) => onChange({ ...form, isPrimaryContact: event.target.checked })} />
            Contact principal
          </label>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Invitațiile reale nu sunt trimise din acest pas. Se salvează doar structura contactului.</p>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={onClose}>Anulează</Button>
        <Button isLoading={saving} onClick={onSave}>Salvează locatar</Button>
      </ModalFooter>
    </Modal>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10">
      {options.map((item) => <option key={item} value={item}>{labels?.[item] || item}</option>)}
    </select>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO');
}
