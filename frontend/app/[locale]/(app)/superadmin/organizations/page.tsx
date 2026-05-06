'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, ArrowRight, MoreHorizontal, Mail, Phone, MapPin } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui';
import { superadminApi } from '@/lib/api';
import {
  mockAssociations,
  normalizeApiAssociation,
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

  const loadOrganizations = async () => {
    const res = await superadminApi.listPublicOrganizations();
    const apiRows = (res.data || []).map(normalizeApiAssociation);
    if (apiRows.length) {
      setRows(apiRows);
      setSource('api');
      return;
    }
    setRows(mockAssociations);
    setSource('mock');
  };

  useEffect(() => {
    let active = true;
    loadOrganizations().catch(() => {
      if (!active) return;
      setRows(mockAssociations);
      setSource('mock');
    });
    return () => { active = false; };
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

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter((r) => r.status === 'ACTIVE').length,
    trial: rows.filter((r) => r.status === 'TRIAL').length,
    inactive: rows.filter((r) => r.status === 'INACTIVE').length,
  }), [rows]);

  const createAssociation = async () => {
    setFormError('');
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      currency: form.currency,
      status: form.status,
    };
    if (!payload.name || !payload.address || !payload.city || !payload.country) {
      setFormError('Completeaza toate campurile obligatorii.');
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
      await loadOrganizations().catch(() => undefined);
    } catch {
      setFormError('Nu am putut crea asociatia. Incearca din nou.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="animate-page-in space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Asociatii</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.all} asociatii inregistrate in platforma
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          Asociatie noua
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cauta dupa nume, oras sau administrator..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20 focus:ring-4 focus:ring-foreground/5"
          />
        </div>
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1">
          {[
            { key: 'ALL', label: 'Toate', count: counts.all },
            { key: 'ACTIVE', label: 'Active', count: counts.active },
            { key: 'TRIAL', label: 'Trial', count: counts.trial },
            { key: 'INACTIVE', label: 'Inactive', count: counts.inactive },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key as typeof status)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                status === tab.key
                  ? 'bg-foreground text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Source Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${source === 'api' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="text-muted-foreground">
          {source === 'api' ? 'Date sincronizate cu API-ul' : 'Afisare date demonstrative'}
        </span>
      </div>

      {/* Organizations Grid */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 font-medium text-foreground">Nicio asociatie gasita</p>
          <p className="mt-1 text-sm text-muted-foreground">Modifica filtrele sau termenul de cautare</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((org) => (
            <div
              key={org.id}
              className="group relative rounded-2xl border border-border bg-white p-5 transition hover:border-gray-300 hover:shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{org.name}</h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {org.city}, {org.country}
                    </div>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  org.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : org.status === 'TRIAL'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {org.status === 'ACTIVE' ? 'Activ' : org.status === 'TRIAL' ? 'Trial' : 'Inactiv'}
                </span>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Apartamente</p>
                  <p className="text-lg font-semibold text-foreground">{org.apartmentsCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="text-lg font-semibold text-foreground">{(org.apartmentsCount * 24).toLocaleString()} {org.currency}</p>
                </div>
              </div>

              {/* Admin */}
              {org.administratorName && (
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Administrator</p>
                  <p className="mt-1 font-medium text-foreground">{org.administratorName}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {org.administratorEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {org.administratorEmail}
                      </span>
                    )}
                    {org.administratorPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {org.administratorPhone}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action */}
              <Link
                href={`/ro/superadmin/organizations/${org.id}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Deschide detalii
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="lg">
        <ModalHeader title="Asociatie noua" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nume asociatie" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Oras" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            </div>
            <Field label="Adresa" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tara" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Moneda</label>
                <select
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value as typeof form.currency })}
                >
                  <option value="MDL">MDL</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Status</label>
                <select
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as AssociationStatus })}
                >
                  <option value="ACTIVE">Activ</option>
                  <option value="TRIAL">Trial</option>
                  <option value="INACTIVE">Inactiv</option>
                </select>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">Administrator (optional)</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Nume" value={form.administratorName} onChange={(v) => setForm({ ...form, administratorName: v })} />
                <Field label="Email" value={form.administratorEmail} onChange={(v) => setForm({ ...form, administratorEmail: v })} type="email" />
                <Field label="Telefon" value={form.administratorPhone} onChange={(v) => setForm({ ...form, administratorPhone: v })} />
              </div>
            </div>
          </div>

          {formError && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            disabled={isCreating}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Anuleaza
          </button>
          <button
            type="button"
            onClick={createAssociation}
            disabled={isCreating}
            className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {isCreating ? 'Se creeaza...' : 'Creeaza'}
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
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20 focus:ring-4 focus:ring-foreground/5"
      />
    </div>
  );
}
