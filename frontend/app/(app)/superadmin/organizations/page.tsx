'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, UserPlus } from 'lucide-react';
import { Badge, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import {
  createAssociationId,
  mockAssociations,
  normalizeApiAssociation,
  statusBadgeVariant,
  statusLabel,
  type AssociationStatus,
  type MvpAssociation,
} from '@/lib/superadmin-mvp-data';

const emptyForm = {
  name: '',
  address: '',
  city: 'Chișinău',
  country: 'MD',
  currency: 'MDL' as MvpAssociation['currency'],
  status: 'TRIAL' as AssociationStatus,
  apartmentsCount: '0',
  administratorName: '',
  administratorEmail: '',
  administratorPhone: '',
};

export default function SuperadminOrganizationsPage() {
  const [rows, setRows] = useState<MvpAssociation[]>(mockAssociations);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | AssociationStatus>('ALL');
  const [source, setSource] = useState<'mock' | 'api'>('mock');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    superadminApi
      .listOrgs()
      .then((res) => {
        if (!active) return;
        const apiRows = (res.data || []).map(normalizeApiAssociation);
        if (apiRows.length) {
          setRows(apiRows);
          setSource('api');
        }
      })
      .catch(() => {
        if (!active) return;
        setRows(mockAssociations);
        setSource('mock');
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
        [row.name, row.city, row.address, row.administratorName, row.administratorEmail]
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
    if (!form.name.trim()) return;
    const next: MvpAssociation = {
      id: createAssociationId(form.name),
      name: form.name.trim(),
      address: form.address.trim() || 'Adresă necompletată',
      city: form.city.trim() || 'Chișinău',
      country: form.country.trim() || 'MD',
      currency: form.currency,
      status: form.status,
      apartmentsCount: Number(form.apartmentsCount || 0),
      administratorName: form.administratorName.trim() || 'Administrator neatribuit',
      administratorEmail: form.administratorEmail.trim(),
      administratorPhone: form.administratorPhone.trim(),
    };

    setRows((current) => [next, ...current]);
    setSource('mock');
    setForm(emptyForm);
    setModalOpen(false);

    superadminApi.createOrg({ name: next.name }).catch(() => undefined);
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
            Adaugă asociație
          </button>
        }
      />

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
            <Input className="pl-9" placeholder="Caută asociație, oraș sau administrator" value={query} onChange={(event) => setQuery(event.target.value)} />
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
            Date: {source === 'api' ? 'API' : 'mock/local'}
          </span>
        </div>
      </Card>

      <section className="grid gap-3">
        {filteredRows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{row.name}</h2>
                  <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.address}, {row.city}, {row.country} · {row.apartmentsCount} apartamente · {row.currency}
                </p>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                <Mini label="Administrator" value={row.administratorName} />
                <Mini label="Email" value={row.administratorEmail || '-'} />
                <Mini label="Telefon" value={row.administratorPhone || '-'} />
              </div>
              <Link href={`/ro/superadmin/organizations/${row.id}`} className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                Deschide
              </Link>
            </div>
          </Card>
        ))}
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adaugă asociație" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nume asociație" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
            <Field label="Oraș" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
            <Field label="Adresă" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            <Field label="Țară" value={form.country} onChange={(value) => setForm({ ...form, country: value })} />
            <Field label="Apartamente" value={form.apartmentsCount} onChange={(value) => setForm({ ...form, apartmentsCount: value })} type="number" />
            <label className="block">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AssociationStatus })}>
                <option value="TRIAL">Trial</option>
                <option value="ACTIVE">Activă</option>
                <option value="INACTIVE">Inactivă</option>
              </select>
            </label>
            <Field label="Administrator" value={form.administratorName} onChange={(value) => setForm({ ...form, administratorName: value })} />
            <Field label="Email administrator" value={form.administratorEmail} onChange={(value) => setForm({ ...form, administratorEmail: value })} type="email" />
            <Field label="Telefon administrator" value={form.administratorPhone} onChange={(value) => setForm({ ...form, administratorPhone: value })} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            În preview, asociația creată este păstrată doar în starea locală a paginii dacă API-ul nu este conectat.
          </p>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setModalOpen(false)} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold">
            Anulează
          </button>
          <button type="button" onClick={createAssociation} className="rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Creează asociație
          </button>
        </ModalFooter>
      </Modal>
    </div>
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
