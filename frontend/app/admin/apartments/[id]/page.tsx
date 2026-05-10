'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Home, Mail, Pencil, Phone, Plus, StickyNote, UserCheck, Users } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { adminApartmentsCrmApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ApartmentStatus = 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
type ContactRole = 'OWNER' | 'TENANT' | 'REPRESENTATIVE';
type ContactStatus = 'ACTIVE' | 'INVITED' | 'NOT_INVITED';
type ContactMethod = 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';

type ResidentLink = {
  id: string;
  residentId: string;
  fullName: string;
  phone: string;
  email: string;
  role: ContactRole | string;
  isPrimaryContact: boolean;
  accountStatus: string;
  preferredContactMethod: ContactMethod | string;
};

type ApartmentDetail = {
  id: string;
  apartmentNumber: string;
  number?: string;
  buildingName: string;
  staircase: string;
  floor: string;
  areaM2: number | null;
  rooms?: number | null;
  cadastralNumber: string;
  status: ApartmentStatus;
  primaryContact: { id: string; fullName: string; phone: string; email?: string } | null;
  residentsCount: number;
  completenessStatus: 'COMPLETE' | 'NO_CONTACT' | 'NO_AREA' | 'INCOMPLETE';
  internalNotes: string;
  residents: ResidentLink[];
  meters: Array<{ id: string; type: string; serialNumber: string; status: string; lastReading?: number | null; lastReadingDate?: string | null }>;
  invoices: Array<{ id: string; amount?: number; totalAmount?: number; status?: string; month?: number; year?: number; dueDate?: string }>;
  payments: Array<{ id: string; amount?: number; paidAt?: string; method?: string }>;
  issues: Array<{ id: string; title?: string; status?: string; priority?: string; createdAt?: string }>;
  activity: Array<{ label: string; date?: string }>;
  updatedAt: string;
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

const roleLabels: Record<string, string> = {
  OWNER: 'Proprietar',
  TENANT: 'Chiriaș',
  RESIDENT: 'Locatar',
  FAMILY_MEMBER: 'Membru familie',
  REPRESENTATIVE: 'Reprezentant',
};

const accountStatusLabels: Record<string, string> = {
  ACTIVE: 'Activ',
  INVITED: 'Invitat',
  NOT_INVITED: 'Neinvitat',
  NO_ACCOUNT: 'Fără cont',
};

const methodLabels: Record<string, string> = {
  PHONE: 'Telefon',
  EMAIL: 'Email',
  APP: 'Aplicație',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
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

export default function AdminApartmentDetailPage() {
  const params = useParams<{ id?: string }>();
  const localizedPath = useLocalizedPath();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [apartment, setApartment] = useState<ApartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [apartmentForm, setApartmentForm] = useState(emptyApartmentForm);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadApartment = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminApartmentsCrmApi.get(id);
      setApartment(res.data || null);
    } catch (err: any) {
      setApartment(null);
      setError(String(err?.message || 'Nu am putut încărca apartamentul.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadApartment();
  }, [loadApartment]);

  const pageTitle = apartment ? `Apt. ${apartment.apartmentNumber}` : 'Apartament';
  const summary = useMemo(() => {
    if (!apartment) return '';
    return `Scara ${apartment.staircase || '-'} · Etaj ${apartment.floor || '-'} · ${apartment.areaM2 ? `${apartment.areaM2} m²` : 'fără suprafață'}`;
  }, [apartment]);

  function openEditModal() {
    if (!apartment) return;
    setApartmentForm({
      apartmentNumber: apartment.apartmentNumber,
      building: apartment.buildingName || 'Bloc principal',
      entrance: apartment.staircase || '1',
      floor: apartment.floor || '',
      areaM2: apartment.areaM2 ? String(apartment.areaM2) : '',
      rooms: apartment.rooms ? String(apartment.rooms) : '',
      cadastralNumber: apartment.cadastralNumber || '',
      status: apartment.status || 'UNKNOWN',
      internalNotes: apartment.internalNotes || '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function openContactModal() {
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
    if (!apartment) return;
    setFormError('');
    setSuccess('');
    const validation = validateApartmentForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    try {
      await adminApartmentsCrmApi.update(apartment.id, {
        apartmentNumber: apartmentForm.apartmentNumber.trim(),
        building: apartmentForm.building.trim() || 'Bloc principal',
        entrance: apartmentForm.entrance.trim() || '1',
        floor: apartmentForm.floor.trim() ? Number(apartmentForm.floor) : null,
        areaM2: apartmentForm.areaM2.trim() ? Number(apartmentForm.areaM2) : null,
        rooms: apartmentForm.rooms.trim() ? Number(apartmentForm.rooms) : null,
        cadastralNumber: apartmentForm.cadastralNumber.trim(),
        status: apartmentForm.status,
        internalNotes: apartmentForm.internalNotes.trim(),
      });
      setFormOpen(false);
      setSuccess('Apartamentul a fost actualizat.');
      await loadApartment();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva apartamentul.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveContact() {
    if (!apartment) return;
    setFormError('');
    setSuccess('');
    if (!contactForm.fullName.trim()) {
      setFormError('Numele locatarului este obligatoriu.');
      return;
    }
    setSaving(true);
    try {
      await adminApartmentsCrmApi.linkResident(apartment.id, {
        fullName: contactForm.fullName.trim(),
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim(),
        role: contactForm.role,
        isPrimaryContact: contactForm.isPrimaryContact,
        preferredContactMethod: contactForm.preferredContactMethod,
        status: contactForm.status,
      });
      setContactOpen(false);
      setSuccess('Locatarul a fost conectat la apartament.');
      await loadApartment();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva locatarul.'));
    } finally {
      setSaving(false);
    }
  }

  async function setPrimaryContact(residentId: string) {
    if (!apartment) return;
    setSuccess('');
    setError('');
    try {
      await adminApartmentsCrmApi.setPrimaryContact(apartment.id, residentId);
      setSuccess('Contactul principal a fost actualizat.');
      await loadApartment();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut seta contactul principal.'));
    }
  }

  async function markVacant() {
    if (!apartment) return;
    setSuccess('');
    setError('');
    try {
      await adminApartmentsCrmApi.update(apartment.id, {
        apartmentNumber: apartment.apartmentNumber,
        building: apartment.buildingName || 'Bloc principal',
        entrance: apartment.staircase || '1',
        floor: apartment.floor ? Number(apartment.floor) : null,
        areaM2: apartment.areaM2,
        rooms: apartment.rooms ?? null,
        cadastralNumber: apartment.cadastralNumber || '',
        status: 'VACANT',
        internalNotes: apartment.internalNotes || '',
      });
      setSuccess('Apartamentul a fost marcat ca liber.');
      await loadApartment();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut actualiza statusul apartamentului.'));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <Card className="h-28 animate-pulse bg-muted/40" />
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-28 animate-pulse bg-muted/40" />)}
        </div>
      </div>
    );
  }

  if (!apartment) {
    return (
      <div className="space-y-5 pb-8">
        <Link href={localizedPath('/admin/apartments')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la apartamente
        </Link>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Apartamentul nu a fost găsit</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Înregistrarea nu este disponibilă pentru asociația curentă.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/admin/apartments')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la apartamente
      </Link>

      <PageHeader
        title={pageTitle}
        description={summary}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={completenessVariant[apartment.completenessStatus]}>{completenessLabels[apartment.completenessStatus]}</Badge>
            <Button variant="secondary" onClick={openContactModal}>
              <Plus className="h-4 w-4" />
              Adaugă locatar/proprietar
            </Button>
            <Button onClick={openEditModal}>
              <Pencil className="h-4 w-4" />
              Editează apartament
            </Button>
          </div>
        }
      />

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Status" value={statusLabels[apartment.status]} description="Situația apartamentului" icon={<Home className="h-5 w-5" />} />
        <StatCard label="Suprafață" value={apartment.areaM2 ? `${apartment.areaM2} m²` : 'Lipsă'} description="Suprafață declarată" icon={<Building2 className="h-5 w-5" />} tone={apartment.areaM2 ? 'neutral' : 'warning'} />
        <StatCard label="Locatari/proprietari" value={apartment.residents.length} description="Relații conectate" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Contact principal" value={apartment.primaryContact ? 'Setat' : 'Lipsă'} description={apartment.primaryContact?.fullName || 'Necesită completare'} icon={<UserCheck className="h-5 w-5" />} tone={apartment.primaryContact ? 'success' : 'warning'} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">General</h2>
                <p className="text-sm text-muted-foreground">Datele de bază ale apartamentului în A.P.C.</p>
              </div>
              <Badge variant="neutral">Actualizat {formatDate(apartment.updatedAt)}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoLine label="Număr apartament" value={apartment.apartmentNumber} />
              <InfoLine label="Bloc / corp" value={apartment.buildingName || '-'} />
              <InfoLine label="Scara" value={apartment.staircase || '-'} />
              <InfoLine label="Etaj" value={apartment.floor || '-'} />
              <InfoLine label="Suprafață m²" value={apartment.areaM2 ? `${apartment.areaM2} m²` : '-'} />
              <InfoLine label="Număr cadastral" value={apartment.cadastralNumber || '-'} />
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Locatari și proprietari</h2>
                <p className="text-sm text-muted-foreground">Un apartament poate avea mai multe persoane conectate.</p>
              </div>
              <Button variant="secondary" onClick={openContactModal}>
                <Plus className="h-4 w-4" />
                Adaugă
              </Button>
            </div>

            {!apartment.residents.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Nu există locatari sau proprietari conectați la acest apartament.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {apartment.residents.map((resident) => (
                  <div key={`${resident.residentId}-${resident.role}`} className="rounded-2xl border border-border/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.035)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{resident.fullName}</h3>
                          {resident.isPrimaryContact ? <Badge variant="success">Contact principal</Badge> : null}
                          <Badge variant="neutral">{roleLabels[resident.role] || resident.role}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" /> {resident.phone || '-'}</span>
                          <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" /> {resident.email || '-'}</span>
                        </div>
                      </div>
                      {!resident.isPrimaryContact ? (
                        <Button variant="secondary" onClick={() => setPrimaryContact(resident.residentId)}>
                          Setează contact principal
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <InfoLine label="Status cont" value={accountStatusLabels[resident.accountStatus] || resident.accountStatus || '-'} />
                      <InfoLine label="Contact preferat" value={methodLabels[resident.preferredContactMethod] || resident.preferredContactMethod || '-'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Note interne</h2>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
              {apartment.internalNotes || 'Nu există note interne pentru acest apartament.'}
            </p>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <h2 className="text-lg font-semibold text-foreground">Acțiuni</h2>
            <div className="mt-4 grid gap-2">
              <Button onClick={openEditModal}>
                <Pencil className="h-4 w-4" />
                Editează apartament
              </Button>
              <Button variant="secondary" onClick={openContactModal}>
                <Plus className="h-4 w-4" />
                Adaugă locatar/proprietar
              </Button>
              <Button variant="secondary" onClick={markVacant} disabled={apartment.status === 'VACANT'}>
                Marchează ca liber
              </Button>
              <Link href={localizedPath('/admin/apartments')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold">
                Înapoi la listă
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-foreground">Istoric scurt</h2>
            <div className="mt-4 space-y-3">
              {(apartment.activity || []).map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-2xl bg-muted/35 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-muted-foreground">{formatDate(item.date)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-foreground">Operațiuni asociate</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <InfoLine label="Contoare" value={String(apartment.meters.length)} />
              <InfoLine label="Facturi" value={String(apartment.invoices.length)} />
              <InfoLine label="Plăți" value={String(apartment.payments.length)} />
              <InfoLine label="Cereri" value={String(apartment.issues.length)} />
            </div>
          </Card>
        </aside>
      </div>

      <ApartmentFormModal
        open={formOpen}
        form={apartmentForm}
        error={formError}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onChange={setApartmentForm}
        onSave={saveApartment}
      />

      <ContactModal
        open={contactOpen}
        apartmentNumber={apartment.apartmentNumber}
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

function ApartmentFormModal({
  open,
  form,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  form: typeof emptyApartmentForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyApartmentForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title="Editează apartament" onClose={onClose} />
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
  apartmentNumber,
  form,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  apartmentNumber: string;
  form: typeof emptyContactForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyContactForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={`Adaugă locatar/proprietar · Apt. ${apartmentNumber}`} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Nume complet" value={form.fullName} onChange={(event) => onChange({ ...form, fullName: event.target.value })} />
          <Input label="Telefon" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
          <Input label="Email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
          <Select value={form.role} onChange={(value) => onChange({ ...form, role: value as ContactRole })} options={['OWNER', 'TENANT', 'REPRESENTATIVE']} labels={{ OWNER: 'Proprietar', TENANT: 'Chiriaș', REPRESENTATIVE: 'Reprezentant' }} />
          <Select value={form.preferredContactMethod} onChange={(value) => onChange({ ...form, preferredContactMethod: value as ContactMethod })} options={['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM']} labels={methodLabels} />
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
