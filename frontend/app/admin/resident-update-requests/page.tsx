'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, Search, UserRound, Users, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { adminResidentUpdateRequestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type RequestType =
  | 'FULL_NAME_CHANGE'
  | 'PHONE_CHANGE'
  | 'EMAIL_CHANGE'
  | 'CONTACT_METHOD_CHANGE'
  | 'APARTMENT_RELATION_CHANGE'
  | 'OTHER';

type UpdateRequestRow = {
  id: string;
  requestType: RequestType;
  requestTypeLabel?: string;
  status: RequestStatus;
  resident: { id: string; fullName: string; phone?: string; email?: string };
  apartment?: { id: string; apartmentNumber: string; staircase?: string } | null;
  apartments?: Array<{ id: string; apartmentNumber: string; staircase?: string }>;
  currentValueLabel?: string;
  requestedValueLabel?: string;
  message?: string;
  createdAt?: string;
  reviewedAt?: string | null;
};

type ListResponse = {
  organization?: { shortName?: string; associationCode?: string };
  items: UpdateRequestRow[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
  stats: {
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    currentMonth: number;
    lastRequestAt?: string | null;
  };
};

const emptyData: ListResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  stats: { pending: 0, approved: 0, rejected: 0, cancelled: 0, currentMonth: 0, lastRequestAt: null },
};

const statusLabels: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Aprobată',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
};

const statusVariant = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
} as const;

const requestTypeLabels: Record<RequestType, string> = {
  FULL_NAME_CHANGE: 'Schimbare nume',
  PHONE_CHANGE: 'Schimbare telefon',
  EMAIL_CHANGE: 'Schimbare email',
  CONTACT_METHOD_CHANGE: 'Schimbare metodă contact',
  APARTMENT_RELATION_CHANGE: 'Relație apartament',
  OTHER: 'Altă solicitare',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminResidentUpdateRequestsPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<ListResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: 'ALL',
    requestType: 'ALL',
    staircase: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'pending',
    sortDirection: 'desc' as 'asc' | 'desc',
    page: 1,
    limit: 20,
  });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminResidentUpdateRequestsApi.list({
        ...filters,
        status: filters.status === 'ALL' ? undefined : filters.status,
        requestType: filters.requestType === 'ALL' ? undefined : filters.requestType,
        staircase: filters.staircase || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      setData(response.data || emptyData);
    } catch (err: any) {
      setData(emptyData);
      setError(String(err?.message || 'Nu am putut încărca solicitările.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const badgeText = useMemo(() => {
    const shortName = data.organization?.shortName || 'A.P.C.';
    const code = data.organization?.associationCode || 'cod necompletat';
    return `${shortName} · ${code} · ${data.stats.pending} pending`;
  }, [data.organization, data.stats.pending]);

  const stats = [
    { label: 'Pending', value: String(data.stats.pending), description: 'Așteaptă review', icon: <Clock3 className="h-5 w-5" />, tone: data.stats.pending ? ('warning' as const) : ('success' as const) },
    { label: 'Aprobate', value: String(data.stats.approved), description: 'Procesate pozitiv', icon: <CheckCircle2 className="h-5 w-5" />, tone: 'success' as const },
    { label: 'Respinse', value: String(data.stats.rejected), description: 'Cu răspuns admin', icon: <XCircle className="h-5 w-5" />, tone: data.stats.rejected ? ('danger' as const) : ('neutral' as const) },
    { label: 'Anulate', value: String(data.stats.cancelled), description: 'Anulate de locatar', icon: <XCircle className="h-5 w-5" /> },
    { label: 'Luna curentă', value: String(data.stats.currentMonth), description: 'Solicitări primite' },
    { label: 'Ultima solicitare', value: formatDate(data.stats.lastRequestAt), description: 'Data primirii' },
  ];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Solicitări actualizare date"
        description="Verifică și procesează cererile trimise de locatari pentru modificarea datelor personale sau a relațiilor cu apartamentele."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{badgeText}</Badge>
            <Button onClick={loadRequests} variant="secondary" disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Actualizează
            </Button>
            <ButtonLink href="/admin/residents" variant="secondary">
              <Users className="h-4 w-4" /> Vezi locatari
            </ButtonLink>
            <ButtonLink href="/admin/apartments" variant="secondary">
              Vezi apartamente
            </ButtonLink>
          </div>
        }
      />

      {error ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.6fr_repeat(5,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
              placeholder="Caută nume, telefon, email, apartament sau mesaj"
              className="pl-9"
              aria-label="Caută solicitări"
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}
            className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm"
            aria-label="Status solicitare"
          >
            <option value="ALL">Toate statusurile</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={filters.requestType}
            onChange={(event) => setFilters((current) => ({ ...current, requestType: event.target.value, page: 1 }))}
            className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm"
            aria-label="Tip solicitare"
          >
            <option value="ALL">Toate tipurile</option>
            {Object.entries(requestTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Input
            value={filters.staircase}
            onChange={(event) => setFilters((current) => ({ ...current, staircase: event.target.value, page: 1 }))}
            placeholder="Scara"
            aria-label="Filtru scară"
          />
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value, page: 1 }))}
            aria-label="Data de la"
          />
          <select
            value={filters.sortBy}
            onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value, page: 1 }))}
            className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm"
            aria-label="Sortare"
          >
            <option value="pending">Pending primele</option>
            <option value="newest">Cele mai noi</option>
            <option value="oldest">Cele mai vechi</option>
            <option value="requestType">Tip solicitare</option>
            <option value="residentName">Nume locatar</option>
          </select>
        </div>
      </Card>

      <Card noPadding className="overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Se încarcă solicitările...</div>
        ) : data.items.length === 0 ? (
          <div className="p-8 text-center">
            <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">Nu există solicitări de actualizare</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cererile trimise de locatari pentru modificarea datelor vor apărea aici.</p>
            <div className="mt-4 flex justify-center gap-2">
              <ButtonLink href="/admin/residents" variant="secondary">Vezi locatari</ButtonLink>
              <ButtonLink href="/admin/apartments" variant="secondary">Vezi apartamente</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/35 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Locatar</th>
                  <th className="px-4 py-3">Apartament/e</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Date actuale</th>
                  <th className="px-4 py-3">Date solicitate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={localizedPath(`/admin/residents/${item.resident.id}`)} className="font-semibold text-foreground hover:underline">
                        {item.resident.fullName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.resident.phone || item.resident.email || 'Contact necompletat'}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.apartment ? `Ap. ${item.apartment.apartmentNumber}${item.apartment.staircase ? ` · Scara ${item.apartment.staircase}` : ''}` : 'Neasociat'}
                    </td>
                    <td className="px-4 py-3">{item.requestTypeLabel || requestTypeLabels[item.requestType]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.currentValueLabel || '-'}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.requestedValueLabel || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[item.status]}>{statusLabels[item.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ButtonLink href={`/admin/resident-update-requests/${item.id}`} size="sm" variant="secondary">
                          Deschide <ArrowRight className="h-4 w-4" />
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
