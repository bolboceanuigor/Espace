'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, Search, LayoutGrid, Table as TableIcon, ArrowUpRight, Phone, Mail, Building2, MapPin } from 'lucide-react';
import { Card } from '@/components/ui';
import { leadsApi } from '@/lib/api';

const STATUSES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'TRIAL_STARTED', 'WON', 'LOST'] as const;
const SOURCES = ['WEBSITE', 'MANUAL', 'REFERRAL', 'FACEBOOK', 'OTHER'] as const;

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700',
  CONTACTED: 'bg-amber-50 text-amber-700',
  DEMO_SCHEDULED: 'bg-purple-50 text-purple-700',
  TRIAL_STARTED: 'bg-cyan-50 text-cyan-700',
  WON: 'bg-emerald-50 text-emerald-700',
  LOST: 'bg-red-50 text-red-700',
};

const statusLabels: Record<string, string> = {
  NEW: 'Nou',
  CONTACTED: 'Contactat',
  DEMO_SCHEDULED: 'Demo programat',
  TRIAL_STARTED: 'Trial inceput',
  WON: 'Castigat',
  LOST: 'Pierdut',
};

export default function SuperadminLeadsPage() {
  const params = useParams<{ locale?: string }>();
  const locale = typeof params?.locale === 'string' ? params.locale : 'ro';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [filters, setFilters] = useState({ city: '', source: '', status: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    phone: '',
    email: '',
    associationName: '',
    apartmentsCount: '',
    city: '',
    source: 'MANUAL' as (typeof SOURCES)[number],
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsApi.superadminList({
        city: filters.city || undefined,
        source: (filters.source as any) || undefined,
        status: (filters.status as any) || undefined,
      });
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [filters.city, filters.source, filters.status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    await leadsApi.superadminCreate({
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      associationName: draft.associationName.trim() || undefined,
      apartmentsCount: draft.apartmentsCount ? Number(draft.apartmentsCount) : undefined,
      city: draft.city.trim() || undefined,
      source: draft.source,
      notes: draft.notes.trim() || undefined,
    });
    setShowAdd(false);
    setDraft({ name: '', phone: '', email: '', associationName: '', apartmentsCount: '', city: '', source: 'MANUAL', notes: '' });
    await load();
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioneaza lead-urile si urmareste conversiile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView((prev) => (prev === 'kanban' ? 'table' : 'kanban'))}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            {view === 'kanban' ? <TableIcon className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            {view === 'kanban' ? 'Tabel' : 'Kanban'}
          </button>
          <button 
            onClick={() => setShowAdd((prev) => !prev)} 
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            Adauga lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5"
              placeholder="Oras"
              value={filters.city}
              onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
            />
          </div>
          <select
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
            value={filters.source}
            onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
          >
            <option value="">Toate sursele</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">Toate statusurile</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{statusLabels[status]}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Add Lead Form */}
      {showAdd && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Lead nou</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <input 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20" 
              placeholder="Nume" 
              value={draft.name} 
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} 
            />
            <input 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20" 
              placeholder="Telefon" 
              value={draft.phone} 
              onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} 
            />
            <input 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20" 
              placeholder="Email" 
              value={draft.email} 
              onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} 
            />
            <input 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20" 
              placeholder="Nume asociatie" 
              value={draft.associationName} 
              onChange={(e) => setDraft((p) => ({ ...p, associationName: e.target.value }))} 
            />
            <input 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20" 
              placeholder="Nr. apartamente" 
              value={draft.apartmentsCount} 
              onChange={(e) => setDraft((p) => ({ ...p, apartmentsCount: e.target.value }))} 
            />
            <input 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20" 
              placeholder="Oras" 
              value={draft.city} 
              onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} 
            />
            <select 
              className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
              value={draft.source} 
              onChange={(e) => setDraft((p) => ({ ...p, source: e.target.value as any }))}
            >
              {SOURCES.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
            <textarea 
              className="min-h-[80px] rounded-lg border border-border bg-white p-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/20 lg:col-span-2" 
              placeholder="Note" 
              value={draft.notes} 
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} 
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setShowAdd(false)}
            >
              Anuleaza
            </button>
            <button
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition hover:bg-foreground/90"
              onClick={handleCreate}
            >
              Salveaza
            </button>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Se incarca lead-urile...</p>
        </div>
      )}

      {/* Table View */}
      {!loading && view === 'table' && (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nume</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asociatie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oras</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sursa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{lead.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-sm">{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="text-xs">{lead.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.associationName || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.city || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{lead.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-medium text-foreground outline-none transition focus:border-foreground/20"
                        value={lead.status}
                        onChange={async (event) => {
                          await leadsApi.superadminUpdate(lead.id, { status: event.target.value as any });
                          await load();
                        }}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{statusLabels[status]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/${locale}/superadmin/leads/${lead.id}`} 
                        className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition hover:text-foreground/70"
                      >
                        Deschide
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Kanban View */}
      {!loading && view === 'kanban' && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {STATUSES.map((status) => {
            const statusItems = items.filter((item) => item.status === status);
            return (
              <div key={status} className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${statusColors[status]}`}>
                    {statusLabels[status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{statusItems.length}</span>
                </div>
                <div className="space-y-2">
                  {statusItems.map((lead) => (
                    <Link 
                      key={lead.id} 
                      href={`/${locale}/superadmin/leads/${lead.id}`} 
                      className="block rounded-xl border border-border bg-white p-3 transition hover:shadow-sm"
                    >
                      <p className="font-medium text-foreground">{lead.name}</p>
                      {lead.associationName && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {lead.associationName}
                        </div>
                      )}
                      {lead.city && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {lead.city}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">{lead.email}</div>
                    </Link>
                  ))}
                  {statusItems.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">Niciun lead</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
