'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Copy, RefreshCw } from 'lucide-react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, StatusBadge, useToast } from '@/components/ui';
import { cleaningsApi, managerApi } from '@/lib/api';
import { addDays, parseDateOnly, toDateOnlyString } from '@/lib/date';
import { formatDate } from '@/lib/formatDate';
import { useManagerUi } from '@/context/ManagerUiContext';

type ManagerOverview = Awaited<ReturnType<typeof managerApi.getOverview>>['data'];

type ReservationItem = {
  reservationId: string;
  propertyName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  phone?: string | null;
};

type ManagerView = 'today' | 'tomorrow' | 'week';

const MANAGER_VIEW_STORAGE_KEY = 'manager.view';

export default function ManagerPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('manager');
  const c = useTranslations('common');
  const tActions = useTranslations('actions');
  const { showToast } = useToast();
  const { setCleaningsTodoCount } = useManagerUi();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<ManagerOverview | null>(null);
  const [view, setView] = useState<ManagerView>(() => {
    if (typeof window === 'undefined') return 'today';
    const saved = localStorage.getItem(MANAGER_VIEW_STORAGE_KEY);
    return saved === 'tomorrow' || saved === 'week' ? saved : 'today';
  });
  const [selectedReservation, setSelectedReservation] = useState<ReservationItem | null>(null);
  const [notesModal, setNotesModal] = useState<{ cleaningId: string; notes: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const todayDate = useMemo(() => toDateOnlyString(new Date()), []);
  const queryDate = useMemo(
    () => (view === 'tomorrow' ? addDays(todayDate, 1) : todayDate),
    [todayDate, view],
  );
  const queryDays = view === 'week' ? 7 : 1;

  useEffect(() => {
    localStorage.setItem(MANAGER_VIEW_STORAGE_KEY, view);
  }, [view]);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const res = await managerApi.getOverview({ date: queryDate, days: queryDays });
      setOverview(res.data);
      const todos = (res.data.today.cleanings || []).filter((item) => item.status === 'TODO').length;
      setCleaningsTodoCount(todos);
    } catch {
      showToast(c('error'), 'error');
      setOverview(null);
      setCleaningsTodoCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [c, queryDate, queryDays, setCleaningsTodoCount, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const todayLabel = useMemo(
    () => formatDate(locale, new Date(`${queryDate}T12:00:00Z`)),
    [queryDate, locale],
  );

  const reservationDateRange = (item: ReservationItem) =>
    `${formatDate(locale, parseDateOnly(item.checkIn))} - ${formatDate(locale, parseDateOnly(item.checkOut))}`;

  const openReservationInCalendar = (item: ReservationItem) => {
    const start = queryDate;
    const end = addDays(queryDate, 40);
    router.push(
      `/${locale}/calendar?start=${start}&end=${end}&highlightReservationId=${item.reservationId}`,
    );
  };

  const copyDailyReport = async () => {
    if (!overview) return;
    const done = overview.today.cleanings.filter((item) => item.status === 'DONE').length;
    const total = overview.today.cleanings.length;
    const lines = [
      t('report.title', { date: formatDate(locale, parseDateOnly(overview.date)) }),
      t('report.lines.assigned', { value: overview.assignedPropertiesCount }),
      t('report.lines.checkins', { value: overview.today.checkIns.length }),
      t('report.lines.checkouts', { value: overview.today.checkOuts.length }),
      t('report.lines.cleanings', { done, total }),
      t('report.lines.upcoming', { value: overview.upcoming.reservations.length }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast(t('report.copied'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  const toggleCleaning = async (cleaningId: string, status: 'TODO' | 'DONE' | 'CANCELLED') => {
    if (status === 'CANCELLED') return;
    const nextStatus = status === 'DONE' ? 'TODO' : 'DONE';
    const delta = nextStatus === 'DONE' ? -1 : 1;
    setOverview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        today: {
          ...prev.today,
          cleanings: prev.today.cleanings.map((item) =>
            item.cleaningId === cleaningId ? { ...item, status: nextStatus } : item,
          ),
        },
      };
    });
    setCleaningsTodoCount((prev) => Math.max(0, prev + delta));
    try {
      await cleaningsApi.update(cleaningId, { status: nextStatus });
      showToast(c('saved'), 'success');
    } catch {
      // Revert optimistic status on API failure.
      setOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          today: {
            ...prev.today,
            cleanings: prev.today.cleanings.map((item) =>
              item.cleaningId === cleaningId ? { ...item, status } : item,
            ),
          },
        };
      });
      setCleaningsTodoCount((prev) => Math.max(0, prev - delta));
      showToast(c('error'), 'error');
    }
  };

  const saveCleaningNotes = async () => {
    if (!notesModal) return;
    setSavingNotes(true);
    try {
      await cleaningsApi.update(notesModal.cleaningId, { notes: notesModal.notes || null });
      setNotesModal(null);
      await load();
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const empty = <p className="text-sm text-muted-foreground">{t('empty.none')}</p>;
  const emptyUpcoming = <p className="text-sm text-muted-foreground">{t('empty.upcoming')}</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitleToday', { date: todayLabel })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => load('refresh')}>
              <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t('actions.refresh')}
            </Button>
            <Button size="sm" variant="secondary" onClick={copyDailyReport}>
              <Copy className="mr-1 h-4 w-4" />
              {t('actions.copyDailyReport')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/${locale}/calendar`)}>
              {t('actions.openCalendar')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/${locale}/cleanings`)}>
              {t('actions.openCleanings')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/${locale}/manager/condo`)}>
              Condo admin
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-2 w-fit">
        <button
          type="button"
          onClick={() => setView('today')}
          className={`rounded-xl border px-3 py-1.5 text-sm transition ${
            view === 'today'
              ? 'border-primary/40 bg-primary text-white'
              : 'border-border/60 bg-card text-foreground hover:bg-muted/70'
          }`}
        >
          {t('views.today')}
        </button>
        <button
          type="button"
          onClick={() => setView('tomorrow')}
          className={`rounded-xl border px-3 py-1.5 text-sm transition ${
            view === 'tomorrow'
              ? 'border-primary/40 bg-primary text-white'
              : 'border-border/60 bg-card text-foreground hover:bg-muted/70'
          }`}
        >
          {t('views.tomorrow')}
        </button>
        <button
          type="button"
          onClick={() => setView('week')}
          className={`rounded-xl border px-3 py-1.5 text-sm transition ${
            view === 'week'
              ? 'border-primary/40 bg-primary text-white'
              : 'border-border/60 bg-card text-foreground hover:bg-muted/70'
          }`}
        >
          {t('views.week')}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('kpi.assigned')} value={overview?.assignedPropertiesCount ?? 0} />
        <KpiCard label={t('kpi.checkins')} value={overview?.today.checkIns.length ?? 0} />
        <KpiCard label={t('kpi.checkouts')} value={overview?.today.checkOuts.length ?? 0} />
        <KpiCard label={t('kpi.cleanings')} value={overview?.today.cleanings.length ?? 0} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array.from({ length: 4 })].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <h2 className="text-sm font-semibold text-foreground">{t('today.checkins')}</h2>
              <div className="mt-3 space-y-2">
                {overview?.today.checkIns.length
                  ? overview.today.checkIns.map((item) => (
                      <ReservationRow
                        key={item.reservationId}
                        item={item}
                        locale={locale}
                        onOpen={() => setSelectedReservation(item)}
                      />
                    ))
                  : emptyUpcoming}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <h2 className="text-sm font-semibold text-foreground">{t('today.checkouts')}</h2>
              <div className="mt-3 space-y-2">
                {overview?.today.checkOuts.length
                  ? overview.today.checkOuts.map((item) => (
                      <ReservationRow
                        key={item.reservationId}
                        item={item}
                        locale={locale}
                        onOpen={() => setSelectedReservation(item)}
                      />
                    ))
                  : empty}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <h2 className="text-sm font-semibold text-foreground">{t('today.cleanings')}</h2>
              <div className="mt-3 space-y-2">
                {overview?.today.cleanings.length ? (
                  overview.today.cleanings.map((item) => (
                    <div
                      key={item.cleaningId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.propertyName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(locale, new Date(`${item.date}T12:00:00Z`))}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status} />
                        <button
                          type="button"
                          onClick={() => toggleCleaning(item.cleaningId, item.status)}
                          className="rounded-lg border border-border/60 px-2 py-1 text-xs text-foreground hover:bg-muted/60"
                        >
                          {item.status === 'DONE' ? 'Undo' : 'Done'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotesModal({ cleaningId: item.cleaningId, notes: item.notes || '' })}
                          className="rounded-lg border border-border/60 px-2 py-1 text-xs text-foreground hover:bg-muted/60"
                        >
                          {c('notes')}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  empty
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <h2 className="text-sm font-semibold text-foreground">{t('upcoming.title')}</h2>
              <div className="mt-3 space-y-2">
                {overview?.upcoming.reservations.length
                  ? overview.upcoming.reservations.map((item) => (
                      <ReservationRow
                        key={item.reservationId}
                        item={item}
                        locale={locale}
                        onOpen={() => setSelectedReservation(item)}
                      />
                    ))
                  : empty}
              </div>
            </section>
          </div>
        </div>
      )}

      {selectedReservation ? (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{c('reservationDetails')}</h3>
            <button
              type="button"
              onClick={() => setSelectedReservation(null)}
              className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              {c('close')}
            </button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-foreground">
            <p><span className="text-muted-foreground">{c('property')}:</span> {selectedReservation.propertyName}</p>
            <p><span className="text-muted-foreground">{c('client')}:</span> {selectedReservation.guestName}</p>
            <p><span className="text-muted-foreground">{c('dates')}:</span> {reservationDateRange(selectedReservation)}</p>
            <p><span className="text-muted-foreground">{c('status')}:</span> <StatusBadge status={selectedReservation.status} className="ml-1" /></p>
          </div>
          <div className="mt-5">
            <Button size="sm" onClick={() => openReservationInCalendar(selectedReservation)}>
              {t('actions.openCalendar')}
            </Button>
          </div>
        </div>
      ) : null}

      <Modal isOpen={!!notesModal} onClose={() => setNotesModal(null)} maxWidth="md">
        <ModalHeader title={c('notes')} onClose={() => setNotesModal(null)} />
        <ModalBody>
          <textarea
            className="input min-h-[120px]"
            value={notesModal?.notes || ''}
            onChange={(event) =>
              setNotesModal((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
            }
            placeholder={c('notes')}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setNotesModal(null)}>
            {c('close')}
          </Button>
          <Button disabled={savingNotes} onClick={saveCleaningNotes}>
            {savingNotes ? '...' : tActions('save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ReservationRow({
  item,
  locale,
  onOpen,
}: {
  item: ReservationItem;
  locale: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-left transition hover:bg-muted/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.propertyName}</p>
          <p className="truncate text-xs text-muted-foreground">{item.guestName}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(locale, parseDateOnly(item.checkIn))} - {formatDate(locale, parseDateOnly(item.checkOut))}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge status={item.status} />
          {item.phone ? (
            <a
              href={`tel:${item.phone}`}
              onClick={(event) => event.stopPropagation()}
              className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-foreground hover:bg-muted/60"
            >
              Call
            </a>
          ) : null}
        </div>
      </div>
    </button>
  );
}
