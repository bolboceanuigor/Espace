'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, UserPlus, ArrowUpRight, Filter } from 'lucide-react';
import { Badge, Card, Modal, ModalBody, ModalFooter, ModalHeader, StatCard } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import {
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
  city: 'Chisinau',
  country: 'Moldova',
  currency: 'MDL' as 'MDL' | 'EUR' | 'USD',
  status: 'ACTIVE' as AssociationStatus,
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
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [listError, setListError] = useState('');

  const loadOrganizations = async () => {
    const res = await superadminApi.listPublicOrganizations();
    const apiRows = (res.data || []).map(normalizeApiAssociation);
    if (apiRows.length) {
      setRows(apiRows);
      setSource('api');
      setListError('');
      return;
    }
    setRows(mockAssociations);
    setSource('mock');
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
        setListError('API indisponibil temporar. Sunt afisate date demo.');
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
    setFormError('');
    setSuccessMessage('');
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      currency: form.currency,
      status: form.status,
    };
    if (!payload.name || !payload.address || !payload.city || !payload.country) {
      setFormError('Completeaza numele, adresa, orasul si tara.');
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
      setSuccessMessage('Asociatia a fost creata.');
      await loadOrganizations().catch(() => undefined);
    } catch {
      setFormError('Nu am putut crea asociatia. Incearca din nou.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Asociatii</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organizatiile din platforma, administratorii lor si starea de activare.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          Adauga asociatie
        </button>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      )}
      {listError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {listError}
        </div>
      )}

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard 
          label="Total asociatii" 
          value={totals.total} 
          description="In platforma" 
          icon={<Building2 className="h-5 w-5" />} 
        />
        <StatCard 
          label="Active" 
          value={totals.active} 
          description="Cu acces operational" 
          icon={<Building2 className="h-5 w-5" />} 
          tone="success" 
        />
        <StatCard 
          label="Trial" 
          value={totals.trial} 
          description="In evaluare" 
          icon={<UserPlus className="h-5 w-5" />} 
          tone="warning" 
        />
        <StatCard 
          label="Apartamente" 
          value={totals.apartments} 
          description="Administrate total" 
          icon={<Building2 className="h-5 w-5" />} 
        />
      </section>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cauta asociatie, oras sau administrator..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | AssociationStatus)}
                className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
              >
                <option value="ALL">Toate statusurile</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              source === 'api' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-amber-50 text-amber-700'
            }`}>
              {source === 'api' ? 'Date reale' : 'Date demo'}
            </span>
          </div>
        </div>
      </Card>

      {/* Organizations List */}
      <section className="space-y-3">
        {filteredRows.length === 0 ? (
          <Card className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-foreground">Nicio asociatie gasita</p>
            <p className="mt-1 text-sm text-muted-foreground">Incearca sa modifici filtrele sau termenul de cautare.</p>
          </Card>
        ) : (
          filteredRows.map((row) => (
            <Card key={row.id} className="p-5 transition hover:shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">{row.name}</h2>
                      <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.address}, {row.city}, {row.country} · {row.apartmentsCount} apartamente · {row.currency}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[400px]">
                    <InfoCell label="Administrator" value={row.administratorName} />
                    <InfoCell label="Email" value={row.administratorEmail || '-'} />
                    <InfoCell label="Telefon" value={row.administratorPhone || '-'} />
                  </div>
                  <Link 
                    href={`/ro/superadmin/organizations/${row.id}`} 
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    Deschide
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="2xl">
        <ModalHeader title="Adauga asociatie" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField 
              label="Nume asociatie" 
              value={form.name} 
              onChange={(v) => setForm({ ...form, name: v })} 
              required 
            />
            <FormField 
              label="Oras" 
              value={form.city} 
              onChange={(v) => setForm({ ...form, city: v })} 
            />
            <FormField 
              label="Adresa" 
              value={form.address} 
              onChange={(v) => setForm({ ...form, address: v })} 
            />
            <FormField 
              label="Tara" 
              value={form.country} 
              onChange={(v) => setForm({ ...form, country: v })} 
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Moneda</span>
              <select 
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
                value={form.currency} 
                onChange={(e) => setForm({ ...form, currency: e.target.value as typeof form.currency })}
              >
                <option value="MDL">MDL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Status</span>
              <select 
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
                value={form.status} 
                onChange={(e) => setForm({ ...form, status: e.target.value as AssociationStatus })}
              >
                <option value="ACTIVE">Activa</option>
                <option value="TRIAL">Trial</option>
                <option value="INACTIVE">Inactiva</option>
              </select>
            </label>
            <FormField 
              label="Administrator" 
              value={form.administratorName} 
              onChange={(v) => setForm({ ...form, administratorName: v })} 
            />
            <FormField 
              label="Email administrator" 
              value={form.administratorEmail} 
              onChange={(v) => setForm({ ...form, administratorEmail: v })} 
              type="email" 
            />
            <FormField 
              label="Telefon administrator" 
              value={form.administratorPhone} 
              onChange={(v) => setForm({ ...form, administratorPhone: v })} 
            />
          </div>
          
          {formError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}
          
          <p className="mt-4 text-xs text-muted-foreground">
            Asociatia este creata in baza de date prin API-ul Espace. Administratorul poate fi adaugat intr-un pas separat.
          </p>
        </ModalBody>
        <ModalFooter>
          <button 
            type="button" 
            onClick={() => setModalOpen(false)} 
            disabled={isCreating} 
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Anuleaza
          </button>
          <button 
            type="button" 
            onClick={createAssociation} 
            disabled={isCreating} 
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {isCreating ? 'Se creeaza...' : 'Creeaza asociatie'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function FormField({
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
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input 
        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5" 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
      />
    </label>
  );
}
