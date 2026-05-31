'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, MessageCircle, PlusCircle, Search, Wrench } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { requestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  NEW: 'Nouă',
  OPEN: 'Deschisă',
  IN_PROGRESS: 'În lucru',
  WAITING_RESIDENT: 'Așteaptă răspunsul tău',
  WAITING_VENDOR: 'Așteaptă prestator',
  RESOLVED: 'Rezolvată',
  CLOSED: 'Închisă',
  CANCELLED: 'Anulată',
};

const categoryLabels: Record<string, string> = {
  REPAIR: 'Reparație',
  WATER_LEAK: 'Scurgere apă',
  ELECTRICITY: 'Electricitate',
  ELEVATOR: 'Lift',
  CLEANING: 'Curățenie',
  HEATING: 'Încălzire',
  INTERCOM: 'Interfon',
  PARKING: 'Parcare',
  COURTYARD: 'Curte',
  DOCUMENTS: 'Documente',
  PAYMENT: 'Plăți',
  METER: 'Contoare',
  NEIGHBOR_ISSUE: 'Vecini / zgomot',
  GENERAL_QUESTION: 'Întrebare generală',
  OTHER: 'Altceva',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Înaltă',
  URGENT: 'Urgentă',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function statusVariant(status?: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'neutral';
  if (status === 'WAITING_RESIDENT' || status === 'WAITING_VENDOR') return 'warning';
  return 'warning';
}

export default function ResidentRequestsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [association, setAssociation] = useState<any>(null);
  const [apartments, setApartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [apartmentId, setApartmentId] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  const query = useMemo(
    () => ({ search, status, category, priority, apartmentId, openOnly, limit: 50 }),
    [apartmentId, category, openOnly, priority, search, status],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setStatus(params.get('status') || '');
    setCategory(params.get('category') || '');
    setPriority(params.get('priority') || '');
    setApartmentId(params.get('apartmentId') || '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await requestsApi.residentList(query);
      setItems(response.data?.items || []);
      setStats(response.data?.stats || {});
      setAssociation(response.data?.association || null);
      setApartments(response.data?.apartments || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca solicitările.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:pb-6">
      <PageHeader
        title="Cereri către administrație"
        description="Trimite probleme, întrebări sau solicitări către administrator."
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {association?.shortName || 'A.P.C.'} · {apartments.length ? apartments.map((apartment) => `Apt. ${apartment.apartmentNumber}`).join(', ') : 'fără apartament'}
            </span>
            <ButtonLink href={localizedPath('/resident/requests/new')}>
              <PlusCircle className="h-4 w-4" />
              Cerere nouă
            </ButtonLink>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Cereri deschise" value={stats.open || 0} icon={<MessageCircle className="h-5 w-5" />} tone={stats.open ? 'warning' : 'success'} />
        <StatCard label="În lucru" value={stats.inProgress || 0} icon={<Wrench className="h-5 w-5" />} />
        <StatCard label="Așteaptă răspunsul tău" value={stats.waitingResident || stats.waitingForResident || 0} tone={stats.waitingResident ? 'warning' : 'neutral'} />
        <StatCard label="Rezolvate" value={stats.resolved || 0} tone="success" />
        <StatCard label="Urgente" value={stats.urgent || 0} icon={<CalendarClock className="h-5 w-5" />} tone={stats.urgent ? 'danger' : 'neutral'} />
      </section>

      <Card className="space-y-3 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută titlu, descriere sau număr solicitare" />
        </label>
        <div className="grid gap-3 md:grid-cols-5">
          <Filter value={status} onChange={setStatus} options={statusLabels} placeholder="Status" />
          <Filter value={category} onChange={setCategory} options={categoryLabels} placeholder="Categorie" />
          <Filter value={priority} onChange={setPriority} options={priorityLabels} placeholder="Prioritate" />
          <select className="select" value={apartmentId} onChange={(event) => setApartmentId(event.target.value)}>
            <option value="">Toate apartamentele</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                Apartament {apartment.apartmentNumber}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-semibold">
            <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />
            Doar deschise
          </label>
        </div>
      </Card>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {loading ? <LoadingState label="Se încarcă solicitările..." rows={4} /> : null}
      {!loading && !items.length ? (
        <EmptyState
          title="Nu ai trimis nicio cerere încă."
          description="Creează o cerere către administrație pentru probleme, întrebări sau solicitări administrative."
          actionLabel="Trimite prima cerere"
          onAction={() => {
            window.location.href = localizedPath('/resident/requests/new');
          }}
        />
      ) : null}

      {!loading && items.length ? (
        <section className="grid gap-3">
          {items.map((request) => (
            <Card key={request.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{request.requestNumber}</p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">{request.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {categoryLabels[request.category] || request.category} · Apt. {request.apartment?.apartmentNumber || '—'} · creată {formatDate(request.createdAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(request.status) as any}>{statusLabels[request.status] || request.status}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{request.description}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={request.priority === 'URGENT' ? 'error' : request.priority === 'HIGH' ? 'warning' : 'neutral'}>
                    {priorityLabels[request.priority] || request.priority}
                  </Badge>
                  {request.lastAdminMessageAt ? <span className="text-xs text-muted-foreground">Ultimul răspuns admin: {formatDate(request.lastAdminMessageAt)}</span> : null}
                </div>
                <Link href={localizedPath(`/resident/requests/${request.id}`)} className="inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
                  Deschide
                </Link>
              </div>
            </Card>
          ))}
        </section>
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
