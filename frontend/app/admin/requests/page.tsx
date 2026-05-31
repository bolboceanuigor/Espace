'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock3, MessageCircle, RefreshCw, Search, Siren, UserRound, Wrench } from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { BulkSelectionToolbar } from '@/components/bulk-operations/BulkOperationComponents';
import { SavedViewsBar } from '@/components/saved-views/SavedViewsComponents';
import { requestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  NEW: 'Nouă',
  OPEN: 'Deschisă',
  IN_PROGRESS: 'În lucru',
  WAITING_RESIDENT: 'Așteaptă locatar',
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function statusVariant(status?: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'neutral';
  if (status === 'WAITING_RESIDENT' || status === 'WAITING_VENDOR') return 'warning';
  return 'warning';
}

function priorityVariant(priority?: string) {
  if (priority === 'URGENT') return 'error';
  if (priority === 'HIGH') return 'warning';
  return 'neutral';
}

export default function AdminRequestsPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [association, setAssociation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [apartmentFilter, setApartmentFilter] = useState('');
  const [residentFilter, setResidentFilter] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const query = useMemo(
    () => ({ search, status, category, priority, apartmentId: apartmentFilter, residentId: residentFilter, openOnly, onlyOverdue, limit: 50, sortBy: priority === 'URGENT' ? 'priority' : undefined }),
    [apartmentFilter, category, onlyOverdue, openOnly, priority, residentFilter, search, status],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setApartmentFilter(params.get('apartmentId') || '');
    setResidentFilter(params.get('residentId') || '');
    setOnlyOverdue(params.get('onlyOverdue') === 'true');
    setStatus(params.get('status') || '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await requestsApi.adminList(query);
      setItems(response.data?.items || []);
      setStats(response.data?.stats || {});
      setAssociation(response.data?.association || null);
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

  const runAction = async (id: string, callback: () => Promise<any>, success: string) => {
    setSavingId(id);
    setMessage('');
    setError('');
    try {
      await callback();
      setMessage(success);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva modificarea.'));
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-5 overflow-x-hidden pb-6">
      <PageHeader
        title="Cereri locatari"
        description="Gestionează solicitările și problemele transmise de locatari."
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {association?.shortName || 'A.P.C.'} · {association?.associationCode || 'cod APC'}
            </span>
            <Button variant="secondary" onClick={() => load()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </Button>
            <ButtonLink href="/admin/requests?onlyOverdue=true" variant="secondary">Probleme</ButtonLink>
            <ButtonLink href="/admin/residents" variant="secondary">Vezi locatari</ButtonLink>
            <ButtonLink href="/admin/apartments" variant="secondary">Vezi apartamente</ButtonLink>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <SavedViewsBar
        module="REQUESTS"
        currentFilters={{ search, status, category, priority, apartmentId: apartmentFilter, residentId: residentFilter, openOnly, onlyOverdue }}
        onApply={(viewFilters) => {
          setSearch(String(viewFilters.search || ''));
          setStatus(String(viewFilters.status || ''));
          setCategory(String(viewFilters.category || ''));
          setPriority(String(viewFilters.priority || ''));
          setApartmentFilter(String(viewFilters.apartmentId || ''));
          setResidentFilter(String(viewFilters.residentId || ''));
          setOpenOnly(viewFilters.openOnly === true || viewFilters.openOnly === 'true');
          setOnlyOverdue(viewFilters.onlyOverdue === true || viewFilters.onlyOverdue === 'true');
        }}
      />

      <BulkSelectionToolbar
        entityType="REQUEST"
        selectedIds={selectedIds}
        onClear={() => setSelectedIds([])}
        onDone={() => {
          setSelectedIds([]);
          void load();
        }}
        actions={[
          { operationType: 'REQUESTS_SET_STATUS', label: 'Setează status' },
          { operationType: 'REQUESTS_ARCHIVE_CLOSED', label: 'Arhivează închise', requiresReason: true },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Noi" value={stats.new || 0} icon={<MessageCircle className="h-5 w-5" />} tone={stats.new ? 'warning' : 'neutral'} />
        <StatCard label="Deschise" value={stats.open || 0} tone={stats.open ? 'warning' : 'success'} />
        <StatCard label="În lucru" value={stats.inProgress || 0} icon={<Wrench className="h-5 w-5" />} tone="warning" />
        <StatCard label="Așteaptă locatar" value={stats.waitingResident || stats.waitingForResident || 0} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Urgente" value={stats.urgent || 0} icon={<Siren className="h-5 w-5" />} tone={stats.urgent ? 'danger' : 'neutral'} />
        <StatCard label="Restante" value={stats.overdue || 0} tone={stats.overdue ? 'danger' : 'neutral'} />
        <StatCard label="Rezolvate luna aceasta" value={stats.resolvedThisMonth || 0} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Timp mediu rezolvare" value={stats.averageResolutionHours ? `${stats.averageResolutionHours}h` : '—'} tone="neutral" />
        <StatCard label="Ultima solicitare" value={formatDate(stats.lastRequestAt)} tone="neutral" />
      </section>

      <Card className="space-y-3 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută număr, titlu, locatar, telefon sau apartament" />
        </label>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5">
          <Filter value={status} onChange={setStatus} options={statusLabels} placeholder="Status" />
          <Filter value={category} onChange={setCategory} options={categoryLabels} placeholder="Categorie" />
          <Filter value={priority} onChange={setPriority} options={priorityLabels} placeholder="Prioritate" />
          <select className="select" value="" onChange={() => undefined} disabled title="Filtrele pe scară/apartament sunt disponibile prin căutare în acest pas.">
            <option>Scară / apartament prin search</option>
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-semibold">
            <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />
            Doar deschise
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-semibold">
            <input type="checkbox" checked={onlyOverdue} onChange={(event) => setOnlyOverdue(event.target.checked)} />
            Doar restante
          </label>
        </div>
        {apartmentFilter || residentFilter ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
            {apartmentFilter ? <span className="rounded-full bg-muted px-3 py-1">Filtru apartament activ</span> : null}
            {residentFilter ? <span className="rounded-full bg-muted px-3 py-1">Filtru locatar activ</span> : null}
            <button
              type="button"
              className="rounded-full border border-border/70 px-3 py-1 text-foreground"
              onClick={() => {
                setApartmentFilter('');
                setResidentFilter('');
              }}
            >
              Curăță filtrele contextuale
            </button>
          </div>
        ) : null}
      </Card>

      {loading ? <LoadingState label="Se încarcă solicitările..." rows={5} /> : null}
      {!loading && !items.length ? (
        <EmptyState
          title="Nu există solicitări"
          description="Solicitările trimise de locatari vor apărea aici."
          actionLabel="Vezi locatari"
          onAction={() => {
            window.location.href = localizedPath('/admin/residents');
          }}
        />
      ) : null}

      {!loading && items.length ? (
        <TableWrapper>
          <Table>
            <TableHead>
              <TableRow hover={false}>
                <TableHeaderCell><input type="checkbox" checked={items.length > 0 && items.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? items.map((row) => row.id) : [])} /></TableHeaderCell>
                <TableHeaderCell>Ticket</TableHeaderCell>
                <TableHeaderCell>Locatar</TableHeaderCell>
                <TableHeaderCell>Apartament</TableHeaderCell>
                <TableHeaderCell>Categorie</TableHeaderCell>
                <TableHeaderCell>Prioritate</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Responsabil</TableHeaderCell>
                <TableHeaderCell>Actualizată</TableHeaderCell>
                <TableHeaderCell>Acțiuni</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((request) => (
                <TableRow key={request.id}>
                  <TableCell><input type="checkbox" checked={selectedIds.includes(request.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, request.id] : current.filter((id) => id !== request.id))} /></TableCell>
                  <TableCell>
                    <div className="max-w-[260px]">
                      <p className="text-xs font-semibold text-muted-foreground">{request.requestNumber}</p>
                      <p className="font-semibold">{request.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{request.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      <span>{request.resident?.fullName || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Apt. {request.apartment?.apartmentNumber || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{categoryLabels[request.category] || request.category}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(request.priority)}>{priorityLabels[request.priority] || request.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(request.status)}>{statusLabels[request.status] || request.status}</Badge>
                  </TableCell>
                  <TableCell>{request.assignedTo?.fullName || 'Neasignată'}</TableCell>
                  <TableCell>{formatDate(request.updatedAt || request.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Link href={localizedPath(`/admin/requests/${request.id}`)} className="inline-flex h-9 items-center rounded-2xl border border-border/70 px-3 text-xs font-semibold hover:bg-muted/60">
                        Deschide
                      </Link>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-2xl border border-border/70 px-3 text-xs font-semibold hover:bg-muted/60 disabled:opacity-60"
                        disabled={savingId === request.id}
                        onClick={() => runAction(request.id, async () => requestsApi.adminAssign(request.id), 'Solicitarea a fost asignată.')}
                      >
                        Preia
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-2xl border border-border/70 px-3 text-xs font-semibold hover:bg-muted/60 disabled:opacity-60"
                        disabled={savingId === request.id || request.status === 'RESOLVED'}
                        onClick={() => runAction(request.id, async () => requestsApi.adminResolve(request.id), 'Solicitarea a fost marcată ca rezolvată.')}
                      >
                        Rezolvată
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!items.length ? <TableEmpty colSpan={10}>Nu există solicitări.</TableEmpty> : null}
            </TableBody>
          </Table>
        </TableWrapper>
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
