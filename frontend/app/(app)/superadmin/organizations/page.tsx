'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, UserPlus } from 'lucide-react';
import { Badge, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import {
  mockAssociations,
  normalizeApiAssociation,
  statusBadgeVariant,
  statusLabel,
  type AssociationStatus,
  type MvpAssociation,
} from '@/lib/superadmin-mvp-data';

const emptyForm = {
  associationCode: '',
  legalName: '',
  shortName: '',
  address: '',
  city: 'Chișinău',
  country: 'Republica Moldova',
  currency: 'MDL' as const,
  status: 'ACTIVE' as AssociationStatus,
  administratorName: '',
  administratorEmail: '',
  administratorPhone: '',
};

function normalizeAssociationCode(value: string) {
  return value.trim().toUpperCase();
}

function legalNameForCode(code: string) {
  return code ? `Asociația de Proprietari din Condominiu ${code}` : '';
}

function shortNameForCode(code: string) {
  return code ? `A.P.C. ${code}` : '';
}

function associationNumberFromCode(code: string) {
  return code.match(/-(\d{4})$/)?.[1] || '';
}

export default function SuperadminOrganizationsPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<MvpAssociation[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | AssociationStatus>('ALL');
  const [source, setSource] = useState<'loading' | 'mock' | 'api'>('loading');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [listError, setListError] = useState('');

  const loadOrganizations = async () => {
    const res = await superadminApi.listPublicOrganizations();
    const apiRows = (res.data || []).map(normalizeApiAssociation);
    setRows(apiRows);
    setSource('api');
    setListError('');
  };

  useEffect(() => {
    let active = true;
    loadOrganizations()
      .then(() => {
        if (!active) return;
      })
      .catch(() => {
        if (!active) return;
        setRows(mockAssociations);
        setSource('mock');
        setListError('API indisponibil temporar. Sunt afișate date temporare.');
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !needle ||
        [row.shortName, row.legalName, row.associationCode, row.associationNumber, row.city, row.address, row.administratorName, row.administratorEmail]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      const matchesStatus = status === 'ALL' || row.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, rows, status]);

  const totals = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === 'ACTIVE').length,
      trial: rows.filter((row) => row.status === 'TRIAL').length,
      apartments: rows.reduce((sum, row) => sum + row.apartmentsCount, 0),
    };
  }, [rows]);

  const createAssociation = async () => {
    setFormError('');
    setSuccessMessage('');
    const associationCode = normalizeAssociationCode(form.associationCode);
    const payload = {
      associationCode,
      legalName: form.legalName.trim(),
      shortName: form.shortName.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      currency: form.currency,
      status: form.status,
    };
    if (!payload.associationCode || !payload.legalName || !payload.shortName || !payload.address || !payload.city) {
      setFormError('Completează codul APC, denumirile, adresa și orașul.');
      return;
    }
    if (!/^A\d{4}-\d{4}$/.test(payload.associationCode)) {
      setFormError('Format recomandat: A0123-0940');
      return;
    }

    setIsCreating(true);
    try {
      const created = await superadminApi.createPublicOrganization(payload);
      const next = normalizeApiAssociation(created.data);
      setRows((current) => [next, ...current.filter((row) => row.id !== next.id)]);
      setSource('api');
      setForm(emptyForm);
      setModalOpen(false);
      setSuccessMessage('Asociația a fost creată.');
      await loadOrganizations().catch(() => undefined);
    } catch {
      setFormError('Nu am putut crea asociația. Încearcă din nou.');
    } finally {
      setIsCreating(false);
    }
  };

  const updateAssociationStatus = async (id: string, nextStatus: AssociationStatus) => {
    setSuccessMessage('');
    setListError('');
    setUpdatingStatusId(id);
    try {
      const updated = await superadminApi.updatePublicOrganizationStatus(id, nextStatus);
      const next = normalizeApiAssociation(updated.data);
      setRows((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
      setSource('api');
      setSuccessMessage('Statusul asociației a fost actualizat.');
    } catch {
      setListError('Nu am putut actualiza statusul asociației.');
    } finally {
      setUpdatingStatusId('');
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Asociații"
        description="Organizațiile din platformă, administratorii lor și starea de activare."
        rightSlot={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            Adaugă A.P.C.
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total asociații" value={totals.total} description="În platformă" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Active" value={totals.active} description="Cu acces operațional" icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Trial" value={totals.trial} description="În evaluare" icon={<UserPlus className="h-5 w-5" />} tone="warning" />
        <StatCard label="Apartamente" value={totals.apartments} description="Administrate total" icon={<Building2 className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută A.P.C., cod, oraș sau administrator" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as 'ALL' | AssociationStatus)}
            className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground outline-none"
          >
            <option value="ALL">Toate statusurile</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        </div>
      </Card>

      <section className="grid gap-3">
        {filteredRows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{row.shortName}</h2>
                  <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-foreground/80">{row.legalName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cod APC {row.associationCode || '-'} · Nr. intern {row.associationNumber || '-'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.address}, {row.city}, {row.country} · {row.apartmentsCount} apartamente · {row.currency}
                </p>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                <Mini label="Administrator" value={row.administratorName} />
                <Mini label="Email" value={row.administratorEmail || '-'} />
                <Mini label="Telefon" value={row.administratorPhone || '-'} />
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-[220px]">
                <StatusButton disabled={updatingStatusId === row.id || row.status === 'ACTIVE'} onClick={() => updateAssociationStatus(row.id, 'ACTIVE')}>Activează</StatusButton>
                <StatusButton disabled={updatingStatusId === row.id || row.status === 'TRIAL'} onClick={() => updateAssociationStatus(row.id, 'TRIAL')}>Pune în trial</StatusButton>
                <StatusButton disabled={updatingStatusId === row.id || row.status === 'INACTIVE'} onClick={() => updateAssociationStatus(row.id, 'INACTIVE')}>Dezactivează</StatusButton>
                <Link href={localizedPath(`/superadmin/organizations/${row.id}`)} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                  Deschide
                </Link>
              </div>
            </div>
          </Card>
        ))}
        {source === 'loading' ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {source !== 'loading' && !filteredRows.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există asociații încă.</Card> : null}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă A.P.C." onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Cod APC"
              value={form.associationCode}
              placeholder="A0123-0940"
              onChange={(value) => {
                const code = normalizeAssociationCode(value);
                const previousCode = normalizeAssociationCode(form.associationCode);
                setForm({
                  ...form,
                  associationCode: code,
                  legalName: !form.legalName || form.legalName === legalNameForCode(previousCode) ? legalNameForCode(code) : form.legalName,
                  shortName: !form.shortName || form.shortName === shortNameForCode(previousCode) ? shortNameForCode(code) : form.shortName,
                });
              }}
              required
            />
            <Field label="Număr intern" value={associationNumberFromCode(form.associationCode)} onChange={() => undefined} disabled />
            <Field label="Denumire lungă" value={form.legalName} onChange={(value) => setForm({ ...form, legalName: value })} required />
            <Field label="Denumire scurtă" value={form.shortName} onChange={(value) => setForm({ ...form, shortName: value })} required />
            <Field label="Oraș" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
            <Field label="Adresă" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            <Field label="Țară" value={form.country} onChange={(value) => setForm({ ...form, country: value })} disabled />
            <label className="block">
              <span className="label">Monedă</span>
              <select className="select" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as typeof form.currency })} disabled>
                <option value="MDL">MDL</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AssociationStatus })}>
                <option value="ACTIVE">Activă</option>
                <option value="TRIAL">Trial</option>
                <option value="INACTIVE">Inactivă</option>
              </select>
            </label>
            <Field label="Administrator" value={form.administratorName} onChange={(value) => setForm({ ...form, administratorName: value })} />
            <Field label="Email administrator" value={form.administratorEmail} onChange={(value) => setForm({ ...form, administratorEmail: value })} type="email" />
            <Field label="Telefon administrator" value={form.administratorPhone} onChange={(value) => setForm({ ...form, administratorPhone: value })} />
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {formError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Format recomandat pentru Cod APC: A0123-0940. Ultimele 4 cifre devin numărul intern al asociației.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            A.P.C.-ul este creat în baza de date prin API-ul Espace. Administratorul poate fi adăugat într-un pas separat.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} disabled={isCreating} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Anulează
          </button>
          <button type="button" onClick={createAssociation} disabled={isCreating} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
            {isCreating ? 'Se creează...' : 'Creează A.P.C.'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function StatusButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-9 rounded-2xl border border-border/70 px-3 text-xs font-semibold text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}{required ? ' *' : ''}</span>
      <input className="input" type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
