'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CalendarClock, Eye, Megaphone, Pencil, PlusCircle, Search, Star, Trash2 } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { communicationsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categoryLabels: Record<string, string> = {
  GENERAL: 'General',
  MAINTENANCE: 'Mentenanță',
  PAYMENTS: 'Plăți',
  EMERGENCY: 'Urgență',
  MEETING: 'Ședință',
  DOCUMENTS: 'Documente',
  OTHER: 'Altul',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Importantă',
  URGENT: 'Urgentă',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Programat',
  PUBLISHED: 'Publicat',
  ARCHIVED: 'Arhivat',
};

const visibilityLabels: Record<string, string> = {
  ALL_RESIDENTS: 'Toată asociația',
  BY_STAIRCASE: 'După scară',
  BY_APARTMENTS: 'Apartamente',
  BY_ROLE: 'Roluri',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function statusClass(status?: string) {
  if (status === 'PUBLISHED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'SCHEDULED') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'ARCHIVED') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function AdminAnnouncementsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [association, setAssociation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');

  const query = useMemo(
    () => ({
      search,
      status,
      category,
      priority,
      limit: 100,
    }),
    [category, priority, search, status],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await communicationsApi.listAdminAnnouncements(query);
      setItems(response.data?.items || []);
      setStats(response.data?.stats || {});
      setAssociation(response.data?.association || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca anunțurile.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const archive = async (id: string) => {
    await communicationsApi.archiveAdminAnnouncement(id);
    await load();
  };

  const publish = async (id: string) => {
    await communicationsApi.publishAdminAnnouncement(id);
    await load();
  };

  const removeDraft = async (id: string) => {
    if (!window.confirm('Ștergi acest draft?')) return;
    await communicationsApi.deleteAdminAnnouncement(id);
    await load();
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Anunțuri"
        description="Creează și gestionează anunțurile pentru locatarii asociației."
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {association?.shortName || 'A.P.C.'}
              {association?.associationCode ? ` · ${association.associationCode}` : ''}
            </span>
            <Link href={localizedPath('/resident/announcements')} className="inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
              Vezi avizier locatar
            </Link>
            <Link href={localizedPath('/admin/announcements/new')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
              <PlusCircle className="h-4 w-4" />
              Creează anunț
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total anunțuri" value={stats.total || 0} icon={<Megaphone className="h-5 w-5" />} />
        <StatCard label="Publicate" value={stats.published || 0} tone="success" icon={<Eye className="h-5 w-5" />} />
        <StatCard label="Draft" value={stats.draft || 0} tone="warning" icon={<Pencil className="h-5 w-5" />} />
        <StatCard label="Programate" value={stats.scheduled || 0} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Arhivate" value={stats.archived || 0} icon={<Archive className="h-5 w-5" />} />
        <StatCard label="Importante" value={stats.important || 0} tone="danger" icon={<Star className="h-5 w-5" />} />
        <StatCard label="Citiri totale" value={stats.totalReads || 0} icon={<Eye className="h-5 w-5" />} />
        <StatCard label="Ultimul publicat" value={formatDate(stats.lastPublishedAt)} />
      </section>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-10" placeholder="Caută după titlu, conținut, autor sau categorie" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Filter value={status} onChange={setStatus} options={statusLabels} placeholder="Status" />
          <Filter value={category} onChange={setCategory} options={categoryLabels} placeholder="Categorie" />
          <Filter value={priority} onChange={setPriority} options={priorityLabels} placeholder="Prioritate" />
          <button type="button" onClick={() => load().catch(() => undefined)} className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            Actualizează
          </button>
        </div>
      </Card>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {loading ? <LoadingState label="Se încarcă anunțurile..." rows={5} /> : null}

      {!loading && !items.length ? (
        <EmptyState
          title="Nu există anunțuri"
          description="Creează primul anunț pentru a comunica informații importante locatarilor."
          actionLabel="Creează anunț"
          onAction={() => {
            window.location.href = localizedPath('/admin/announcements/new');
          }}
        />
      ) : null}

      {!loading && items.length ? (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(12rem,1.5fr)_8rem_8rem_8rem_8rem_7rem_7rem_9rem] gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Titlu</span>
            <span>Categorie</span>
            <span>Prioritate</span>
            <span>Status</span>
            <span>Vizibilitate</span>
            <span>Publicat</span>
            <span>Citiri</span>
            <span>Acțiuni</span>
          </div>
          <div className="divide-y divide-border/70">
            {items.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(12rem,1.5fr)_8rem_8rem_8rem_8rem_7rem_7rem_9rem] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.pinned ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Fixat</span> : null}
                    {item.expiresAt && new Date(item.expiresAt) < new Date() ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">Expirat</span> : null}
                  </div>
                  <Link href={localizedPath(`/admin/announcements/${item.id}`)} className="mt-2 block truncate text-sm font-semibold text-foreground hover:underline">
                    {item.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.excerpt}</p>
                </div>
                <span className="text-sm text-muted-foreground">{categoryLabels[item.category] || item.category}</span>
                <span className="text-sm text-muted-foreground">{priorityLabels[item.priority] || item.priority}</span>
                <span className={`w-max rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{statusLabels[item.status] || item.status}</span>
                <span className="text-sm text-muted-foreground">{visibilityLabels[item.visibilityType] || item.visibilityType}</span>
                <span className="text-sm text-muted-foreground">{formatDate(item.publishedAt || item.publishAt)}</span>
                <span className="text-sm text-muted-foreground">{item.readCount || 0}/{item.targetedResidents || 0}</span>
                <div className="flex flex-wrap gap-2">
                  <Link title="Deschide" href={localizedPath(`/admin/announcements/${item.id}`)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 hover:bg-muted/60">
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link title="Editează" href={localizedPath(`/admin/announcements/${item.id}/edit`)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 hover:bg-muted/60">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {item.status !== 'PUBLISHED' && item.status !== 'ARCHIVED' ? (
                    <button title="Publică" type="button" onClick={() => publish(item.id).catch(() => undefined)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 hover:bg-muted/60">
                      <Megaphone className="h-4 w-4" />
                    </button>
                  ) : null}
                  {item.status !== 'ARCHIVED' ? (
                    <button title="Arhivează" type="button" onClick={() => archive(item.id).catch(() => undefined)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 hover:bg-muted/60">
                      <Archive className="h-4 w-4" />
                    </button>
                  ) : null}
                  {item.status === 'DRAFT' ? (
                    <button title="Șterge draft" type="button" onClick={() => removeDraft(item.id).catch(() => undefined)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-rose-700 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Filter({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: Record<string, string>; placeholder: string }) {
  return (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {Object.entries(options).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
