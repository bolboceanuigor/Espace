'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, CheckSquare, Mail, MapPin, Phone, StickyNote, UserPlus } from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invitationsApi, superadminApi } from '@/lib/api';
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
  sendEmail: false,
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidMoldovaPhone(value: string) {
  const normalized = value.replace(/[\s().-]/g, '');
  return /^\+373\d{8}$/.test(normalized) || /^0\d{8}$/.test(normalized);
}

type ClientNoteType = 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const emptyNoteForm = {
  type: 'OTHER' as ClientNoteType,
  title: '',
  content: '',
  followUpAt: '',
  isImportant: false,
};

const noteTypeLabels: Record<ClientNoteType, string> = {
  CALL: 'Apel',
  MEETING: 'Întâlnire',
  SUPPORT: 'Suport',
  SALES: 'Relație client',
  BILLING: 'Abonament',
  OTHER: 'Altă notă',
};

const emptyTaskForm = {
  title: '',
  description: '',
  dueDate: '',
  priority: 'MEDIUM' as TaskPriority,
};

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'De făcut',
  IN_PROGRESS: 'În lucru',
  DONE: 'Finalizat',
  CANCELLED: 'Anulat',
};

const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: 'Scăzută',
  MEDIUM: 'Normală',
  HIGH: 'Înaltă',
  URGENT: 'Urgentă',
};

const taskPriorityTone: Record<TaskPriority, 'neutral' | 'warning' | 'error'> = {
  LOW: 'neutral',
  MEDIUM: 'neutral',
  HIGH: 'warning',
  URGENT: 'error',
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
  const [adminInvitationLink, setAdminInvitationLink] = useState('');
  const [adminInviteWarning, setAdminInviteWarning] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [usage, setUsage] = useState<MvpUsage>(mockUsage);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => editFormFromAssociation(fallbackAssociation));
  const [isUpdatingAssociation, setIsUpdatingAssociation] = useState(false);
  const [editError, setEditError] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [notesError, setNotesError] = useState('');
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksError, setTasksError] = useState('');
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const loadAdmins = async (organizationId: string) => {
    const res = await superadminApi.listPublicOrganizationAdmins(organizationId);
    const apiAdmins = (res.data || []).map(normalizeApiAdministrator);
    setAdministrators(apiAdmins);
  };

  const loadNotes = async (organizationId: string) => {
    const res = await superadminApi.listOrganizationNotes(organizationId);
    setNotes(res.data || []);
    setNotesError('');
  };

  const loadTasks = async (organizationId: string) => {
    const res = await superadminApi.listOrganizationTasks(organizationId);
    setTasks(res.data || []);
    setTasksError('');
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
        loadNotes(id).catch(() => {
          if (active) setNotesError('Notele interne nu sunt disponibile temporar.');
        });
        loadTasks(id).catch(() => {
          if (active) setTasksError('Sarcinile nu sunt disponibile temporar.');
        });
      })
      .catch(() => {
        if (!active) return;
        setAssociation(fallbackAssociation);
        setSource('mock');
        setAdministrators(mockAdministrators.filter((admin) => admin.organizationId === id));
        setNotes([]);
        setTasks([]);
      });
    return () => {
      active = false;
    };
  }, [fallbackAssociation, id]);

  const createAdminInvitation = async () => {
    setAdminError('');
    setSuccessMessage('');
    setAdminInvitationLink('');
    setAdminInviteWarning('');
    if (!id) return;
    const payload = {
      firstName: adminForm.firstName.trim(),
      lastName: adminForm.lastName.trim(),
      email: adminForm.email.trim(),
      phone: adminForm.phone.trim(),
      sendEmail: adminForm.sendEmail,
    };
    if (!payload.firstName) {
      setAdminError('Prenumele este obligatoriu.');
      return;
    }
    if (!payload.lastName) {
      setAdminError('Numele este obligatoriu.');
      return;
    }
    if (!payload.email) {
      setAdminError('Emailul este obligatoriu.');
      return;
    }
    if (!isValidEmail(payload.email)) {
      setAdminError('Emailul nu este valid.');
      return;
    }
    if (payload.phone && !isValidMoldovaPhone(payload.phone)) {
      setAdminError('Telefonul nu este valid. Format recomandat: +373 6X XXX XXX');
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const created = await invitationsApi.createAdmin(id, payload);
      setAdminInvitationLink(created.data?.activationLink || created.data?.inviteLink || '');
      setAdminInviteWarning(created.data?.warning || '');
      setAdminForm(emptyAdminForm);
      setSuccessMessage(
        created.data?.emailSent
          ? 'Invitația a fost trimisă pe email.'
          : 'Invitația a fost creată. Copiază linkul și trimite-l manual.',
      );
      await loadAdmins(id).catch(() => undefined);
    } catch (error: any) {
      setAdminError(String(error?.message || 'Nu am putut crea invitația.'));
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
    if (!editForm.associationCode) {
      setEditError('Codul A.P.C. este obligatoriu.');
      return;
    }
    if (!editForm.legalName.trim()) {
      setEditError('Denumirea asociației este obligatorie.');
      return;
    }
    if (!editForm.shortName.trim()) {
      setEditError('Denumirea scurtă este obligatorie.');
      return;
    }
    if (!editForm.address.trim()) {
      setEditError('Adresa este obligatorie.');
      return;
    }
    if (!editForm.city.trim()) {
      setEditError('Orașul este obligatoriu.');
      return;
    }
    if (!/^A\d{4}-\d{4}$/.test(editForm.associationCode.trim().toUpperCase())) {
      setEditError('Format recomandat: A0123-0940.');
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
    } catch (error: any) {
      setEditError(String(error?.message || 'Nu am putut actualiza asociația.'));
    } finally {
      setIsUpdatingAssociation(false);
    }
  };

  const createNote = async () => {
    if (!id) return;
    setNotesError('');
    setSuccessMessage('');
    if (!noteForm.title.trim() || !noteForm.content.trim()) {
      setNotesError('Completează titlul și conținutul notei.');
      return;
    }
    setIsCreatingNote(true);
    try {
      await superadminApi.createOrganizationNote(id, {
        type: noteForm.type,
        title: noteForm.title.trim(),
        content: noteForm.content.trim(),
        followUpAt: noteForm.followUpAt ? new Date(noteForm.followUpAt).toISOString() : undefined,
        isImportant: noteForm.isImportant,
      });
      setNoteForm(emptyNoteForm);
      setSuccessMessage('Nota internă a fost salvată.');
      await loadNotes(id);
    } catch {
      setNotesError('Nu am putut salva nota internă.');
    } finally {
      setIsCreatingNote(false);
    }
  };

  const editNote = async (note: any) => {
    if (!id) return;
    const nextContent = window.prompt('Actualizează conținutul notei interne:', note.content || '');
    if (nextContent === null) return;
    if (!nextContent.trim()) {
      setNotesError('Conținutul notei este obligatoriu.');
      return;
    }
    setNotesError('');
    setSuccessMessage('');
    try {
      await superadminApi.updateClientNote(note.id, {
        content: nextContent.trim(),
        title: note.title || 'Notă internă',
        type: note.type || 'OTHER',
        isImportant: !!note.isImportant,
        followUpAt: note.followUpAt || undefined,
      });
      setSuccessMessage('Nota a fost salvată.');
      await loadNotes(id);
    } catch {
      setNotesError('Nu am putut salva nota.');
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!id) return;
    if (!window.confirm('Ștergi această notă internă?')) return;
    setNotesError('');
    setSuccessMessage('');
    try {
      await superadminApi.deleteClientNote(noteId);
      setSuccessMessage('Nota internă a fost ștearsă.');
      await loadNotes(id);
    } catch {
      setNotesError('Nu am putut șterge nota.');
    }
  };

  const markFollowUpDone = async (noteId: string) => {
    if (!id) return;
    setNotesError('');
    setSuccessMessage('');
    try {
      await superadminApi.markClientNoteFollowUpDone(noteId);
      setSuccessMessage('Follow-up-ul a fost finalizat.');
      await loadNotes(id);
    } catch {
      setNotesError('Nu am putut actualiza follow-up-ul.');
    }
  };

  const createTask = async () => {
    if (!id) return;
    setTasksError('');
    setSuccessMessage('');
    if (!taskForm.title.trim()) {
      setTasksError('Titlul sarcinii este obligatoriu.');
      return;
    }
    setIsCreatingTask(true);
    try {
      await superadminApi.createOrganizationTask(id, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined,
      });
      setTaskForm(emptyTaskForm);
      setSuccessMessage('Sarcina a fost salvată.');
      await loadTasks(id);
    } catch {
      setTasksError('Nu am putut salva sarcina.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!id) return;
    setTasksError('');
    setSuccessMessage('');
    try {
      await superadminApi.updateOrganizationTaskStatus(id, taskId, status);
      setSuccessMessage('Statusul sarcinii a fost actualizat.');
      await loadTasks(id);
    } catch {
      setTasksError('Nu am putut actualiza sarcina.');
    }
  };

  const createdFromAccessRequest = association.createdFromAccessRequest;

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
            <Link href={localizedPath(`/superadmin/associations/${id}/upgrade-requests`)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Cereri upgrade
            </Link>
            <Link href={localizedPath(`/superadmin/associations/${id}/saas-invoices`)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Facturi SaaS
            </Link>
            <button type="button" onClick={() => setEditModalOpen(true)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
              Editează
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminInvitationLink('');
                setAdminInviteWarning('');
                setAdminModalOpen(true);
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              <UserPlus className="h-4 w-4" />
              Invită administrator
            </button>
          </div>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      {createdFromAccessRequest ? (
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Creată din cerere de acces</h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span>Contact inițial: {createdFromAccessRequest.contactName || '-'}</span>
                <span>Telefon: {createdFromAccessRequest.phone || '-'}</span>
                {createdFromAccessRequest.convertedAt ? <span>Conversie: {formatDateTime(createdFromAccessRequest.convertedAt)}</span> : null}
              </div>
            </div>
            <Link href={localizedPath(`/superadmin/access-requests/${createdFromAccessRequest.id}`)} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              Deschide cererea inițială
            </Link>
          </div>
        </Card>
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
            <Info icon={<Building2 className="h-4 w-4" />} label="Cod A.P.C." value={association.associationCode || '-'} />
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
          <button
            type="button"
            onClick={() => {
              setAdminInvitationLink('');
              setAdminInviteWarning('');
              setAdminModalOpen(true);
            }}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            Invită administrator
          </button>
        </Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Fișă CRM A.P.C.</h2>
        <p className="mt-1 text-sm text-muted-foreground">Structura de lucru pentru client: profil, contacte, onboarding, abonament, activitate și follow-up.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CrmTile title="Profil A.P.C." description="Date legale, cod APC și adresă." status="Activ" />
          <CrmTile title="Administrator / contacte" description={administrators.length ? `${administrators.length} contact(e)` : 'Administrator neatribuit'} status={administrators.length ? 'Activ' : 'Necesită acțiune'} />
          <CrmTile title="Onboarding" description={association.apartmentsCount > 0 ? 'Apartamente în evidență' : 'Urmează importul apartamentelor'} status={association.apartmentsCount > 0 ? 'În lucru' : 'Următorul pas'} />
          <CrmTile title="Plan / abonament" description="Gestionare manuală prin pagina de abonament." status="Activ" />
          <CrmTile title="Upgrade requests" description="Istoricul cererilor este disponibil în pagina dedicată." status="Activ" />
          <CrmTile title="Activitate" description="Evenimentele platformei sunt disponibile în dashboard." status="Activ" />
          <CrmTile title="Note interne" description={notes.length ? `${notes.length} notă(e)` : 'Fără note încă'} status="Activ" />
          <CrmTile title="Sarcini / follow-up" description="Sarcinile sunt gestionate în board-ul Superadmin." status="Activ" />
          <CrmTile title="Suport" description="Sesiunile de suport rămân controlate de Superadmin." status="Activ" />
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <SectionTitle icon={<StickyNote className="h-5 w-5" />} title="Note interne" description="Istoric CRM vizibil doar pentru Superadmin." />
          <div className="space-y-3">
            {notes.slice(0, 6).map((note) => (
              <div key={note.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{note.title || 'Notă internă'}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={note.isImportant ? 'warning' : 'neutral'}>{noteTypeLabels[note.type as ClientNoteType] || 'Notă'}</Badge>
                    {note.followUpAt && !note.followUpDone ? <Badge variant="warning">Follow-up</Badge> : null}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{note.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {note.createdByUser ? <span>Autor: {formatUserName(note.createdByUser)}</span> : null}
                  {note.followUpAt ? <span>Follow-up: {formatDateTime(note.followUpAt)}</span> : null}
                  {note.followUpDoneAt ? <span>Finalizat: {formatDateTime(note.followUpDoneAt)}</span> : null}
                  {note.createdAt ? <span>Creată: {formatDateTime(note.createdAt)}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => editNote(note)} className="rounded-xl border border-border/70 bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60">
                    Editează
                  </button>
                  {note.followUpAt && !note.followUpDone ? (
                    <button type="button" onClick={() => markFollowUpDone(note.id)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                      Marchează follow-up finalizat
                    </button>
                  ) : null}
                  <button type="button" onClick={() => deleteNote(note.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100">
                    Șterge
                  </button>
                </div>
              </div>
            ))}
            {!notes.length ? (
              <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                Nu există note interne încă.
              </p>
            ) : null}
            {notesError ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {notesError}
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<CheckSquare className="h-5 w-5" />} title="Adaugă notă / follow-up" description="Note rapide pentru relația cu această A.P.C." />
          <div className="grid gap-3">
            <label className="block">
              <span className="label">Tip notă</span>
              <select className="select" value={noteForm.type} onChange={(event) => setNoteForm({ ...noteForm, type: event.target.value as ClientNoteType })}>
                {Object.entries(noteTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <Field label="Titlu" value={noteForm.title} onChange={(value) => setNoteForm({ ...noteForm, title: value })} />
            <label className="block">
              <span className="label">Conținut</span>
              <textarea className="min-h-[110px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground" value={noteForm.content} onChange={(event) => setNoteForm({ ...noteForm, content: event.target.value })} />
            </label>
            <label className="block">
              <span className="label">Următorul follow-up</span>
              <input className="input" type="datetime-local" value={noteForm.followUpAt} onChange={(event) => setNoteForm({ ...noteForm, followUpAt: event.target.value })} />
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground">
              <input type="checkbox" checked={noteForm.isImportant} onChange={(event) => setNoteForm({ ...noteForm, isImportant: event.target.checked })} />
              Notă importantă
            </label>
            <button type="button" onClick={createNote} disabled={isCreatingNote} className="min-h-10 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              {isCreatingNote ? 'Se salvează...' : 'Salvează nota'}
            </button>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <SectionTitle icon={<CheckSquare className="h-5 w-5" />} title="Sarcini / follow-up" description="Sarcini reale legate de această A.P.C." />
          <div className="space-y-3">
            {tasks.map((task) => {
              const status = String(task.status || 'TODO') as TaskStatus;
              const priority = String(task.priority || 'MEDIUM') as TaskPriority;
              return (
                <div key={task.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{task.title}</p>
                      {task.description ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.description}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={status === 'DONE' ? 'success' : status === 'CANCELLED' ? 'neutral' : 'warning'}>{taskStatusLabels[status] || status}</Badge>
                      <Badge variant={taskPriorityTone[priority] || 'neutral'}>{taskPriorityLabels[priority] || priority}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {task.dueDate ? <span>Scadență: {formatDateTime(task.dueDate)}</span> : <span>Fără scadență</span>}
                    {task.createdByUser ? <span>Creată de: {formatUserName(task.createdByUser)}</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {status !== 'IN_PROGRESS' && status !== 'DONE' ? (
                      <button type="button" onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')} className="rounded-xl border border-border/70 bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60">
                        Marchează în lucru
                      </button>
                    ) : null}
                    {status !== 'DONE' ? (
                      <button type="button" onClick={() => updateTaskStatus(task.id, 'DONE')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                        Finalizează
                      </button>
                    ) : null}
                    {status === 'DONE' || status === 'CANCELLED' ? (
                      <button type="button" onClick={() => updateTaskStatus(task.id, 'TODO')} className="rounded-xl border border-border/70 bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60">
                        Redeschide
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!tasks.length ? (
              <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                Nu există sarcini pentru această A.P.C.
              </p>
            ) : null}
            {tasksError ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {tasksError}
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<CheckSquare className="h-5 w-5" />} title="Adaugă sarcină" description="Creează un follow-up legat direct de această A.P.C." />
          <div className="grid gap-3">
            <Field label="Titlu" value={taskForm.title} onChange={(value) => setTaskForm({ ...taskForm, title: value })} />
            <label className="block">
              <span className="label">Descriere</span>
              <textarea className="min-h-[100px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground" value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} />
            </label>
            <label className="block">
              <span className="label">Prioritate</span>
              <select className="select" value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as TaskPriority })}>
                {Object.entries(taskPriorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Scadență</span>
              <input className="input" type="datetime-local" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
            </label>
            <button type="button" onClick={createTask} disabled={isCreatingTask} className="min-h-10 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              {isCreatingTask ? 'Se salvează...' : 'Salvează sarcina'}
            </button>
          </div>
        </Card>
      </section>

      <Modal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Invită administrator" onClose={() => setAdminModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Prenume" value={adminForm.firstName} onChange={(value) => setAdminForm({ ...adminForm, firstName: value })} required />
            <Field label="Nume" value={adminForm.lastName} onChange={(value) => setAdminForm({ ...adminForm, lastName: value })} required />
            <Field label="Email" value={adminForm.email} onChange={(value) => setAdminForm({ ...adminForm, email: value })} type="email" required />
            <Field label="Telefon" value={adminForm.phone} onChange={(value) => setAdminForm({ ...adminForm, phone: value })} />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground md:col-span-2">
              <input type="checkbox" checked={adminForm.sendEmail} onChange={(event) => setAdminForm({ ...adminForm, sendEmail: event.target.checked })} />
              Trimite invitația pe email
            </label>
          </div>
          {adminError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {adminError}
            </p>
          ) : null}
          {adminInvitationLink ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">
                {adminInviteWarning ? 'Invitația a fost creată. Copiază linkul și trimite-l manual.' : 'Invitația a fost creată.'}
              </p>
              {adminInviteWarning ? <p className="mt-1 text-xs font-semibold text-amber-700">{adminInviteWarning}</p> : null}
              <input className="input mt-2 bg-white" readOnly value={adminInvitationLink} />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(adminInvitationLink).catch(() => undefined)}
                className="mt-2 rounded-2xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900"
              >
                Copiază linkul de invitație
              </button>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Dacă emailul nu este configurat, linkul rămâne disponibil pentru trimitere manuală printr-un canal sigur.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setAdminModalOpen(false)} disabled={isCreatingAdmin} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createAdminInvitation} disabled={isCreatingAdmin} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreatingAdmin ? 'Se creează...' : 'Creează invitația'}
          </button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Editează asociația" onClose={() => setEditModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cod A.P.C." value={editForm.associationCode} onChange={(value) => setEditForm({ ...editForm, associationCode: value.trim().toUpperCase() })} required />
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

function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
        {icon}
      </div>
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CrmTile({ title, description, status }: { title: string; description: string; status: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{description}</p>
      <span className="mt-3 inline-flex rounded-full border border-border/70 bg-white px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        {status}
      </span>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatUserName(user: any) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'Utilizator';
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
