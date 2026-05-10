'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import { notificationsApi } from '@/lib/api';

type NotificationCenterMode = 'admin' | 'resident';

type NotificationItem = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

const TYPE_OPTIONS = [
  ['ANNOUNCEMENT', 'Anunțuri'],
  ['REQUEST', 'Solicitări'],
  ['REQUEST_MESSAGE', 'Comentarii solicitări'],
  ['REQUEST_STATUS', 'Status solicitări'],
  ['INVOICE', 'Facturi'],
  ['PAYMENT', 'Plăți'],
  ['METER_READING', 'Indici contoare'],
  ['PROFILE_UPDATE_REQUEST', 'Solicitări date'],
  ['SYSTEM', 'Sistem'],
];

const SEVERITY_OPTIONS = [
  ['INFO', 'Info'],
  ['SUCCESS', 'Succes'],
  ['WARNING', 'Atenție'],
  ['URGENT', 'Urgent'],
];

function notificationItems(data: any): NotificationItem[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function localizedUrl(locale: string, url?: string | null) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith(`/${locale}/`)) return url;
  return `/${locale}${url.startsWith('/') ? url : `/${url}`}`;
}

function labelFor(value: string, options: string[][]) {
  return options.find(([key]) => key === value)?.[1] || value;
}

function severityClass(value?: string) {
  if (value === 'URGENT') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'SUCCESS') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function typeLabel(value?: string) {
  return labelFor(value || 'SYSTEM', TYPE_OPTIONS);
}

function formatDate(value?: string | null) {
  if (!value) return 'Necompletat';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function NotificationCenterPage({ mode }: { mode: NotificationCenterMode }) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<{ total: number; unread: number; urgent: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    severity: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'newest',
  });

  const copy = useMemo(
    () =>
      mode === 'admin'
        ? {
            title: 'Notificări',
            subtitle: 'Noutăți despre solicitări, locatari, cereri și activitatea asociației.',
            emptyTitle: 'Nu există notificări',
            emptyText: 'Noutățile despre solicitări, locatari și activitatea asociației vor apărea aici.',
          }
        : {
            title: 'Notificări',
            subtitle: 'Noutăți despre facturi, plăți, anunțuri și solicitările tale.',
            emptyTitle: 'Nu ai notificări',
            emptyText: 'Noutățile despre facturi, plăți, anunțuri și solicitări vor apărea aici.',
          },
    [mode],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = {
        status: filters.status || undefined,
        type: filters.type || undefined,
        severity: filters.severity || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        sortBy: filters.sortBy || undefined,
        sortDirection: filters.sortBy === 'oldest' ? 'asc' : 'desc',
        limit: 50,
      };
      const res = mode === 'admin' ? await notificationsApi.adminList(params) : await notificationsApi.residentList(params);
      setItems(notificationItems(res.data));
      setStats(res.data?.stats || null);
    } catch {
      setMessage('Nu am putut încărca notificările.');
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filters, mode]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const markRead = async (id: string) => {
    if (mode === 'admin') await notificationsApi.adminRead(id);
    else await notificationsApi.residentRead(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() } : item)));
    setStats((prev) => (prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev));
  };

  const markAllRead = async () => {
    if (mode === 'admin') await notificationsApi.adminReadAll(filters.type ? { type: filters.type } : undefined);
    else await notificationsApi.residentReadAll(filters.type ? { type: filters.type } : undefined);
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
    setStats((prev) => (prev ? { ...prev, unread: 0 } : prev));
    setMessage('Notificările au fost marcate ca citite.');
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.isRead) await markRead(item.id);
    const target = localizedUrl(locale, item.actionUrl || item.link);
    if (target) router.push(target);
  };

  const total = stats?.total ?? items.length;
  const unread = stats?.unread ?? items.filter((item) => !item.isRead).length;
  const urgent = stats?.urgent ?? items.filter((item) => item.severity === 'URGENT').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-sm"
            onClick={markAllRead}
          >
            <CheckCheck className="h-4 w-4" />
            Marchează toate ca citite
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-sm"
            onClick={() => load().catch(() => undefined)}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizează
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Total notificări', total],
          ['Necitite', unread],
          ['Urgente', urgent],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-7">
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
          >
            <option value="">Toate</option>
            <option value="UNREAD">Necitite</option>
            <option value="READ">Citite</option>
          </select>
          <select
            value={filters.type}
            onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
            className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
          >
            <option value="">Toate tipurile</option>
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.severity}
            onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
            className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
          >
            <option value="">Toate severitățile</option>
            {SEVERITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
          />
          <select
            value={filters.sortBy}
            onChange={(event) => setFilters((prev) => ({ ...prev, sortBy: event.target.value }))}
            className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
          >
            <option value="newest">Cele mai noi</option>
            <option value="oldest">Cele mai vechi</option>
            <option value="unread">Necitite primele</option>
            <option value="urgent">Urgente primele</option>
          </select>
          <button type="button" onClick={() => load().catch(() => undefined)} className="rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-white">
            Aplică filtre
          </button>
        </div>
      </div>

      {message ? <p className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">Se încarcă notificările...</div>
        ) : null}
        {!loading && !items.length ? (
          <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">{copy.emptyTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.emptyText}</p>
          </div>
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border p-4 shadow-sm transition ${
              item.isRead ? 'border-border/70 bg-card' : 'border-primary/30 bg-primary/5'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {!item.isRead ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityClass(item.severity)}`}>
                    {labelFor(item.severity || 'INFO', SEVERITY_OPTIONS)}
                  </span>
                  <span className="rounded-full border border-border/70 bg-white px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {typeLabel(item.type)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                {!item.isRead ? (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    className="rounded-xl border border-border/70 bg-white px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    Marchează citită
                  </button>
                ) : null}
                {(item.actionUrl || item.link) ? (
                  <button type="button" onClick={() => openNotification(item)} className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-white">
                    Deschide
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
