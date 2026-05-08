'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, Mail, MapPin, Phone, UserPlus } from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import {
  mockAdministrators,
  mockAssociations,
  mockUsage,
  normalizeApiAdministrator,
  normalizeApiAssociation,
  normalizeApiUsage,
  statusBadgeVariant,
  statusLabel,
  type AssociationStatus,
  type MvpAdministrator,
  type MvpAssociation,
  type MvpUsage,
} from '@/lib/superadmin-mvp-data';

function associationFromId(id: string): MvpAssociation {
  return {
    id,
    name: 'A.P.C.',
    legalName: 'Asociația de Proprietari din Condominiu',
    shortName: 'A.P.C.',
    associationCode: '',
    associationNumber: '',
    address: 'Adresă necompletată',
    city: 'Chișinău',
    country: 'Republica Moldova',
    currency: 'MDL',
    status: 'TRIAL',
    apartmentsCount: 0,
    administratorName: 'Administrator neatribuit',
    administratorEmail: '',
    administratorPhone: '',
  };
}

const emptyAdminForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
};

function editFormFromAssociation(association: MvpAssociation) {
  return {
    associationCode: association.associationCode || '',
    legalName: association.legalName || '',
    shortName: association.shortName || '',
    address: association.address || '',
    city: association.city || 'Chișinău',
    country: association.country || 'Republica Moldova',
    currency: association.currency,
    status: association.status,
  };
}

export default function SuperadminOrganizationDetailsPage() {
  const localizedPath = useLocalizedPath();
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const fallbackAssociation = useMemo(
    () => mockAssociations.find((item) => item.id === id) ?? associationFromId(id),
    [id],
  );
  const [association, setAssociation] = useState<MvpAssociation>(fallbackAssociation);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [administrators, setAdministrators] = useState<MvpAdministrator[]>(
    mockAdministrators.filter((admin) => admin.organizationId === id),
  );
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [usage, setUsage] = useState<MvpUsage>(mockUsage);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => editFormFromAssociation(fallbackAssociation));
  const [isUpdatingAssociation, setIsUpdatingAssociation] = useState(false);
  const [editError, setEditError] = useState('');

  const loadAdmins = async (organizationId: string) => {
    const res = await superadminApi.listPublicOrganizationAdmins(organizationId);
    const apiAdmins = (res.data || []).map(normalizeApiAdministrator);
    setAdministrators(apiAdmins);
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    superadminApi
      .getPublicOrganization(id)
      .then((res) => {
        if (!active) return;
        const nextAssociation = normalizeApiAssociation(res.data);
        setAssociation(nextAssociation);
        setEditForm(editFormFromAssociation(nextAssociation));
        setSource('api');
        loadAdmins(id).catch(() => {
          setAdministrators(mockAdministrators.filter((admin) => admin.organizationId === id));
        });
        superadminApi.getOrganizationUsage(id).then((usageRes) => {
          if (active) setUsage(normalizeApiUsage(usageRes.data));
        }).catch(() => undefined);
      })
      .catch(() => {
        if (!active) return;
        setAssociation(fallbackAssociation);
        setSource('mock');
        setAdministrators(mockAdministrators.filter((admin) => admin.organizationId === id));
      });
    return () => {
      active = false;
    };
  }, [fallbackAssociation, id]);

  const createAdmin = async () => {
    setAdminError('');
    setSuccessMessage('');
    if (!id) return;
    const payload = {
      firstName: adminForm.firstName.trim(),
      lastName: adminForm.lastName.trim(),
      email: adminForm.email.trim(),
      phone: adminForm.phone.trim(),
      password: adminForm.password,
    };
    if (!payload.firstName || !payload.lastName || !payload.email || !payload.password) {
      setAdminError('Completează prenumele, numele, emailul și parola temporară.');
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const created = await superadminApi.createPublicOrganizationAdmin(id, payload);
      const next = normalizeApiAdministrator(created.data);
      setAdministrators((current) => [next, ...current.filter((admin) => admin.id !== next.id)]);
      setAdminForm(emptyAdminForm);
      setAdminModalOpen(false);
      setSuccessMessage('Administratorul a fost creat.');
      await loadAdmins(id).catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setAdminError(message.includes('Există deja un utilizator cu acest email') ? 'Există deja un utilizator cu acest email.' : 'Nu am putut crea administratorul.');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const updateStatus = async (status: AssociationStatus) => {
    if (!id) return;
    setSuccessMessage('');
    setUpdatingStatus(true);
    try {
      const updated = await superadminApi.updatePublicOrganizationStatus(id, status);
      const nextAssociation = normalizeApiAssociation(updated.data);
      setAssociation(nextAssociation);
      setEditForm(editFormFromAssociation(nextAssociation));
      setSource('api');
      setSuccessMessage('Statusul asociației a fost actualizat.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateAssociation = async () => {
    if (!id) return;
    setEditError('');
    setSuccessMessage('');
    if (!editForm.associationCode || !editForm.legalName || !editForm.shortName || !editForm.address || !editForm.city) {
      setEditError('Completează codul APC, denumirile, adresa și orașul.');
      return;
    }
    if (!/^A\d{4}-\d{4}$/.test(editForm.associationCode.trim().toUpperCase())) {
      setEditError('Format recomandat: A0123-0940');
      return;
    }

    setIsUpdatingAssociation(true);
    try {
      const updated = await superadminApi.updatePublicOrganization(id, {
        associationCode: editForm.associationCode.trim().toUpperCase(),
        legalName: editForm.legalName.trim(),
        shortName: editForm.shortName.trim(),
        address: editForm.address.trim(),
        city: editForm.city.trim(),
        country: editForm.country.trim(),
        currency: editForm.currency,
        status: editForm.status,
      });
      const nextAssociation = normalizeApiAssociation(updated.data);
      setAssociation(nextAssociation);
      setEditForm(editFormFromAssociation(nextAssociation));
      setSource('api');
      setEditModalOpen(false);
      setSuccessMessage('Asociația a fost actualizată.');
    } catch {
      setEditError('Nu am putut actualiza asociația.');
    } finally {
      setIsUpdatingAssociation(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title={association.shortName}
        description={association.legalName}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            <Link href={localizedPath('/superadmin/organizations')} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Înapoi la asociații
            </Link>
            <Link href={localizedPath(`/superadmin/organizations/${id}/subscription`)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Abonament
            </Link>
            <button type="button" onClick={() => setEditModalOpen(true)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Editează
            </button>
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              <UserPlus className="h-4 w-4" />
              Adaugă administrator
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
        <StatCard label="Apartamente" value={association.apartmentsCount} description="Unități administrate" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Status" value={statusLabel(association.status)} description="Stare platformă" icon={<Building2 className="h-5 w-5" />} tone={association.status === 'ACTIVE' ? 'success' : 'warning'} />
        <StatCard label="Monedă" value={association.currency} description="Pentru plăți și solduri" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Administratori" value={Math.max(administrators.length, association.administratorEmail ? 1 : 0)} description="Conturi ADMIN" icon={<UserPlus className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Control status</h2>
            <p className="mt-1 text-sm text-muted-foreground">Activează, pune în trial sau dezactivează accesul asociației.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusButton disabled={updatingStatus || association.status === 'ACTIVE'} onClick={() => updateStatus('ACTIVE')}>Activează</StatusButton>
            <StatusButton disabled={updatingStatus || association.status === 'TRIAL'} onClick={() => updateStatus('TRIAL')}>Pune în trial</StatusButton>
            <StatusButton disabled={updatingStatus || association.status === 'INACTIVE'} onClick={() => updateStatus('INACTIVE')}>Dezactivează</StatusButton>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Apartamente utilizate" value={usage.apartmentsCount} description={`${usage.usagePercentage}% din limită`} icon={<Building2 className="h-5 w-5" />} tone={usage.usagePercentage > 90 ? 'warning' : 'success'} />
        <StatCard label="Utilizatori" value={usage.usersCount} description="Conturi platformă" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Locatari" value={usage.residentsCount} description="Profiluri persoane" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Contoare" value={usage.metersCount} description="Apă, gaz, electricitate" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Facturi" value={usage.invoicesCount} description="Înregistrări lunare" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Limită plan" value={usage.apartmentLimit} description="Apartamente incluse" icon={<Building2 className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Date asociație</h2>
              <p className="mt-1 text-sm text-muted-foreground">Identitatea A.P.C. folosită în Republica Moldova.</p>
            </div>
            <Badge variant={statusBadgeVariant(association.status)}>{statusLabel(association.status)}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info icon={<Building2 className="h-4 w-4" />} label="Denumire lungă" value={association.legalName} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Denumire scurtă" value={association.shortName} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Cod APC" value={association.associationCode || '-'} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Număr intern" value={association.associationNumber || '-'} />
            <Info icon={<MapPin className="h-4 w-4" />} label="Adresă" value={`${association.address}, ${association.city}, ${association.country}`} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Oraș" value={association.city} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Țară" value={association.country || 'Republica Moldova'} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Monedă" value={association.currency} />
            <Info icon={<Building2 className="h-4 w-4" />} label="Apartamente" value={`${association.apartmentsCount} apartamente`} />
            <Info icon={<Mail className="h-4 w-4" />} label="Email administrator" value={association.administratorEmail || '-'} />
            <Info icon={<Phone className="h-4 w-4" />} label="Telefon administrator" value={association.administratorPhone || '-'} />
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-foreground">Administrator principal</h2>
          <div className="mt-5 grid gap-3">
            {(administrators.length ? administrators : [
              {
                id: 'fallback-admin',
                firstName: association.administratorName,
                lastName: '',
                email: association.administratorEmail,
                phone: association.administratorPhone,
                role: 'ADMIN' as const,
                organizationId: association.id,
              },
            ]).map((admin) => (
              <div key={admin.id} className="rounded-[1.1rem] border border-border/70 bg-muted/25 p-4">
                <p className="font-semibold text-foreground">{`${admin.firstName} ${admin.lastName}`.trim() || 'Administrator neatribuit'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{admin.email || 'Email necompletat'}</p>
                <p className="text-sm text-muted-foreground">{admin.phone || 'Telefon necompletat'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="success">ADMIN</Badge>
                  <Badge variant={admin.isActive === false ? 'neutral' : 'success'}>{admin.isActive === false ? 'Inactiv' : 'Activ'}</Badge>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setAdminModalOpen(true)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            Adaugă administrator
          </button>
        </Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Pași MVP</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Asociație creată', 'Administrator atribuit', 'Pregătită pentru import apartamente'].map((step) => (
            <div key={step} className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium text-foreground">
              {step}
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Adaugă administrator" onClose={() => setAdminModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Prenume" value={adminForm.firstName} onChange={(value) => setAdminForm({ ...adminForm, firstName: value })} required />
            <Field label="Nume" value={adminForm.lastName} onChange={(value) => setAdminForm({ ...adminForm, lastName: value })} required />
            <Field label="Email" value={adminForm.email} onChange={(value) => setAdminForm({ ...adminForm, email: value })} type="email" required />
            <Field label="Telefon" value={adminForm.phone} onChange={(value) => setAdminForm({ ...adminForm, phone: value })} />
            <Field label="Parolă temporară" value={adminForm.password} onChange={(value) => setAdminForm({ ...adminForm, password: value })} type="password" required />
          </div>
          {adminError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {adminError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Parola temporară este salvată doar ca hash. Trimite parola administratorului printr-un canal sigur.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setAdminModalOpen(false)} disabled={isCreatingAdmin} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createAdmin} disabled={isCreatingAdmin} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreatingAdmin ? 'Se creează...' : 'Creează administrator'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Editează asociația" onClose={() => setEditModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cod APC" value={editForm.associationCode} onChange={(value) => setEditForm({ ...editForm, associationCode: value.trim().toUpperCase() })} required />
            <Field label="Denumire lungă" value={editForm.legalName} onChange={(value) => setEditForm({ ...editForm, legalName: value })} required />
            <Field label="Denumire scurtă" value={editForm.shortName} onChange={(value) => setEditForm({ ...editForm, shortName: value })} required />
            <Field label="Adresă" value={editForm.address} onChange={(value) => setEditForm({ ...editForm, address: value })} required />
            <Field label="Oraș" value={editForm.city} onChange={(value) => setEditForm({ ...editForm, city: value })} required />
            <Field label="Țară" value={editForm.country} onChange={(value) => setEditForm({ ...editForm, country: value })} />
            <label className="block">
              <span className="label">Monedă</span>
              <select className="select" value={editForm.currency} onChange={(event) => setEditForm({ ...editForm, currency: event.target.value as MvpAssociation['currency'] })}>
                <option value="MDL">MDL</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as AssociationStatus })}>
                <option value="ACTIVE">Activă</option>
                <option value="TRIAL">Trial</option>
                <option value="INACTIVE">Inactivă</option>
              </select>
            </label>
          </div>
          {editError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {editError}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setEditModalOpen(false)} disabled={isUpdatingAssociation} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={updateAssociation} disabled={isUpdatingAssociation} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isUpdatingAssociation ? 'Se salvează...' : 'Salvează'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 font-medium text-foreground">{value}</p>
    </div>
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

function StatusButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}
