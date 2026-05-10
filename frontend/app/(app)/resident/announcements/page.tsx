'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Megaphone, Pin, Search, Tag } from 'lucide-react';
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
  MEETING: 'Ședințe',
  DOCUMENTS: 'Documente',
  OTHER: 'Altul',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Importantă',
  URGENT: 'Urgentă',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function cardTone(item: any) {
  if (item.priority === 'URGENT') return 'border-rose-200 bg-rose-50/45';
  if (item.priority === 'HIGH') return 'border-amber-200 bg-amber-50/45';
  return '';
}

export default function ResidentAnnouncementsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [association, setAssociation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const query = useMemo(() => {
    const params: Record<string, string | boolean | number> = { search, limit: 50 };
    if (filter === 'unread') params.unreadOnly = true;
    if (filter === 'important') params.importantOnly = true;
    if (filter === 'maintenance') params.category = 'MAINTENANCE';
    if (filter === 'payments') params.category = 'PAYMENTS';
    if (filter === 'meeting') params.category = 'MEETING';
    return params;
  }, [filter, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await communicationsApi.listResidentAnnouncements(query);
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

  const pinned = items.filter((item) => item.pinned);
  const regular = items.filter((item) => !item.pinned);

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:pb-6">
      <PageHeader
        title="Avizier"
        description="Anunțuri și informații importante de la administrația asociației."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {association?.shortName || 'A.P.C.'}
            {association?.associationCode ? ` · ${association.associationCode}` : ''}
          </span>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Anunțuri" value={stats.total || 0} icon={<Megaphone className="h-5 w-5" />} />
        <StatCard label="Necitite" value={stats.unread || 0} tone={stats.unread ? 'warning' : 'neutral'} />
        <StatCard label="Urgente" value={stats.urgent || 0} tone={stats.urgent ? 'danger' : 'neutral'} />
        <StatCard label="Fixate sus" value={stats.pinned || 0} icon={<Pin className="h-5 w-5" />} />
      </section>

      <Card className="space-y-3 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-10" placeholder="Caută în anunțuri" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['all', 'Toate'],
            ['unread', 'Necitite'],
            ['important', 'Importante'],
            ['maintenance', 'Mentenanță'],
            ['payments', 'Plăți'],
            ['meeting', 'Ședințe'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`min-h-10 shrink-0 rounded-2xl border px-4 text-sm font-semibold ${filter === value ? 'border-foreground bg-foreground text-background' : 'border-border/70 bg-white text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {loading ? <LoadingState label="Se încarcă anunțurile..." rows={4} /> : null}

      {!loading && !items.length ? (
        <EmptyState title="Nu există anunțuri" description="Anunțurile publicate de administrator vor apărea aici." />
      ) : null}

      {!loading && pinned.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Fixate sus</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pinned.map((item) => (
              <AnnouncementCard key={item.id} item={item} localizedPath={localizedPath} />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && regular.length ? (
        <section className="grid gap-3 md:grid-cols-2">
          {regular.map((item) => (
            <AnnouncementCard key={item.id} item={item} localizedPath={localizedPath} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function AnnouncementCard({ item, localizedPath }: { item: any; localizedPath: (path: string) => string }) {
  return (
    <Card className={`p-4 ${cardTone(item)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {categoryLabels[item.category] || item.category}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(item.publishedAt || item.createdAt)}
            </span>
          </div>
          <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
        </div>
        {!item.isRead ? <span className="rounded-full bg-foreground px-2 py-1 text-xs font-semibold text-background">Necitit</span> : null}
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.excerpt || item.preview}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex flex-wrap gap-2">
          {item.pinned ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Fixat</span> : null}
          {item.priority === 'HIGH' || item.priority === 'URGENT' ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
              {priorityLabels[item.priority] || 'Important'}
            </span>
          ) : null}
        </div>
        <Link href={localizedPath(`/resident/announcements/${item.id}`)} className="inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
          Citește
        </Link>
      </div>
    </Card>
  );
}
