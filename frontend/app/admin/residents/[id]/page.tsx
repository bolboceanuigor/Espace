'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Mail, Pencil, Phone, Plus, StickyNote, Unlink, UserCheck, UserRound } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { adminResidentsCrmApi } from '@/lib/api';
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
  relationStartDate?: string;
  relationEndDate?: string;
  notes?: string;
};

type ApartmentOption = {
  id: string;
  apartmentNumber: string;
  staircase: string;
  floor: string;
  buildingName?: string;
};

type ResidentDetail = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  preferredContactMethod: ContactMethod;
  status: ResidentStatus;
  portalAccess?: {
    status: 'NO_ACCESS' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    activatedAt?: string | null;
    latestInvitation?: { status: string; expiresAt?: string | null } | null;
    user?: { email?: string; fullName?: string } | null;
  };
  role: ContactRole;
  apartments: ApartmentLink[];
  apartmentsCount: number;
  isPrimaryContactSomewhere: boolean;
  completenessStatus: 'COMPLETE' | 'NO_APARTMENT' | 'NO_PHONE' | 'NO_EMAIL' | 'INACTIVE';
  internalNotes: string;
  issues: any[];
  messages: any[];
  activity: Array<{ label: string; date?: string }>;
  apartmentOptions: ApartmentOption[];
  updateRequests?: Array<{
    id: string;
    requestType: string;
    requestTypeLabel?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    currentValueLabel?: string;
    requestedValueLabel?: string;
    message?: string;
    adminResponse?: string;
    createdAt?: string;
    reviewedAt?: string | null;
  }>;
  updatedAt: string;
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

const updateRequestStatusLabels = {
  PENDING: 'Pending',
  APPROVED: 'Aprobată',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
} as const;

const updateRequestStatusVariant = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
} as const;

const portalAccessLabels = {
  NO_ACCESS: 'Fără acces',
  INVITED: 'Invitat',
  ACTIVE: 'Activ',
  SUSPENDED: 'Suspendat',
  REVOKED: 'Revocat',
} as const;

const portalAccessVariant = {
  NO_ACCESS: 'neutral',
  INVITED: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
  REVOKED: 'error',
} as const;

function portalAccessTone(status?: keyof typeof portalAccessLabels): 'neutral' | 'success' | 'warning' | 'danger' {
  const variant = portalAccessVariant[status || 'NO_ACCESS'];
  return variant === 'error' ? 'danger' : variant;
}

export default function AdminResidentDetailPage() {
  const params = useParams<{ id?: string }>();
  const localizedPath = useLocalizedPath();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [resident, setResident] = useState<ResidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [personForm, setPersonForm] = useState(emptyPersonForm);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<ApartmentLink | null>(null);
  const [relationForm, setRelationForm] = useState(emptyRelationForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadResident = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminResidentsCrmApi.get(id);
      setResident(res.data || null);
    } catch (err: any) {
      setResident(null);
      setError(String(err?.message || 'Nu am putut încărca persoana.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadResident();
  }, [loadResident]);

  function openEditModal() {
    if (!resident) return;
    setPersonForm({
      fullName: resident.fullName,
      phone: resident.phone || '',
      email: resident.email || '',
      preferredContactMethod: resident.preferredContactMethod || 'PHONE',
      status: resident.status || 'NOT_INVITED',
      internalNotes: resident.internalNotes || '',
    });
    setFormError('');
    setPersonModalOpen(true);
  }

  function openLinkModal() {
    if (!resident) return;
    setEditingRelation(null);
    setRelationForm({
      ...emptyRelationForm,
      apartmentId: resident.apartmentOptions?.[0]?.id || '',
    });
    setFormError('');
    setRelationModalOpen(true);
  }

  function openEditRelationModal(relation: ApartmentLink) {
    setEditingRelation(relation);
    setRelationForm({
      apartmentId: relation.apartmentId,
      role: relation.role,
      isPrimaryContact: relation.isPrimaryContact,
      relationStartDate: relation.relationStartDate || '',
      relationEndDate: relation.relationEndDate || '',
      notes: relation.notes || '',
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
    if (!resident) return;
    setFormError('');
    setSuccess('');
    const validation = validatePersonForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    try {
      await adminResidentsCrmApi.update(resident.id, {
        fullName: personForm.fullName.trim(),
        phone: personForm.phone.trim(),
        email: personForm.email.trim(),
        preferredContactMethod: personForm.preferredContactMethod,
        status: personForm.status,
        internalNotes: personForm.internalNotes.trim(),
      });
      setPersonModalOpen(false);
      setSuccess('Persoana a fost actualizată.');
      await loadResident();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva persoana.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveRelation() {
    if (!resident) return;
    setFormError('');
    setSuccess('');
    if (!relationForm.apartmentId) {
      setFormError('Apartamentul este obligatoriu.');
      return;
    }
    setSaving(true);
    try {
      if (editingRelation) {
        await adminResidentsCrmApi.updateApartmentRelation(resident.id, editingRelation.apartmentId, relationForm);
        setSuccess('Legătura cu apartamentul a fost actualizată.');
      } else {
        await adminResidentsCrmApi.linkApartment(resident.id, relationForm);
        setSuccess('Persoana a fost legată la apartament.');
      }
      setRelationModalOpen(false);
      await loadResident();
    } catch (err: any) {
      setFormError(String(err?.message || 'Nu am putut salva legătura cu apartamentul.'));
    } finally {
      setSaving(false);
    }
  }

  async function setPrimary(relation: ApartmentLink) {
    if (!resident) return;
    setSuccess('');
    setError('');
    try {
      await adminResidentsCrmApi.updateApartmentRelation(resident.id, relation.apartmentId, {
        role: relation.role,
        isPrimaryContact: true,
        notes: relation.notes || '',
        relationStartDate: relation.relationStartDate || '',
        relationEndDate: relation.relationEndDate || '',
      });
      setSuccess('Contactul principal a fost actualizat.');
      await loadResident();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut seta contactul principal.'));
    }
  }

  async function unlinkApartment(relation: ApartmentLink) {
    if (!resident) return;
    setSuccess('');
    setError('');
    try {
      await adminResidentsCrmApi.unlinkApartment(resident.id, relation.apartmentId);
      setSuccess('Legătura cu apartamentul a fost eliminată.');
      await loadResident();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut elimina legătura cu apartamentul.'));
    }
  }

  async function deactivateResident() {
    if (!resident) return;
    setSuccess('');
    setError('');
    try {
      await adminResidentsCrmApi.updateStatus(resident.id, 'INACTIVE');
      setSuccess('Persoana a fost dezactivată.');
      await loadResident();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut dezactiva persoana.'));
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

  if (!resident) {
    return (
      <div className="space-y-5 pb-8">
        <Link href={localizedPath('/admin/residents')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la locatari
        </Link>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Persoana nu a fost găsită</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Înregistrarea nu este disponibilă pentru asociația curentă.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/admin/residents')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la locatari
      </Link>

      <PageHeader
        title={resident.fullName}
        description={`${statusLabels[resident.status]} · ${resident.apartments.map((item) => `Apt. ${item.apartmentNumber}`).join(', ') || 'fără apartament'}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={completenessVariant[resident.completenessStatus]}>{completenessLabels[resident.completenessStatus]}</Badge>
            <Link href={localizedPath(`/admin/residents/${resident.id}/access`)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/70">
              <UserCheck className="h-4 w-4" />
              Acces portal
            </Link>
            <Button variant="secondary" onClick={openLinkModal}>
              <Plus className="h-4 w-4" />
              Leagă apartament
            </Button>
            <Button onClick={openEditModal}>
              <Pencil className="h-4 w-4" />
              Editează persoană
            </Button>
          </div>
        }
      />

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Status" value={statusLabels[resident.status]} description="Status CRM persoană" icon={<UserRound className="h-5 w-5" />} tone={resident.status === 'INACTIVE' ? 'danger' : statusVariant[resident.status]} />
        <StatCard label="Acces portal" value={portalAccessLabels[resident.portalAccess?.status || 'NO_ACCESS']} description={resident.portalAccess?.user?.email || 'User portal'} icon={<UserCheck className="h-5 w-5" />} tone={portalAccessTone(resident.portalAccess?.status)} />
        <StatCard label="Telefon" value={resident.phone || 'Lipsă'} description={resident.email || 'Email necompletat'} icon={<Phone className="h-5 w-5" />} tone={resident.phone ? 'neutral' : 'warning'} />
        <StatCard label="Apartamente" value={resident.apartmentsCount} description="Relații apartament-persoană" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Contact principal" value={resident.isPrimaryContactSomewhere ? 'Da' : 'Nu'} description={methodLabels[resident.preferredContactMethod]} icon={<UserCheck className="h-5 w-5" />} tone={resident.isPrimaryContactSomewhere ? 'success' : 'warning'} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Profil</h2>
                <p className="text-sm text-muted-foreground">Date de contact și preferințe de comunicare.</p>
              </div>
              <Badge variant={statusVariant[resident.status]}>{statusLabels[resident.status]}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoLine label="Nume complet" value={resident.fullName} />
              <InfoLine label="Telefon" value={resident.phone || '-'} />
              <InfoLine label="Email" value={resident.email || '-'} />
              <InfoLine label="Metodă contact" value={methodLabels[resident.preferredContactMethod]} />
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Apartamente legate</h2>
                <p className="text-sm text-muted-foreground">Relații între persoană și apartamentele din asociație.</p>
              </div>
              <Button variant="secondary" onClick={openLinkModal}>
                <Plus className="h-4 w-4" />
                Leagă apartament
              </Button>
            </div>
            {!resident.apartments.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Persoana nu este legată încă de niciun apartament.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {resident.apartments.map((relation) => (
                  <div key={`${relation.apartmentId}-${relation.role}`} className="rounded-2xl border border-border/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.035)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={localizedPath(`/admin/apartments/${relation.apartmentId}`)} className="font-semibold text-foreground hover:underline">
                            Apt. {relation.apartmentNumber}
                          </Link>
                          <Badge variant="neutral">{roleLabels[relation.role] || relation.role}</Badge>
                          {relation.isPrimaryContact ? <Badge variant="success">Contact principal</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Scara {relation.staircase || '-'} · Etaj {relation.floor || '-'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!relation.isPrimaryContact ? <Button variant="secondary" onClick={() => setPrimary(relation)}>Setează primary</Button> : null}
                        <Button variant="secondary" onClick={() => openEditRelationModal(relation)}>Schimbă rolul</Button>
                        <Button variant="secondary" onClick={() => unlinkApartment(relation)}>
                          <Unlink className="h-4 w-4" />
                          Elimină
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <InfoLine label="Data început" value={relation.relationStartDate || '-'} />
                      <InfoLine label="Data final" value={relation.relationEndDate || '-'} />
                    </div>
                    {relation.notes ? <p className="mt-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm text-muted-foreground">{relation.notes}</p> : null}
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
              {resident.internalNotes || 'Nu există note interne pentru această persoană.'}
            </p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Solicitări actualizare date</h2>
                <p className="text-sm text-muted-foreground">Ultimele cereri trimise de locatar pentru date personale sau relații cu apartamentele.</p>
              </div>
              <ButtonLink href={`/admin/resident-update-requests?search=${encodeURIComponent(resident.fullName)}`} variant="secondary">
                Vezi toate solicitările
              </ButtonLink>
            </div>
            {!resident.updateRequests?.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Nu există solicitări de actualizare pentru această persoană.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {resident.updateRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-border/70 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{request.requestTypeLabel || request.requestType}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {request.currentValueLabel || '-'} → <span className="font-medium text-foreground">{request.requestedValueLabel || '-'}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Trimisă la {formatDate(request.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={updateRequestStatusVariant[request.status]}>{updateRequestStatusLabels[request.status]}</Badge>
                        <ButtonLink href={`/admin/resident-update-requests/${request.id}`} size="sm" variant="secondary">
                          Deschide
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <h2 className="text-lg font-semibold text-foreground">Acțiuni</h2>
            <div className="mt-4 grid gap-2">
              <Button onClick={openEditModal}>
                <Pencil className="h-4 w-4" />
                Editează persoană
              </Button>
              <Button variant="secondary" onClick={openLinkModal}>
                <Plus className="h-4 w-4" />
                Leagă apartament
              </Button>
              <Button variant="secondary" onClick={deactivateResident} disabled={resident.status === 'INACTIVE'}>
                Dezactivează persoana
              </Button>
              <Link href={localizedPath('/admin/residents')} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold">
                Înapoi la listă
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-foreground">Istoric scurt</h2>
            <div className="mt-4 space-y-3">
              {(resident.activity || []).map((item, index) => (
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
              <InfoLine label="Solicitări" value={String(resident.issues.length)} />
              <InfoLine label="Mesaje" value={String(resident.messages.length)} />
              <InfoLine label="Apartamente" value={String(resident.apartments.length)} />
            </div>
            <Link href={localizedPath(`/admin/requests?residentId=${resident.id}`)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
              Vezi solicitările locatarului
            </Link>
          </Card>
        </aside>
      </div>

      <PersonModal
        open={personModalOpen}
        form={personForm}
        error={formError}
        saving={saving}
        onClose={() => setPersonModalOpen(false)}
        onChange={setPersonForm}
        onSave={savePerson}
      />
      <RelationModal
        open={relationModalOpen}
        title={editingRelation ? 'Editează legătura cu apartamentul' : 'Leagă apartament'}
        form={relationForm}
        apartmentOptions={resident.apartmentOptions || []}
        lockedApartment={Boolean(editingRelation)}
        error={formError}
        saving={saving}
        onClose={() => setRelationModalOpen(false)}
        onChange={setRelationForm}
        onSave={saveRelation}
      />
    </div>
  );
}

function PersonModal({
  open,
  form,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  form: typeof emptyPersonForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyPersonForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title="Editează persoană" onClose={onClose} />
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
  title,
  form,
  apartmentOptions,
  lockedApartment,
  error,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  title: string;
  form: typeof emptyRelationForm;
  apartmentOptions: ApartmentOption[];
  lockedApartment: boolean;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (form: typeof emptyRelationForm) => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            value={form.apartmentId}
            onChange={(value) => onChange({ ...form, apartmentId: value })}
            options={['', ...apartmentOptions.map((item) => item.id)]}
            labels={{ '': 'Alege apartamentul', ...Object.fromEntries(apartmentOptions.map((item) => [item.id, `Apt. ${item.apartmentNumber} · Scara ${item.staircase || '-'}`])) }}
            disabled={lockedApartment}
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
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={onClose}>Anulează</Button>
        <Button isLoading={saving} onClick={onSave}>Salvează legătura</Button>
      </ModalFooter>
    </Modal>
  );
}

function Select({
  value,
  onChange,
  options,
  labels,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10 disabled:opacity-60">
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
