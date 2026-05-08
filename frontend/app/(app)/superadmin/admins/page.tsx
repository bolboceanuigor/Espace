'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, Plus, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { Badge, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invitationsApi, superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import {
  mockAdministrators,
  mockAssociations,
  normalizeApiAdministrator,
  normalizeApiAssociation,
  type MvpAdministrator,
  type MvpAssociation,
} from '@/lib/superadmin-mvp-data';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  organizationId: '',
};

export default function SuperadminAdminsPage() {
  const localizedPath = useLocalizedPath();
  const [admins, setAdmins] = useState<MvpAdministrator[]>([]);
  const [associations, setAssociations] = useState<MvpAssociation[]>([]);
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const [isCreating, setIsCreating] = useState(false);
  const [updatingAdminId, setUpdatingAdminId] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [listError, setListError] = useState('');
  const [invitationLink, setInvitationLink] = useState('');

  const loadAdmins = async () => {
    const [adminsRes, orgsRes] = await Promise.all([
      superadminApi.listPublicAdmins(),
      superadminApi.listPublicOrganizations(),
    ]);
    const apiAdmins = (adminsRes.data || []).map(normalizeApiAdministrator);
    const apiAssociations = (orgsRes.data || []).map(normalizeApiAssociation);
    setAdmins(apiAdmins);
    setAssociations(apiAssociations);
    setSource('api');
    setListError('');
    setForm((current) => ({
      ...current,
      organizationId: current.organizationId || apiAssociations[0]?.id || mockAssociations[0]?.id || '',
    }));
  };

  useEffect(() => {
    let active = true;
    loadAdmins().catch(() => {
      if (!active) return;
      setAdmins(mockAdministrators);
      setAssociations(mockAssociations);
      setSource('mock');
      setListError('API indisponibil temporar. Sunt afișate date temporare.');
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return admins.filter((admin) => {
      const association = associations.find((item) => item.id === admin.organizationId);
      const matchesQuery =
        !needle ||
        [admin.firstName, admin.lastName, admin.email, admin.phone, association?.name]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      const matchesOrg = organizationId === 'ALL' || admin.organizationId === organizationId;
      return matchesQuery && matchesOrg;
    });
  }, [admins, associations, organizationId, query]);

  const createAdminInvitation = async () => {
    setFormError('');
    setSuccessMessage('');
    setInvitationLink('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.organizationId) {
      setFormError('Completează prenumele, numele, emailul și asociația.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await invitationsApi.createAdmin(form.organizationId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setInvitationLink(created.data?.activationLink || created.data?.inviteLink || '');
      setForm({ ...emptyForm, organizationId: form.organizationId });
      setSuccessMessage('Invitația a fost creată.');
      await loadAdmins().catch(() => undefined);
    } catch (error: any) {
      const message = String(error?.message || '');
      setFormError(message.includes('Există deja un utilizator cu acest email') ? 'Există deja un utilizator cu acest email.' : 'Nu am putut crea invitația.');
    } finally {
      setIsCreating(false);
    }
  };

  const updateAdminStatus = async (id: string, isActive: boolean) => {
    setUpdatingAdminId(id);
    setSuccessMessage('');
    setListError('');
    try {
      const updated = await superadminApi.updatePublicAdmin(id, { isActive });
      const next = normalizeApiAdministrator(updated.data);
      setAdmins((current) => current.map((admin) => (admin.id === id ? { ...admin, ...next } : admin)));
      setSource('api');
      setSuccessMessage('Administratorul a fost actualizat.');
    } catch {
      setListError('Nu am putut actualiza administratorul.');
    } finally {
      setUpdatingAdminId('');
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Administratori"
        description="Administratori creați pentru asociațiile din platformă."
        rightSlot={
          <button
            type="button"
            onClick={() => {
              setInvitationLink('');
              setModalOpen(true);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            Invită administrator
          </button>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}
      {listError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {listError}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Administratori" value={admins.length} description="Rol ADMIN" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Asociații acoperite" value={new Set(admins.map((admin) => admin.organizationId)).size} description="Au administrator" icon={<UserPlus className="h-5 w-5" />} tone="success" />
        <StatCard
          label="Sursă date"
          value={source === 'loading' ? 'se încarcă' : source === 'api' ? 'reale' : 'temporare'}
          description={source === 'loading' ? 'Se încarcă datele' : source === 'api' ? 'API conectat' : 'API indisponibil'}
          icon={<Mail className="h-5 w-5" />}
          tone={source === 'api' ? 'success' : 'warning'}
        />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută administrator, email sau asociație" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none">
            <option value="ALL">Toate asociațiile</option>
            {associations.map((association) => (
              <option key={association.id} value={association.id}>{association.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        {filtered.map((admin) => {
          const association = associations.find((item) => item.id === admin.organizationId);
          return (
            <Card key={admin.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">{admin.firstName} {admin.lastName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{admin.organization?.shortName || association?.name || 'Asociație necunoscută'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant="success">ADMIN</Badge>
                  <Badge variant={admin.isActive === false ? 'neutral' : 'success'}>{admin.isActive === false ? 'Inactiv' : 'Activ'}</Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{admin.email}</span>
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{admin.phone || '-'}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href={localizedPath(`/superadmin/organizations/${admin.organizationId}`)} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold hover:bg-muted/60">
                  Deschide asociația
                </Link>
                <button
                  type="button"
                  disabled={updatingAdminId === admin.id}
                  onClick={() => updateAdminStatus(admin.id, admin.isActive === false)}
                  className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60 disabled:opacity-50"
                >
                  {admin.isActive === false ? 'Activează' : 'Dezactivează'}
                </button>
              </div>
            </Card>
          );
        })}
        {source === 'loading' ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {source !== 'loading' && !filtered.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există administratori încă.</Card> : null}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Invită administrator" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Prenume" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} required />
            <Field label="Nume" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} required />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" required />
            <Field label="Telefon" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <label className="block md:col-span-2">
              <span className="label">Asociație</span>
              <select className="select" value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
                {associations.map((association) => (
                  <option key={association.id} value={association.id}>{association.name}</option>
                ))}
              </select>
            </label>
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}
          {invitationLink ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">Invitația a fost creată.</p>
              <input className="input mt-2 bg-white" readOnly value={invitationLink} />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(invitationLink).catch(() => undefined)}
                className="mt-2 rounded-2xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900"
              >
                Copiază linkul
              </button>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Trimiterea automată pe email va fi conectată ulterior. Trimite linkul administratorului printr-un canal sigur.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isCreating} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createAdminInvitation} disabled={isCreating} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreating ? 'Se creează...' : 'Creează invitația'}
          </button>
        </ModalFooter>
      </Modal>
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
