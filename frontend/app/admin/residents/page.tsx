'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Mail, Pencil, Phone, Plus, Search, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { adminResidentsCrmApi, exportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentStatus = 'ACTIVE' | 'INVITED' | 'NOT_INVITED' | 'INACTIVE';
type ContactRole = 'OWNER' | 'TENANT' | 'REPRESENTATIVE' | 'RESIDENT';
type ContactMethod = 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';

type ApartmentLink = {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  staircase: string;
  floor: string;
  role: ContactRole;
  isPrimaryContact: boolean;
  notes?: string;
  relationStartDate?: string;
  relationEndDate?: string;
};

type ResidentRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  preferredContactMethod: ContactMethod;
  status: ResidentStatus;
  role: ContactRole;
  apartments: ApartmentLink[];
  apartmentsCount: number;
  isPrimaryContactSomewhere: boolean;
  completenessStatus: 'COMPLETE' | 'NO_APARTMENT' | 'NO_PHONE' | 'NO_EMAIL' | 'INACTIVE';
  updatedAt: string;
};

type ApartmentOption = {
  id: string;
  apartmentNumber: string;
  staircase: string;
  floor: string;
  buildingName?: string;
};

type ListResponse = {
  organization?: {
    shortName?: string;
    legalName?: string;
    associationCode?: string;
  };
  items: ResidentRow[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
  stats: {
    totalResidents: number;
    owners: number;
    tenants: number;
    representatives: number;
    withoutPhone: number;
    withoutEmail: number;
    withoutApartment: number;
    primaryContacts: number;
  };
  filters?: {
    apartmentOptions?: ApartmentOption[];
  };
};

const emptyList: ListResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  stats: {
    totalResidents: 0,
    owners: 0,
    tenants: 0,
    representatives: 0,
    withoutPhone: 0,
    withoutEmail: 0,
    withoutApartment: 0,
    primaryContacts: 0,
  },
  filters: { apartmentOptions: [] },
};

const emptyPersonForm = {
  fullName: '',
  phone: '',
  email: '',
  preferredContactMethod: 'PHONE' as ContactMethod,
  status: 'NOT_INVITED' as ResidentStatus,
  internalNotes: '',
};

const emptyRelationForm = {
  apartmentId: '',
  role: 'OWNER' as ContactRole,
  isPrimaryContact: true,
  relationStartDate: '',
  relationEndDate: '',
  notes: '',
};

const statusLabels: Record<ResidentStatus, string> = {
  ACTIVE: 'Activ',
  INVITED: 'Invitat',
  NOT_INVITED: 'Neinvitat',
  INACTIVE: 'Inactiv',
};

const statusVariant = {
  ACTIVE: 'success',
  INVITED: 'warning',
  NOT_INVITED: 'neutral',
  INACTIVE: 'error',
} as const;

const roleLabels: Record<ContactRole, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  REPRESENTATIVE: 'Reprezentant',
};

const methodLabels: Record<ContactMethod, string> = {
  PHONE: 'Telefon',
  EMAIL: 'Email',
  APP: 'Aplicație',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
};

const completenessLabels = {
  COMPLETE: 'Complet',
  NO_APARTMENT: 'Fără apartament',
  NO_PHONE: 'Fără telefon',
  NO_EMAIL: 'Fără email',
  INACTIVE: 'Inactiv',
} as const;

const completenessVariant = {
  COMPLETE: 'success',
  NO_APARTMENT: 'warning',
  NO_PHONE: 'warning',
  NO_EMAIL: 'neutral',
  INACTIVE: 'error',
} as const;

export default function AdminResidentsPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<ListResponse>(emptyList);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    role: 'ALL',
    status: 'ALL',
    hasApartment: 'ALL',
    isPrimaryContact: 'ALL',
    preferredContactMethod: 'ALL',
    sortBy: 'name',
    sortDirection: 'asc' as 'asc' | 'desc',
    page: 1,
    limit: 20,
  });
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editing, setEditing] = useState<ResidentRow | null>(null);
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationResident, setRelationResident] = useState<ResidentRow | null>(null);
  const [relationForm, setRelationForm] = useState(emptyRelationForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadResidents = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await adminResidentsCrmApi.list({
        ...filters,
        role: filters.role === 'ALL' ? undefined : filters.role,
        status: filters.status === 'ALL' ? undefined : filters.status,
        hasApartment: filters.hasApartment === 'ALL' ? undefined : filters.hasApartment,
        isPrimaryContact: filters.isPrimaryContact === 'ALL' ? undefined : filters.isPrimaryContact,
        preferredContactMethod: filters.preferredContactMethod === 'ALL' ? undefined : filters.preferredContactMethod,
      });
      setData(res.data || emptyList);
    } catch (err: any) {
      setData(emptyList);
      setError(String(err?.message || 'Nu am putut încărca persoanele.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadResidents();
  }, [loadResidents]);

  const badgeText = useMemo(() => {
    const shortName = data.organization?.shortName || 'A.P.C.';
    const code = data.organization?.associationCode || 'cod necompletat';
    return `${shortName} · ${code} · ${data.stats.totalResidents} persoane`;
  }, [data.organization, data.stats.totalResidents]);

  function openCreateModal() {
    setEditing(null);
    setPersonForm(emptyPersonForm);
    setFormError('');
    setPersonModalOpen(true);
  }

  function openEditModal(row: ResidentRow) {
    setEditing(row);
    setPersonForm({
      fullName: row.fullName,
      phone: row.phone || '',
      email: row.email || '',
      preferredContactMethod: row.preferredContactMethod || 'PHONE',
      status: row.status || 'NOT_INVITED',
      internalNotes: '',
    });
    setFormError('');
    setPersonModalOpen(true);
  }

  function openRelationModal(row: ResidentRow) {
    setRelationResident(row);
    setRelationForm({
      ...emptyRelationForm,
      apartmentId: data.filters?.apartmentOptions?.[0]?.id || '',
    });
    setFormError('');
    setRelationModalOpen(true);
  }

  function validatePersonForm() {
    if (!personForm.fullName.trim()) return 'Numele este obligatoriu.';
    if (personForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personForm.email.trim())) return 'Emailul nu este valid.';
    return '';
  }

  async function savePerson() {
    setFormError('');
    setSuccess('');
    const validation = validatePersonForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: personForm.fullName.trim(),
        phone: personForm.phone.trim(),
        email: personForm.email.trim(),
        preferredContactMethod: personForm.preferredContactMethod,
        status: personForm.status,
        internalNotes: personForm.internalNotes.trim(),
      };
      if (editing) {
        await adminResidentsCrmApi.update(editing.id, payload);
        setSuccess('Persoana a fost actualizată.');
      } else {
        await adminResidentsCrmApi.create(payload);
        setSuccess('Persoana a fost creată.');
      }
      setPersonModalOpen(false);
      await loadResidents();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva persoana.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveRelation() {
    if (!relationResident) return;
    setFormError('');
    setSuccess('');
    if (!relationForm.apartmentId) {
      setFormError('Apartamentul este obligatoriu.');
      return;
    }
    setSaving(true);
    try {
      await adminResidentsCrmApi.linkApartment(relationResident.id, relationForm);
      setRelationModalOpen(false);
      setSuccess('Persoana a fost legată la apartament.');
      await loadResidents();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut lega persoana la apartament.'));
    } finally {
      setSaving(false);
    }
  }

  async function setPrimary(row: ResidentRow) {
    const relation = row.apartments[0];
    if (!relation) return;
    setSuccess('');
    setError('');
    try {
      await adminResidentsCrmApi.updateApartmentRelation(row.id, relation.apartmentId, {
        role: relation.role,
        isPrimaryContact: true,
        notes: relation.notes || '',
        relationStartDate: relation.relationStartDate || '',
        relationEndDate: relation.relationEndDate || '',
      });
      setSuccess('Contactul principal a fost actualizat.');
      await loadResidents();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut seta contactul principal.'));
    }
  }

  async function exportCsv() {
    setError('');
    setSuccess('');
    try {
      const res = await exportsApi.adminResidentsCsv({
        role: filters.role === 'ALL' ? undefined : filters.role,
        status: filters.status === 'ALL' ? undefined : filters.status,
        hasApartment: filters.hasApartment === 'ALL' ? undefined : filters.hasApartment,
        isPrimaryContact: filters.isPrimaryContact === 'ALL' ? undefined : filters.isPrimaryContact,
        preferredContactMethod: filters.preferredContactMethod === 'ALL' ? undefined : filters.preferredContactMethod,
        search: filters.search || undefined,
      });
      downloadBlob(res.data, 'locatari-proprietari.csv');
      setSuccess('Exportul CSV pentru locatari a fost generat.');
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera exportul CSV.'));
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Locatari și proprietari"
        description="Gestionează persoanele, contactele și legăturile lor cu apartamentele din asociație."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{badgeText}</Badge>
            <Link href={localizedPath('/admin/imports/residents')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/70">
              <FileUp className="h-4 w-4" />
              Importă persoane
            </Link>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Adaugă persoană
            </Button>
          </div>
        }
      />

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatCard label="Total persoane" value={data.stats.totalResidents} description="În asociația curentă" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Proprietari" value={data.stats.owners} description="Rol proprietar" icon={<UserCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Chiriași / locatari" value={data.stats.tenants} description="Relații active" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Reprezentanți" value={data.stats.representatives} description="Contacte delegate" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Fără telefon" value={data.stats.withoutPhone} description="Necesită completare" icon={<Phone className="h-5 w-5" />} tone="warning" />
        <StatCard label="Fără email" value={data.stats.withoutEmail} description="Opțional, dar util" icon={<Mail className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Fără apartament" value={data.stats.withoutApartment} description="Necesită legare" icon={<UserX className="h-5 w-5" />} tone="warning" />
        <StatCard label="Contacte principale" value={data.stats.primaryContacts} description="Apartamente cu contact" icon={<UserCheck className="h-5 w-5" />} tone="success" />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.6fr_repeat(6,minmax(0,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută după nume, telefon, email sau apartament" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} />
          </label>
          <Select value={filters.role} onChange={(value) => setFilters({ ...filters, role: value, page: 1 })} options={['ALL', 'OWNER', 'TENANT', 'REPRESENTATIVE']} labels={{ ALL: 'Toate rolurile', OWNER: 'Proprietar', TENANT: 'Chiriaș / locatar', REPRESENTATIVE: 'Reprezentant' }} />
          <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value, page: 1 })} options={['ALL', 'ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE']} labels={{ ALL: 'Toate statusurile', ...statusLabels }} />
          <Select value={filters.hasApartment} onChange={(value) => setFilters({ ...filters, hasApartment: value, page: 1 })} options={['ALL', 'true', 'false']} labels={{ ALL: 'Apartamente: toate', true: 'Cu apartament', false: 'Fără apartament' }} />
          <Select value={filters.isPrimaryContact} onChange={(value) => setFilters({ ...filters, isPrimaryContact: value, page: 1 })} options={['ALL', 'true', 'false']} labels={{ ALL: 'Contact: toate', true: 'Principal', false: 'Nu este principal' }} />
          <Select value={filters.preferredContactMethod} onChange={(value) => setFilters({ ...filters, preferredContactMethod: value, page: 1 })} options={['ALL', 'PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM']} labels={{ ALL: 'Metodă: toate', ...methodLabels }} />
          <Select
            value={`${filters.sortBy}:${filters.sortDirection}`}
            onChange={(value) => {
              const [sortBy, sortDirection] = value.split(':') as [string, 'asc' | 'desc'];
              setFilters({ ...filters, sortBy, sortDirection, page: 1 });
            }}
            options={['name:asc', 'name:desc', 'createdAt:desc', 'updatedAt:desc', 'role:asc', 'status:asc']}
            labels={{
              'name:asc': 'Nume A-Z',
              'name:desc': 'Nume Z-A',
              'createdAt:desc': 'Data adăugării',
              'updatedAt:desc': 'Ultima actualizare',
              'role:asc': 'Rol',
              'status:asc': 'Status',
            }}
          />
        </div>
      </Card>

      {loading ? <ResidentsSkeleton /> : null}

      {!loading && !data.items.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">Nu există locatari sau proprietari introduși</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Adaugă prima persoană sau importă lista de locatari pentru a începe administrarea contactelor din asociație.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={openCreateModal}>Adaugă persoană</Button>
            <Link href={localizedPath('/admin/imports/residents')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold">
              Importă persoane
            </Link>
          </div>
        </Card>
      ) : null}

      {!loading && data.items.length ? (
        <>
          <section className="grid gap-3 md:hidden">
            {data.items.map((row) => (
              <ResidentMobileCard key={row.id} row={row} onEdit={() => openEditModal(row)} onLink={() => openRelationModal(row)} />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] md:block">
            <div className="grid grid-cols-[1.15fr_0.9fr_1.15fr_1.05fr_0.8fr_0.9fr_0.95fr_0.8fr_0.9fr_1.4fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Nume</span>
              <span>Telefon</span>
              <span>Email</span>
              <span>Apartament/e</span>
              <span>Rol</span>
              <span>Contact principal</span>
              <span>Metodă contact</span>
              <span>Status</span>
              <span>Actualizat</span>
              <span>Acțiuni</span>
            </div>
            {data.items.map((row) => (
              <div key={row.id} className="grid grid-cols-[1.15fr_0.9fr_1.15fr_1.05fr_0.8fr_0.9fr_0.95fr_0.8fr_0.9fr_1.4fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
                <strong className="truncate text-foreground">{row.fullName}</strong>
                <span className="truncate text-muted-foreground">{row.phone || '-'}</span>
                <span className="truncate text-muted-foreground">{row.email || '-'}</span>
                <span className="truncate text-muted-foreground">{row.apartments.map((item) => item.apartmentNumber).join(', ') || '-'}</span>
                <span className="text-muted-foreground">{roleLabels[row.role] || row.role}</span>
                <span className="text-muted-foreground">{row.isPrimaryContactSomewhere ? 'Da' : 'Nu'}</span>
                <span className="text-muted-foreground">{methodLabels[row.preferredContactMethod]}</span>
                <Badge variant={statusVariant[row.status]}>{statusLabels[row.status]}</Badge>
                <span className="text-muted-foreground">{formatDate(row.updatedAt)}</span>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={localizedPath(`/admin/residents/${row.id}`)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Deschide</Link>
                  <button type="button" onClick={() => openEditModal(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Editează</button>
                  <button type="button" onClick={() => openRelationModal(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Leagă apartament</button>
                  {row.apartments.length ? <button type="button" onClick={() => setPrimary(row)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">Setează primary</button> : null}
                </div>
              </div>
            ))}
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{data.meta.total} rezultate · pagina {data.meta.page} din {data.meta.totalPages || 1}</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Înapoi</Button>
              <Button variant="secondary" disabled={filters.page >= (data.meta.totalPages || 1)} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Înainte</Button>
            </div>
          </div>
        </>
      ) : null}

      <PersonModal
        open={personModalOpen}
        title={editing ? 'Editează persoană' : 'Adaugă persoană'}
        form={personForm}
        error={formError}
        saving={saving}
        onClose={() => setPersonModalOpen(false)}
        onChange={setPersonForm}
        onSave={savePerson}
      />
      <RelationModal
        open={relationModalOpen}
        resident={relationResident}
        form={relationForm}
        apartmentOptions={data.filters?.apartmentOptions || []}
        error={formError}
        saving={saving}
        onClose={() => setRelationModalOpen(false)}
        onChange={setRelationForm}
        onSave={saveRelation}
      />
    </div>
  );
}

function ResidentMobileCard({ row, onEdit, onLink }: { row: ResidentRow; onEdit: () => void; onLink: () => void }) {
  const localizedPath = useLocalizedPath();
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{row.fullName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{row.apartments.map((item) => `Apt. ${item.apartmentNumber}`).join(', ') || 'Fără apartament'}</p>
        </div>
        <Badge variant={completenessVariant[row.completenessStatus]}>{completenessLabels[row.completenessStatus]}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <InfoLine label="Telefon" value={row.phone || '-'} />
        <InfoLine label="Email" value={row.email || '-'} />
        <InfoLine label="Rol" value={roleLabels[row.role] || row.role} />
        <InfoLine label="Metodă contact" value={methodLabels[row.preferredContactMethod]} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link href={localizedPath(`/admin/residents/${row.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-foreground px-3 text-sm font-semibold text-background">Deschide</Link>
        <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold">Editează</button>
        <button type="button" onClick={onLink} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-3 text-sm font-semibold">Leagă apartament</button>
      </div>
    </Card>
  );
}

function ResidentsSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => <Card key={item} className="h-24 animate-pulse bg-muted/40" />)}
    </div>
  );
}

function PersonModal({
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
  form: typeof emptyPersonForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyPersonForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Nume complet" value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} />
          <Input label="Telefon" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
          <Input label="Email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
          <Select value={form.preferredContactMethod} onChange={(value) => onChange({ ...form, preferredContactMethod: value as ContactMethod })} options={['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM']} labels={methodLabels} />
          <Select value={form.status} onChange={(value) => onChange({ ...form, status: value as ResidentStatus })} options={['ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE']} labels={statusLabels} />
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

function RelationModal({
  open,
  resident,
  form,
  apartmentOptions,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  resident: ResidentRow | null;
  form: typeof emptyRelationForm;
  apartmentOptions: ApartmentOption[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyRelationForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={`Leagă apartament${resident ? ` · ${resident.fullName}` : ''}`} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            value={form.apartmentId}
            onChange={(value) => onChange({ ...form, apartmentId: value })}
            options={['', ...apartmentOptions.map((item) => item.id)]}
            labels={{ '': 'Alege apartamentul', ...Object.fromEntries(apartmentOptions.map((item) => [item.id, `Apt. ${item.apartmentNumber} · Scara ${item.staircase || '-'}`])) }}
          />
          <Select value={form.role} onChange={(value) => onChange({ ...form, role: value as ContactRole })} options={['OWNER', 'TENANT', 'REPRESENTATIVE', 'RESIDENT']} labels={roleLabels} />
          <Input label="Data început" value={form.relationStartDate} onChange={(event) => onChange({ ...form, relationStartDate: event.target.value })} type="date" />
          <Input label="Data final" value={form.relationEndDate} onChange={(event) => onChange({ ...form, relationEndDate: event.target.value })} type="date" />
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-medium">
            <input type="checkbox" checked={form.isPrimaryContact} onChange={(event) => onChange({ ...form, isPrimaryContact: event.target.checked })} />
            Contact principal
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Note relație</span>
            <textarea className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
          </label>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Invitațiile reale nu sunt trimise din acest pas. Se salvează doar legătura persoană-apartament.</p>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={onClose}>Anulează</Button>
        <Button isLoading={saving} onClick={onSave}>Salvează legătura</Button>
      </ModalFooter>
    </Modal>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10">
      {options.map((item) => <option key={item || 'empty'} value={item}>{labels?.[item] || item}</option>)}
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
