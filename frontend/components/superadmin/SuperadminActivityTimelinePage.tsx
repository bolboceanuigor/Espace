'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import { superadminApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  title?: string | null;
  message?: string | null;
  description?: string | null;
  severity?: string | null;
  createdAt: string;
  actionUrl?: string | null;
  actor?: { id?: string | null; fullName?: string | null; email?: string | null; role?: string | null } | null;
  organization?: { id: string; name: string } | null;
  metadata?: unknown;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
};

const severityLabels: Record<string, string> = {
  INFO: 'Info',
  SUCCESS: 'Succes',
  WARNING: 'Warning',
  ERROR: 'Eroare',
  CRITICAL: 'Critic',
};

const entityLabels: Record<string, string> = {
  ACCESS_REQUEST: 'Cerere acces',
  ORGANIZATION: 'Organizație',
  CONTRACT: 'Contract',
  SUBSCRIPTION: 'Abonament',
  BILLING_TASK: 'Task facturare',
  NOTIFICATION: 'Notificare',
  USER: 'Utilizator',
  DOCUMENT: 'Document',
  INVOICE: 'Factură',
  PAYMENT: 'Plată',
  SYSTEM: 'Sistem',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ro-MD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function severityClass(value?: string | null) {
  if (value === 'CRITICAL' || value === 'ERROR') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (value === 'WARNING') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (value === 'SUCCESS') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function actionIcon(item: ActivityItem) {
  const action = item.action || '';
  const entity = item.entityType || '';
  if (item.severity === 'CRITICAL' || item.severity === 'ERROR') return ShieldAlert;
  if (action.includes('CREATED') || action.includes('SIGNED') || action.includes('COMPLETED')) return CheckCircle2;
  if (action.includes('UPDATED') || action.includes('STATUS')) return Activity;
  if (entity === 'ORGANIZATION') return Building2;
  if (entity === 'USER') return UserRound;
  if (entity === 'CONTRACT' || entity === 'DOCUMENT') return FileText;
  if (entity === 'BILLING_TASK') return ClipboardList;
  return CalendarClock;
}

export function SuperadminActivityTimelinePage() {
  const localizedPath = useLocalizedPath();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    search: '',
    organizationId: searchParams.get('organizationId') || '',
    accessRequestId: searchParams.get('accessRequestId') || '',
    billingTaskId: searchParams.get('billingTaskId') || '',
    actorId: '',
    action: '',
    entityType: '',
    severity: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ items: [], meta: {}, stats: {}, countsBySeverity: {}, countsByEntityType: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await superadminApi.getSuperadminActivity({
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
        page,
        limit: 30,
      });
      setData(res.data || res);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca activitatea.'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const items: ActivityItem[] = data.items || data.data || [];
  const stats = data.stats || {};
  const meta = data.meta || {};
  const entityOptions = useMemo(() => Object.keys(data.countsByEntityType || {}).sort(), [data.countsByEntityType]);

  const openDetail = async (item: ActivityItem) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      const res = await superadminApi.getSuperadminActivityDetail(item.id);
      setSelected(res.data?.item || res.data?.log || res.data || item);
    } catch {
      setSelected(item);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Activity Timeline</h1>
            <p className="mt-1 text-sm text-slate-500">Istoricul acțiunilor importante din platformă.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button disabled title="TODO ES-175" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-400">
              Export CSV
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi label="Activități astăzi" value={stats.today || 0} />
          <Kpi label="Săptămâna aceasta" value={stats.thisWeek || 0} />
          <Kpi label="Warning-uri" value={stats.warnings || 0} tone="warning" />
          <Kpi label="Critice" value={stats.critical || 0} tone="danger" />
          <Kpi label="Acțiuni Superadmin" value={stats.superadminActions || 0} />
          <Kpi label="Acțiuni sistem" value={stats.systemActions || 0} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-2 lg:grid-cols-[1fr_150px_150px_150px_150px_150px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={filters.search} onChange={(event) => { setPage(1); setFilters({ ...filters, search: event.target.value }); }} placeholder="Search acțiune, actor, organizație..." className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" />
            </label>
            <input value={filters.organizationId} onChange={(event) => { setPage(1); setFilters({ ...filters, organizationId: event.target.value }); }} placeholder="Organization ID" className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400" />
            <input value={filters.actorId} onChange={(event) => { setPage(1); setFilters({ ...filters, actorId: event.target.value }); }} placeholder="Actor ID" className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400" />
            <input value={filters.action} onChange={(event) => { setPage(1); setFilters({ ...filters, action: event.target.value }); }} placeholder="Action" className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400" />
            <select value={filters.entityType} onChange={(event) => { setPage(1); setFilters({ ...filters, entityType: event.target.value }); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400">
              <option value="">Entity type</option>
              {entityOptions.map((entity) => <option key={entity} value={entity}>{entityLabels[entity] || entity}</option>)}
            </select>
            <select value={filters.severity} onChange={(event) => { setPage(1); setFilters({ ...filters, severity: event.target.value }); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400">
              <option value="">Severity</option>
              {Object.keys(severityLabels).map((severity) => <option key={severity} value={severity}>{severityLabels[severity]}</option>)}
            </select>
            <button onClick={load} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Filtrează</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:max-w-lg">
            <input type="date" value={filters.dateFrom} onChange={(event) => { setPage(1); setFilters({ ...filters, dateFrom: event.target.value }); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400" />
            <input type="date" value={filters.dateTo} onChange={(event) => { setPage(1); setFilters({ ...filters, dateTo: event.target.value }); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400" />
          </div>
          {filters.accessRequestId || filters.billingTaskId ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {filters.accessRequestId ? <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Cerere: {filters.accessRequestId}</span> : null}
              {filters.billingTaskId ? <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Task: {filters.billingTaskId}</span> : null}
            </div>
          ) : null}
        </section>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div> : null}

        <section className="rounded-lg border border-slate-200 bg-white">
          {loading ? <p className="p-6 text-sm text-slate-500">Se încarcă activitatea...</p> : null}
          {!loading && !items.length ? (
            <div className="p-10 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
              <h2 className="mt-3 font-semibold text-slate-950">Nu există activități înregistrate încă.</h2>
              <p className="mt-1 text-sm text-slate-500">Pe măsură ce sunt create cereri, organizații, contracte și taskuri, istoricul va apărea aici.</p>
            </div>
          ) : null}
          {items.length ? (
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const Icon = actionIcon(item);
                const actionUrl = item.actionUrl ? localizedPath(item.actionUrl.replace(/^\/ro/, '')) : null;
                return (
                  <article key={item.id} className="grid gap-3 p-4 md:grid-cols-[44px_1fr_auto]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">{item.title || item.action}</h3>
                        <Badge value={severityLabels[item.severity || 'INFO'] || item.severity || 'Info'} className={severityClass(item.severity)} />
                        <Badge value={entityLabels[item.entityType] || item.entityType || 'Entity'} className="bg-slate-100 text-slate-700 ring-slate-200" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.message || item.description || '-'}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{item.actor?.fullName || 'Sistem'}{item.actor?.role ? ` · ${item.actor.role}` : ''}</span>
                        {item.organization ? <Link href={localizedPath(`/superadmin/organizations/${item.organization.id}`)} className="font-medium text-emerald-700 hover:underline">{item.organization.name}</Link> : null}
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {actionUrl ? <Link href={actionUrl} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Deschide</Link> : null}
                      <button onClick={() => openDetail(item)} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Detalii</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
          {items.length ? (
            <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm text-slate-500">
              <span>Pagina {meta.page || page} din {meta.totalPages || 1} · {meta.total || items.length} activități</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 px-3 py-2 disabled:opacity-40">Înapoi</button>
                <button disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-200 px-3 py-2 disabled:opacity-40">Înainte</button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <ActivityDetailDrawer item={selected} loading={detailLoading} onClose={() => setSelected(null)} />
    </main>
  );
}

function Kpi({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'warning' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-rose-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-950';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Badge({ value, className }: { value: string; className: string }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${className}`}>{value}</span>;
}

function ActivityDetailDrawer({ item, loading, onClose }: { item: any; loading: boolean; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">{item.action}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{item.title || item.action}</h2>
            <p className="mt-1 text-sm text-slate-500">{formatDateTime(item.createdAt)}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Închide">
            <X className="h-4 w-4" />
          </button>
        </div>
        {loading ? <p className="mt-5 text-sm text-slate-500">Se încarcă detaliile...</p> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Line label="Actor" value={item.actor?.fullName || 'Sistem'} />
          <Line label="Rol actor" value={item.actor?.role || '-'} />
          <Line label="Organizație" value={item.organization?.name || '-'} />
          <Line label="Entity" value={`${item.entityType || '-'}${item.entityId ? ` · ${item.entityId}` : ''}`} />
        </div>
        <section className="mt-5 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">Descriere</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.message || item.description || '-'}</p>
        </section>
        <JsonBlock title="Metadata" value={item.metadata} />
        <JsonBlock title="Before" value={item.beforeSnapshot ?? item.beforeJson} />
        <JsonBlock title="After" value={item.afterSnapshot ?? item.afterJson} />
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <section className="mt-5 rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}
