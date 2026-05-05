'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, Plus, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { Badge, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { mockAdministrators, mockAssociations, type MvpAdministrator } from '@/lib/superadmin-mvp-data';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  organizationId: mockAssociations[0]?.id || '',
};

export default function SuperadminAdminsPage() {
  const [admins, setAdmins] = useState<MvpAdministrator[]>(mockAdministrators);
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return admins.filter((admin) => {
      const association = mockAssociations.find((item) => item.id === admin.organizationId);
      const matchesQuery =
        !needle ||
        [admin.firstName, admin.lastName, admin.email, admin.phone, association?.name]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      const matchesOrg = organizationId === 'ALL' || admin.organizationId === organizationId;
      return matchesQuery && matchesOrg;
    });
  }, [admins, organizationId, query]);

  const createAdmin = () => {
    if (!form.firstName.trim() || !form.email.trim() || !form.organizationId) return;
    const next: MvpAdministrator = {
      id: `admin-local-${Date.now().toString(36)}`,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      organizationId: form.organizationId,
      role: 'ADMIN',
    };
    setAdmins((current) => [next, ...current]);
    setForm(emptyForm);
    setModalOpen(false);

    superadminApi
      .createUser({ orgId: next.organizationId, email: next.email, role: 'ADMIN' })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Administratori"
        description="Administratori creați sau invitați pentru asociațiile din platformă."
        rightSlot={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            Invită administrator
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Administratori" value={admins.length} description="Rol ADMIN" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Asociații acoperite" value={new Set(admins.map((admin) => admin.organizationId)).size} description="Au administrator" icon={<UserPlus className="h-5 w-5" />} tone="success" />
        <StatCard label="Invitații locale" value="preview" description="Persistă doar în această pagină" icon={<Mail className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută administrator, email sau asociație" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none">
            <option value="ALL">Toate asociațiile</option>
            {mockAssociations.map((association) => (
              <option key={association.id} value={association.id}>{association.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        {filtered.map((admin) => {
          const association = mockAssociations.find((item) => item.id === admin.organizationId);
          return (
            <Card key={admin.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">{admin.firstName} {admin.lastName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{association?.name || 'Asociație necunoscută'}</p>
                </div>
                <Badge variant="success">ADMIN</Badge>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{admin.email}</span>
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{admin.phone || '-'}</span>
              </div>
              <Link href={`/ro/superadmin/organizations/${admin.organizationId}`} className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-2xl border border-border/70 text-sm font-semibold hover:bg-muted/60">
                Deschide asociația
              </Link>
            </Card>
          );
        })}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xl">
        <ModalHeader title="Invită administrator" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Prenume" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} required />
            <Field label="Nume" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" required />
            <Field label="Telefon" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <label className="block md:col-span-2">
              <span className="label">Asociație</span>
              <select className="select" value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
                {mockAssociations.map((association) => (
                  <option key={association.id} value={association.id}>{association.name}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Dacă API-ul nu este conectat, administratorul este adăugat doar local în această pagină.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold">
            Anulează
          </button>
          <button type="button" onClick={createAdmin} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Invită administrator
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
