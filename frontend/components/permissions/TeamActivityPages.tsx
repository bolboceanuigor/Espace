'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Eye,
  Filter,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { adminRbacApi } from '@/lib/api';
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader, VariantBadge } from '@/components/ui';

type ActivityItem = {
  id: string;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
  actorRole?: { id?: string | null; name: string; type: string } | null;
  action: string;
  category: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  entityType?: string | null;
  entityId?: string | null;
  title?: string | null;
  message?: string | null;
  actionUrl?: string | null;
  metadata?: unknown;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ActivityPayload = {
  items: ActivityItem[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
  stats?: Record<string, any>;
  member?: any;
  summary?: Record<string, any>;
  moduleBreakdown?: Array<{ category: string; count: number }>;
};

type Filters = {
  search?: string;
  category?: string;
  riskLevel?: string;
  severity?: string;
  sensitiveOnly?: boolean;
  failedOnly?: boolean;
};

const categoryLabels: Record<string, string> = {
  AUTH: 'Autentificare',
  TEAM: 'Echipă',
  ROLES_PERMISSIONS: 'Roluri și permisiuni',
  BILLING: 'Facturare',
  INVOICES: 'Facturi',
  PAYMENTS: 'Plăți',
  TARIFFS: 'Tarife',
  METERS: 'Contoare',
  METER_READINGS: 'Indici',
  RESIDENTS: 'Locatari',
  APARTMENTS: 'Apartamente',
  ANNOUNCEMENTS: 'Anunțuri',
  REQUESTS: 'Solicitări',
  IMPORTS_EXPORTS: 'Import/Export',
  DATA_QUALITY: 'Calitatea datelor',
  SETTINGS: 'Setări',
  SYSTEM: 'Sistem',
};

const riskLabels: Record<string, string> = {
  LOW: 'Risc scăzut',
  MEDIUM: 'Risc mediu',
  HIGH: 'Risc ridicat',
  CRITICAL: 'Critic',
};

const severityLabels: Record<string, string> = {
  INFO: 'Info',
  SUCCESS: 'Succes',
  WARNING: 'Warning',
  ERROR: 'Eroare',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function riskVariant(risk?: string): 'neutral' | 'info' | 'warning' | 'error' {
  if (risk === 'CRITICAL') return 'error';
  if (risk === 'HIGH') return 'warning';
  if (risk === 'MEDIUM') return 'info';
  return 'neutral';
}

function severityVariant(severity?: string): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  if (severity === 'SUCCESS') return 'success';
  if (severity === 'WARNING') return 'warning';
  if (severity === 'ERROR') return 'error';
  if (severity === 'INFO') return 'info';
  return 'neutral';
}

function useRemote<T>(loader: () => Promise<{ data: T }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loader()
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((err: any) => {
        if (active) setError(String(err?.message || 'Nu am putut încărca activitatea.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error };
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <p className="font-semibold text-red-900">Nu am putut încărca datele</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
    </Card>
  );
}

function KpiGrid({ stats, security = false, member = false }: { stats?: Record<string, any>; security?: boolean; member?: boolean }) {
  const items: Array<[string, string | number, LucideIcon]> = member
    ? [
        ['Activități totale', stats?.totalActivities ?? 0, Activity],
        ['Acțiuni azi', stats?.today ?? 0, CalendarClock],
        ['Acțiuni sensibile', stats?.sensitiveActions ?? 0, ShieldAlert],
        ['Acțiuni critice', stats?.criticalActions ?? 0, AlertTriangle],
        ['Login success', stats?.loginSuccess ?? 0, ShieldCheck],
        ['Login failed', stats?.loginFailed ?? 0, LockKeyhole],
        ['Ultima activitate', formatDate(stats?.lastActivityAt), CalendarClock],
      ]
    : security
      ? [
        ['Login-uri reușite azi', stats?.loginSuccessToday ?? 0, ShieldCheck],
        ['Login-uri eșuate azi', stats?.loginFailedToday ?? 0, ShieldAlert],
        ['Conturi suspendate', stats?.suspended ?? 0, LockKeyhole],
        ['Conturi revocate', stats?.revoked ?? 0, AlertTriangle],
        ['Resetări parolă', stats?.passwordResetRequests ?? 0, CalendarClock],
        ['Acces blocat', stats?.blockedAccess ?? 0, ShieldAlert],
      ]
    : [
        ['Activități azi', stats?.today ?? 0, Activity],
        ['Acțiuni sensibile', stats?.sensitive ?? 0, ShieldAlert],
        ['Acțiuni critice', stats?.critical ?? 0, AlertTriangle],
        ['Login-uri reușite', stats?.loginSuccess ?? 0, ShieldCheck],
        ['Login-uri eșuate', stats?.loginFailed ?? 0, LockKeyhole],
        ['Membri activi', stats?.activeMembers ?? 0, UserRound],
        ['Membri suspendați', stats?.suspendedMembers ?? 0, AlertTriangle],
        ['Ultima activitate', formatDate(stats?.lastActivityAt), CalendarClock],
      ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value, Icon]) => (
        <Card key={String(label)} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{String(label)}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{String(value)}</p>
            </div>
            <span className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-500">
              <Icon className="h-4 w-4" />
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function FiltersBar({
  filters,
  setFilters,
  security,
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  security?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.search || ''}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Caută actor, acțiune, entitate..."
            className="pl-9"
          />
        </div>
        {!security ? (
          <select
            value={filters.category || ''}
            onChange={(event) => setFilters({ ...filters, category: event.target.value })}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-950/10"
          >
            <option value="">Toate categoriile</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={filters.riskLevel || ''}
          onChange={(event) => setFilters({ ...filters, riskLevel: event.target.value })}
          className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-950/10"
        >
          <option value="">Toate riscurile</option>
          {Object.entries(riskLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(filters.failedOnly)}
            onChange={(event) => setFilters({ ...filters, failedOnly: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          Doar eșuate
        </label>
      </div>
    </Card>
  );
}

function ActivityTable({ items, onOpen }: { items: ActivityItem[]; onOpen: (item: ActivityItem) => void }) {
  if (!items.length) {
    return (
      <EmptyState
        title="Nu există activitate înregistrată"
        description="Acțiunile membrilor echipei vor apărea aici după ce lucrează în aplicație."
      />
    );
  }

  return (
    <Card noPadding className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Membru</th>
              <th className="px-4 py-3 text-left">Acțiune</th>
              <th className="px-4 py-3 text-left">Categorie</th>
              <th className="px-4 py-3 text-left">Risc</th>
              <th className="px-4 py-3 text-left">Entitate</th>
              <th className="px-4 py-3 text-left">Descriere</th>
              <th className="px-4 py-3 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">{item.actor?.fullName || 'Sistem'}</p>
                  <p className="text-xs text-slate-500">{item.actor?.email || item.actorRole?.name || '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.action}</p>
                  <VariantBadge variant={severityVariant(item.severity)}>{severityLabels[item.severity] || item.severity}</VariantBadge>
                </td>
                <td className="px-4 py-3 text-slate-700">{categoryLabels[item.category] || item.category}</td>
                <td className="px-4 py-3">
                  <VariantBadge variant={riskVariant(item.riskLevel)}>{riskLabels[item.riskLevel] || item.riskLevel}</VariantBadge>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{item.entityType || '—'}</p>
                  <p className="max-w-40 truncate text-xs text-slate-500">{item.entityId || '—'}</p>
                </td>
                <td className="max-w-sm px-4 py-3 text-slate-600">
                  <p className="font-medium text-slate-900">{item.title || item.message || item.action}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.message || '—'}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {item.actor?.id ? (
                      <ButtonLink href={`/admin/team/activity/${item.actor.id}`} variant="outline" size="sm">
                        Membru
                      </ButtonLink>
                    ) : null}
                    {item.actionUrl ? (
                      <ButtonLink href={item.actionUrl} variant="secondary" size="sm">
                        Entitate
                      </ButtonLink>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => onOpen(item)}>
                      <Eye className="h-4 w-4" /> Detalii
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ActivityTimeline({ items, onOpen }: { items: ActivityItem[]; onOpen: (item: ActivityItem) => void }) {
  const grouped = items.reduce<Record<string, ActivityItem[]>>((acc, item) => {
    const day = new Intl.DateTimeFormat('ro-MD', { dateStyle: 'full' }).format(new Date(item.createdAt));
    acc[day] = [...(acc[day] || []), item];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, dayItems]) => (
        <div key={day} className="space-y-3">
          <div className="sticky top-0 z-10 bg-slate-50/90 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
            {day}
          </div>
          {dayItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <VariantBadge variant={riskVariant(item.riskLevel)}>{riskLabels[item.riskLevel] || item.riskLevel}</VariantBadge>
                    <Badge>{categoryLabels[item.category] || item.category}</Badge>
                    <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 font-semibold text-slate-950">{item.title || item.action}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message || '—'}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.actor?.fullName || 'Sistem'} · {item.actorRole?.name || 'Fără rol'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
                  Detalii
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

function ActivityDetails({ item, onClose }: { item: ActivityItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalii activitate</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{item.title || item.action}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.message}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Închide
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['Action', item.action],
            ['Categorie', categoryLabels[item.category] || item.category],
            ['Risc', riskLabels[item.riskLevel] || item.riskLevel],
            ['Severity', severityLabels[item.severity] || item.severity],
            ['Actor', item.actor?.fullName || 'Sistem'],
            ['Rol actor', item.actorRole?.name || '—'],
            ['Entitate', `${item.entityType || '—'} ${item.entityId || ''}`],
            ['IP', item.ipAddress || '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <JsonBlock title="Metadata" value={item.metadata} />
        <JsonBlock title="Before snapshot" value={item.beforeSnapshot} />
        <JsonBlock title="After snapshot" value={item.afterSnapshot} />
        {item.userAgent ? <JsonBlock title="User agent" value={item.userAgent} /> : null}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ActivityView({
  title,
  description,
  loader,
  security = false,
  sensitive = false,
  memberMode = false,
}: {
  title: string;
  description: string;
  loader: (filters: Filters) => Promise<{ data: ActivityPayload }>;
  security?: boolean;
  sensitive?: boolean;
  memberMode?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(sensitive ? { sensitiveOnly: true } : {});
  const [view, setView] = useState<'table' | 'timeline'>('table');
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const queryKey = useMemo(() => JSON.stringify(filters), [filters]);
  const { data, loading, error } = useRemote<ActivityPayload>(() => loader(filters), [queryKey]);
  const stats = security ? data?.stats : data?.stats || data?.summary;

  return (
    <div className="space-y-5">
      <PageHeader
        title={memberMode && data?.member?.user?.fullName ? `Activitatea membrului: ${data.member.user.fullName}` : title}
        description={memberMode && data?.member?.user?.email ? data.member.user.email : description}
        actions={
          <>
            <ButtonLink href="/admin/team/activity" variant="secondary">
              Activitate
            </ButtonLink>
            <ButtonLink href="/admin/team/sensitive-actions" variant="secondary">
              Acțiuni sensibile
            </ButtonLink>
            <ButtonLink href="/admin/team/security" variant="secondary">
              Securitate
            </ButtonLink>
            <Button variant="outline" disabled>
              Export CSV în curând
            </Button>
          </>
        }
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error ? (
        <>
          <KpiGrid stats={stats} security={security} member={memberMode} />
          {memberMode && data?.moduleBreakdown?.length ? (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-950">Activitate pe module</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.moduleBreakdown.map((item) => (
                  <Badge key={item.category}>
                    {categoryLabels[item.category] || item.category}: {item.count}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}
          <FiltersBar filters={filters} setFilters={setFilters} security={security} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {data?.meta?.total ?? data?.items?.length ?? 0} înregistrări
            </p>
            <div className="flex items-center gap-2">
              <Button variant={view === 'table' ? 'primary' : 'outline'} size="sm" onClick={() => setView('table')}>
                <Filter className="h-4 w-4" /> Tabel
              </Button>
              <Button variant={view === 'timeline' ? 'primary' : 'outline'} size="sm" onClick={() => setView('timeline')}>
                <Activity className="h-4 w-4" /> Timeline
              </Button>
            </div>
          </div>
          {view === 'table' ? (
            <ActivityTable items={data?.items || []} onOpen={setSelected} />
          ) : (
            <ActivityTimeline items={data?.items || []} onOpen={setSelected} />
          )}
        </>
      ) : null}
      <ActivityDetails item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function TeamActivityPage() {
  return (
    <ActivityView
      title="Activitate echipă"
      description="Urmărește acțiunile efectuate de membrii echipei în asociație."
      loader={(filters) => adminRbacApi.teamActivity(filters)}
    />
  );
}

export function TeamSensitiveActionsPage() {
  return (
    <ActivityView
      title="Acțiuni sensibile"
      description="Vezi acțiunile cu impact ridicat asupra datelor, facturării, plăților și permisiunilor."
      loader={(filters) => adminRbacApi.teamSensitiveActions(filters)}
      sensitive
    />
  );
}

export function TeamSecurityPage() {
  return (
    <ActivityView
      title="Securitate echipă"
      description="Monitorizează autentificările, accesul suspendat/revocat și evenimentele de securitate."
      loader={(filters) => adminRbacApi.teamSecurity(filters)}
      security
    />
  );
}

export function TeamMemberActivityPage() {
  const params = useParams<{ id?: string; userId?: string }>();
  const memberId = String(params?.id || '');
  const userId = String(params?.userId || '');
  return (
    <ActivityView
      title="Activitatea membrului"
      description="Timeline complet pentru membrul selectat."
      loader={(filters) =>
        memberId
          ? adminRbacApi.teamMemberActivity(memberId, filters)
          : adminRbacApi.teamActivity({ ...filters, actorUserId: userId })
      }
      memberMode
    />
  );
}
