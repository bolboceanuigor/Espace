'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCheck,
  CircleAlert,
  FileSignature,
  ListChecks,
  RefreshCw,
  Rocket,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui';
import { superadminApi, superadminRevenueApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type NotificationFilters = {
  search: string;
  status: string;
  type: string;
  severity: string;
  organizationId: string;
};

const emptyFilters: NotificationFilters = {
  search: '',
  status: '',
  type: '',
  severity: '',
  organizationId: '',
};

const statuses = ['', 'UNREAD', 'READ', 'ARCHIVED'];
const severities = ['', 'INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL'];
const notificationTypes = [
  '',
  'ACCESS_REQUEST_NEW',
  'ACCESS_REQUEST_UPDATED',
  'ORGANIZATION_CREATED',
  'ONBOARDING_BLOCKED',
  'ONBOARDING_READY',
  'ORGANIZATION_LAUNCHED',
  'CONTRACT_MISSING',
  'CONTRACT_UNSIGNED',
  'CONTRACT_EXPIRING',
  'CONTRACT_EXPIRED',
  'SUBSCRIPTION_INACTIVE',
  'SUBSCRIPTION_PAST_DUE',
  'TRIAL_ENDING',
  'BILLING_TASK_URGENT',
  'LIVE_WITHOUT_CONTRACT',
  'DOCUMENTS_MISSING',
  'SYSTEM',
  'OTHER',
];

const statusLabels: Record<string, string> = {
  UNREAD: 'Necitită',
  READ: 'Citită',
  ARCHIVED: 'Arhivată',
};

const severityLabels: Record<string, string> = {
  INFO: 'Info',
  SUCCESS: 'Succes',
  WARNING: 'Avertizare',
  ERROR: 'Eroare',
  CRITICAL: 'Critică',
};

const typeLabels: Record<string, string> = {
  ACCESS_REQUEST_NEW: 'Cerere nouă',
  ACCESS_REQUEST_UPDATED: 'Cerere actualizată',
  ORGANIZATION_CREATED: 'Organizație creată',
  ONBOARDING_BLOCKED: 'Onboarding blocat',
  ONBOARDING_READY: 'Gata de lansare',
  ORGANIZATION_LAUNCHED: 'Organizație live',
  CONTRACT_MISSING: 'Contract lipsă',
  CONTRACT_UNSIGNED: 'Contract nesemnat',
  CONTRACT_EXPIRING: 'Contract expiră',
  CONTRACT_EXPIRED: 'Contract expirat',
  SUBSCRIPTION_INACTIVE: 'Abonament inactiv',
  SUBSCRIPTION_PAST_DUE: 'Abonament past due',
  TRIAL_ENDING: 'Trial expiră',
  BILLING_TASK_URGENT: 'Task urgent',
  LIVE_WITHOUT_CONTRACT: 'Live fără contract',
  DOCUMENTS_MISSING: 'Documente lipsă',
  SYSTEM: 'Sistem',
  OTHER: 'Altceva',
};

const iconByType: Record<string, LucideIcon> = {
  ACCESS_REQUEST_NEW: Bell,
  ACCESS_REQUEST_UPDATED: Bell,
  ONBOARDING_BLOCKED: ShieldAlert,
  ONBOARDING_READY: Rocket,
  ORGANIZATION_LAUNCHED: Rocket,
  CONTRACT_MISSING: FileSignature,
  CONTRACT_UNSIGNED: FileSignature,
  CONTRACT_EXPIRING: FileSignature,
  CONTRACT_EXPIRED: FileSignature,
  SUBSCRIPTION_INACTIVE: CircleAlert,
  SUBSCRIPTION_PAST_DUE: CircleAlert,
  TRIAL_ENDING: AlertTriangle,
  BILLING_TASK_URGENT: ListChecks,
  LIVE_WITHOUT_CONTRACT: ShieldAlert,
  DOCUMENTS_MISSING: AlertTriangle,
};

export default function SuperadminNotificationsCenterPage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [filters, setFilters] = useState<NotificationFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, totalPages: 1 });
  const [summary, setSummary] = useState<any>({});
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => ({
    search: filters.search || undefined,
    status: filters.status || undefined,
    type: filters.type || undefined,
    severity: filters.severity || undefined,
    organizationId: filters.organizationId || undefined,
    page,
    limit: 30,
  }), [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [notificationsRes, summaryRes, organizationsRes] = await Promise.all([
        superadminApi.getSuperadminNotifications(query),
        superadminApi.getSuperadminNotificationsSummary(),
        superadminRevenueApi.getSuperadminRevenueOrganizations({ limit: 100 }),
      ]);
      setData(notificationsRes.data || { items: [], total: 0, page: 1, totalPages: 1 });
      setSummary(summaryRes.data || {});
      setOrganizations(organizationsRes.data?.items || []);
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Nu am putut încărca notificările.'));
      setData({ items: [], total: 0, page: 1, totalPages: 1 });
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setMessage('');
    setError('');
    try {
      const res = await superadminApi.generateSuperadminNotifications();
      setMessage(res.data?.message || `Au fost generate ${res.data?.created || 0} notificări noi. ${res.data?.kept || 0} notificări existente au fost păstrate.`);
      await load();
    } catch (generateError: any) {
      setError(String(generateError?.message || 'Nu am putut genera notificările.'));
    } finally {
      setGenerating(false);
    }
  };

  const markRead = async (notification: any) => {
    setMessage('');
    setError('');
    try {
      await superadminApi.markSuperadminNotificationRead(notification.id);
      setMessage('Notificarea a fost marcată ca citită.');
      await load();
    } catch (readError: any) {
      setError(String(readError?.message || 'Nu am putut marca notificarea ca citită.'));
    }
  };

  const markAllRead = async () => {
    setMessage('');
    setError('');
    try {
      const res = await superadminApi.markAllSuperadminNotificationsRead();
      setMessage(`${res.data?.updated || 0} notificări au fost marcate ca citite.`);
      await load();
    } catch (readError: any) {
      setError(String(readError?.message || 'Nu am putut marca notificările ca citite.'));
    }
  };

  const archive = async (notification: any) => {
    setMessage('');
    setError('');
    try {
      await superadminApi.archiveSuperadminNotification(notification.id);
      setMessage('Notificarea a fost arhivată.');
      await load();
    } catch (archiveError: any) {
      setError(String(archiveError?.message || 'Nu am putut arhiva notificarea.'));
    }
  };

  const openNotification = async (notification: any) => {
    if (notification.status === 'UNREAD') {
      await superadminApi.markSuperadminNotificationRead(notification.id).catch(() => undefined);
    }
    const target = routeTarget(notification.actionUrl, localizedPath);
    if (target) router.push(target);
  };

  const items = data.items || data.notifications || [];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Notificări"
        description="Evenimente importante din platformă, leaduri, onboarding, contracte și facturare."
        badge={<Badge variant="neutral">Notifications Center</Badge>}
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generate} disabled={generating} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
              <Bell className="h-4 w-4" />
              {generating ? 'Se generează...' : 'Generează notificări'}
            </button>
            <button type="button" onClick={markAllRead} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              <CheckCheck className="h-4 w-4" />
              Marchează toate ca citite
            </button>
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Necitite" value={summary.unreadCount || data.unreadCount || 0} icon={<Bell className="h-5 w-5" />} tone="warning" />
        <StatCard label="Critice" value={summary.criticalCount || data.criticalCount || 0} icon={<ShieldAlert className="h-5 w-5" />} tone="danger" />
        <StatCard label="Avertizări" value={summary.warningCount || data.warningCount || 0} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <StatCard label="Astăzi" value={summary.todayCount || 0} icon={<Bell className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Săptămâna aceasta" value={summary.thisWeekCount || 0} icon={<Bell className="h-5 w-5" />} tone="neutral" />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Lista notificărilor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Evenimente generate din date reale, fără date demo.</p>
          </div>
          <button type="button" onClick={() => { setFilters(emptyFilters); setPage(1); }} className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            Resetează filtre
          </button>
        </div>

        <Filters filters={filters} organizations={organizations} onChange={(next) => { setFilters(next); setPage(1); }} />

        {items.length ? (
          <div className="space-y-3">
            {items.map((notification: any) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => openNotification(notification)}
                onRead={() => markRead(notification)}
                onArchive={() => archive(notification)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            Nu există notificări încă. Când apar cereri, contracte, taskuri sau probleme de onboarding, notificările vor apărea aici.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{data.total || 0} notificări</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-9 rounded-xl border border-border/70 px-3 font-semibold disabled:opacity-50">
              Anterior
            </button>
            <span>Pagina {data.page || page} / {data.totalPages || 1}</span>
            <button type="button" disabled={page >= (data.totalPages || 1) || loading} onClick={() => setPage((current) => current + 1)} className="min-h-9 rounded-xl border border-border/70 px-3 font-semibold disabled:opacity-50">
              Următor
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Filters({ filters, organizations, onChange }: { filters: NotificationFilters; organizations: any[]; onChange: (filters: NotificationFilters) => void }) {
  return (
    <div className="my-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_0.9fr_1fr_0.9fr_1fr]">
      <label className="block">
        <span className="label">Search</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-9" value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Titlu, mesaj, organizație, lead" />
        </div>
      </label>
      <SelectField label="Status" value={filters.status} options={statuses} labels={statusLabels} onChange={(value) => onChange({ ...filters, status: value })} />
      <SelectField label="Tip" value={filters.type} options={notificationTypes} labels={typeLabels} onChange={(value) => onChange({ ...filters, type: value })} />
      <SelectField label="Severitate" value={filters.severity} options={severities} labels={severityLabels} onChange={(value) => onChange({ ...filters, severity: value })} />
      <label className="block">
        <span className="label">Organizație</span>
        <select className="select" value={filters.organizationId} onChange={(event) => onChange({ ...filters, organizationId: event.target.value })}>
          <option value="">Toate</option>
          {organizations.map((organization) => (
            <option key={organization.organizationId} value={organization.organizationId}>{organization.organizationName}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function NotificationRow({ notification, onOpen, onRead, onArchive }: { notification: any; onOpen: () => void; onRead: () => void; onArchive: () => void }) {
  const Icon = iconByType[notification.type] || Bell;
  const unread = notification.status === 'UNREAD';
  return (
    <article className={`rounded-2xl border p-4 ${unread ? 'border-foreground/15 bg-muted/25' : 'border-border/70 bg-white'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${severityIconClass(notification.severity)}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{notification.title}</h3>
              {unread ? <span className="h-2 w-2 rounded-full bg-foreground" aria-label="Necitită" /> : null}
            </div>
            {notification.message ? <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {notification.organization ? <Badge variant="neutral">{notification.organization.name}</Badge> : null}
              <Badge variant={severityTone(notification.severity)}>{severityLabels[notification.severity] || notification.severity}</Badge>
              <Badge variant={statusTone(notification.status)}>{statusLabels[notification.status] || notification.status}</Badge>
              <Badge variant="neutral">{typeLabels[notification.type] || notification.type}</Badge>
              <span className="inline-flex min-h-6 items-center text-xs font-medium text-muted-foreground">{date(notification.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {notification.actionUrl ? (
            <button type="button" onClick={onOpen} className="inline-flex min-h-9 items-center rounded-xl bg-foreground px-3 text-sm font-semibold text-background">
              Deschide
            </button>
          ) : null}
          {notification.status === 'UNREAD' ? (
            <button type="button" onClick={onRead} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border/70 px-3 text-sm font-semibold text-foreground hover:bg-muted/60">
              <CheckCheck className="h-4 w-4" />
              Citită
            </button>
          ) : null}
          {notification.status !== 'ARCHIVED' ? (
            <button type="button" onClick={onArchive} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border/70 px-3 text-sm font-semibold text-foreground hover:bg-muted/60">
              <Archive className="h-4 w-4" />
              Arhivează
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || 'all'} value={option}>{option ? labels[option] || option : 'Toate'}</option>)}
      </select>
    </label>
  );
}

function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const classes = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${classes}`}>{children}</div>;
}

function routeTarget(actionUrl: string | null | undefined, localizedPath: (path: string) => string) {
  if (!actionUrl) return '';
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;
  if (/^\/[a-z]{2}(\/|$)/i.test(actionUrl)) return actionUrl;
  return localizedPath(actionUrl);
}

function severityTone(value?: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (value === 'SUCCESS') return 'success';
  if (value === 'WARNING') return 'warning';
  if (value === 'ERROR' || value === 'CRITICAL') return 'error';
  return 'neutral';
}

function statusTone(value?: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' {
  if (value === 'UNREAD') return 'warning';
  if (value === 'READ') return 'success';
  return 'neutral';
}

function severityIconClass(value?: string) {
  if (value === 'CRITICAL' || value === 'ERROR') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'SUCCESS') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-border/70 bg-muted/40 text-foreground';
}

function date(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ro-MD', { dateStyle: 'medium', timeStyle: 'short' });
}
