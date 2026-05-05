'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { leadsApi } from '@/lib/api';

const STATUSES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'TRIAL_STARTED', 'WON', 'LOST'] as const;
const SOURCES = ['WEBSITE', 'MANUAL', 'REFERRAL', 'FACEBOOK', 'OTHER'] as const;

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">Sales CRM</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView((prev) => (prev === 'kanban' ? 'table' : 'kanban'))}
            className="rounded-md border border-border px-3 py-2 text-xs"
          >
            {view === 'kanban' ? 'Table view' : 'Kanban view'}
          </button>
          <button onClick={() => setShowAdd((prev) => !prev)} className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground">
            Add lead
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          placeholder="City"
          value={filters.city}
          onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
        />
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={filters.source}
          onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}
        >
          <option value="">All sources</option>
          {SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="">All status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {showAdd ? (
        <div className="grid gap-2 rounded-xl border border-border/70 bg-card p-3 md:grid-cols-2">
          <input className="h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
          <input className="h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Phone" value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} />
          <input className="h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Email" value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} />
          <input className="h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Association name" value={draft.associationName} onChange={(e) => setDraft((p) => ({ ...p, associationName: e.target.value }))} />
          <input className="h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Apartments count" value={draft.apartmentsCount} onChange={(e) => setDraft((p) => ({ ...p, apartmentsCount: e.target.value }))} />
          <input className="h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="City" value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} />
          <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={draft.source} onChange={(e) => setDraft((p) => ({ ...p, source: e.target.value as any }))}>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <textarea className="min-h-[80px] rounded-md border border-border bg-background p-3 text-sm md:col-span-2" placeholder="Notes" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} />
          <button
            className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground md:col-span-2"
            onClick={async () => {
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
            }}
          >
            Save lead
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Se incarca lead-urile...</p> : null}

      {view === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Nume</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Asociatie</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/${locale}/superadmin/leads/${lead.id}`} className="hover:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <p>{lead.phone}</p>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </td>
                  <td className="px-3 py-2">{lead.associationName || '-'}</td>
                  <td className="px-3 py-2">{lead.city || '-'}</td>
                  <td className="px-3 py-2">{lead.source}</td>
                  <td className="px-3 py-2">
                    <select
                      className="select"
                      value={lead.status}
                      onChange={async (event) => {
                        await leadsApi.superadminUpdate(lead.id, { status: event.target.value as any });
                        await load();
                      }}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STATUSES.map((status) => (
            <div key={status} className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
              <h2 className="text-xs font-semibold uppercase text-muted-foreground">{status}</h2>
              {items
                .filter((item) => item.status === status)
                .map((lead) => (
                  <Link key={lead.id} href={`/${locale}/superadmin/leads/${lead.id}`} className="block rounded-lg border border-border/60 p-2 hover:bg-muted/20">
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.associationName || lead.email}</p>
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

