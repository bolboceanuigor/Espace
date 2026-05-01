'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiClientError, calendarApi, clientsApi, exportsApi, organizationsApi, propertiesApi, reservationsApi } from '@/lib/api';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, StatusBadge, useToast } from '@/components/ui';
import { formatDate } from '@/lib/formatDate';
import { addDays, diffDays, parseDateOnly, toDateOnlyString } from '@/lib/date';
import { buildCalendarLayout, type PositionedReservation } from '@/lib/calendarLayout';
import type { CalendarProperty, CalendarReservation } from '@/lib/calendarTypes';
import { getApiErrorMessage } from '@/lib/apiError';
import CalendarGrid from './CalendarGrid';
import CalendarHeader from './CalendarHeader';
import CalendarSkeleton from './CalendarSkeleton';
import { useAuth } from '@/context/AuthContext';

const CreateReservationModal = dynamic(() => import('@/components/CreateReservationModal'), { ssr: false });

const BASE_DAYS = 40;

export default function CalendarBoard() {
  const locale = useLocale();
  const c = useTranslations('common');
  const tForm = useTranslations('form');
  const tCalendar = useTranslations('calendar');
  const tErrors = useTranslations('errors');
  const { showToast } = useToast();
  const { user, loading: authLoading, prefs, updatePreferences } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialStart = searchParams.get('start') || toDateOnlyString(new Date());
  const initialEnd = searchParams.get('end') || addDays(initialStart, BASE_DAYS);
  const initialHighlightReservationId = searchParams.get('highlightReservationId');

  const [rangeStart, setRangeStart] = useState(initialStart);
  const [rangeEnd, setRangeEnd] = useState(initialEnd); // exclusive
  const [properties, setProperties] = useState<CalendarProperty[]>([]);
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || 'all');
  const [showCancelled, setShowCancelled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return searchParams.get('showCancelled') === '1';
    const fromQuery = searchParams.get('showCancelled');
    if (fromQuery !== null) return fromQuery === '1';
    return localStorage.getItem('calendar.showCancelled') === '1';
  });
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get('propertyId') || 'all');
  const [groupFilter, setGroupFilter] = useState(searchParams.get('groupId') || 'all');
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [scrollToDate, setScrollToDate] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<
    (PositionedReservation & { propertyName: string }) | null
  >(null);
  const [selectedProperty, setSelectedProperty] = useState<CalendarProperty | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ propertyId: string; date: string } | null>(null);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    propertyId: string;
    guestName: string;
    phoneNumber: string;
    checkIn: string;
    checkOut: string;
    status: string;
    source: string;
    notes: string;
  }>({
    propertyId: '',
    guestName: '',
    phoneNumber: '',
    checkIn: '',
    checkOut: '',
    status: 'CONFIRMED',
    source: 'DIRECT',
    notes: '',
  });
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState<'sm' | 'md' | 'lg'>('md');
  const [didAutoScrollToday, setDidAutoScrollToday] = useState(false);
  const [highlightReservationId, setHighlightReservationId] = useState<string | null>(
    initialHighlightReservationId,
  );
  const [hideSensitiveData, setHideSensitiveData] = useState(false);
  const [onboardingBannerDismissed, setOnboardingBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('calendar.onboarding.dismissed') === '1';
  });

  useEffect(() => {
    const saved = localStorage.getItem('calendar.zoom');
    if (prefs?.calendarZoom && ['sm', 'md', 'lg'].includes(prefs.calendarZoom)) {
      setZoom(prefs.calendarZoom);
      return;
    }
    if (saved === 'sm' || saved === 'md' || saved === 'lg') {
      setZoom(saved);
    }
  }, [prefs?.calendarZoom]);

  useEffect(() => {
    if (prefs?.calendarStatusFilter) {
      setStatusFilter(prefs.calendarStatusFilter);
    }
    if (prefs?.calendarGroupId) {
      setGroupFilter(prefs.calendarGroupId);
    }
  }, [prefs?.calendarGroupId, prefs?.calendarStatusFilter]);

  useEffect(() => {
    const apply = () => {
      setHideSensitiveData(localStorage.getItem('privacy.hideSensitiveData') === 'true');
    };
    apply();
    window.addEventListener('privacy-mode-change', apply);
    return () => window.removeEventListener('privacy-mode-change', apply);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 280);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const highlight = searchParams.get('highlightReservationId');
    setHighlightReservationId(highlight);
    if (!highlight) return;
    const timeout = window.setTimeout(() => setHighlightReservationId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  useEffect(() => {
    organizationsApi
      .getMe()
      .then((res) => {
        const nextWeekStart = (res.data?.weekStart || 'MONDAY') as 'MONDAY' | 'SUNDAY';
        const today = toDateOnlyString(new Date());
        const startDate = parseDateOnly(today);
        const day = startDate.getUTCDay();
        const offset = nextWeekStart === 'SUNDAY' ? day : (day + 6) % 7;
        const aligned = addDays(today, -offset);
        setRangeStart(aligned);
        setRangeEnd(addDays(aligned, BASE_DAYS));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Optional UX prefetch while the user is on calendar.
    Promise.allSettled([propertiesApi.getAll(), propertiesApi.getGroups(), clientsApi.getAll()])
      .then((res) => {
        const groupsResult = res[1];
        if (groupsResult.status === 'fulfilled') {
          setGroups(groupsResult.value.data ?? []);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedReservation) setSelectedReservation(null);
      if (selectedProperty) setSelectedProperty(null);
      if (selectedCell) setSelectedCell(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReservation, selectedProperty, selectedCell]);

  const cellWidth = zoom === 'sm' ? 28 : zoom === 'lg' ? 42 : 34;
  const rowHeight = zoom === 'sm' ? 42 : zoom === 'lg' ? 56 : 48;

  const days = useMemo(() => {
    const count = Math.max(1, diffDays(rangeStart, rangeEnd));
    return Array.from({ length: count }, (_, index) => addDays(rangeStart, index));
  }, [rangeEnd, rangeStart]);

  const fetchCalendar = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await calendarApi.getCalendar(
        rangeStart,
        rangeEnd,
        {
          status: statusFilter,
          source: sourceFilter,
          propertyId: propertyFilter,
          groupId: groupFilter,
        },
      );
      setProperties(response.data?.properties ?? []);
      setReservations(response.data?.reservations ?? []);
    } catch (error) {
      console.error('Calendar fetch failed', error);
      setProperties([]);
      setReservations([]);
      setError(c('calendarLoadError'));
    } finally {
      setLoading(false);
    }
  }, [authLoading, c, groupFilter, propertyFilter, rangeEnd, rangeStart, sourceFilter, statusFilter, user]);

  useEffect(() => {
    if (authLoading) return;
    fetchCalendar();
  }, [authLoading, fetchCalendar]);

  useEffect(() => {
    localStorage.setItem('calendar.showCancelled', showCancelled ? '1' : '0');
  }, [showCancelled]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start', rangeStart);
    params.set('end', rangeEnd);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    else params.delete('status');
    if (sourceFilter && sourceFilter !== 'all') params.set('source', sourceFilter);
    else params.delete('source');
    if (showCancelled) params.set('showCancelled', '1');
    else params.delete('showCancelled');
    if (propertyFilter && propertyFilter !== 'all') params.set('propertyId', propertyFilter);
    else params.delete('propertyId');
    if (groupFilter && groupFilter !== 'all') params.set('groupId', groupFilter);
    else params.delete('groupId');
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}`);
    }
  }, [groupFilter, pathname, propertyFilter, rangeEnd, rangeStart, router, searchParams, showCancelled, sourceFilter, statusFilter]);

  useEffect(() => {
    if (didAutoScrollToday || loading || days.length === 0) return;
    const today = toDateOnlyString(new Date());
    requestAnimationFrame(() => {
      setScrollToDate(today);
      setDidAutoScrollToday(true);
    });
  }, [days.length, didAutoScrollToday, loading]);

  const rows = useMemo(() => {
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const hasSearch = debouncedSearch.length > 0;
    const filteredReservations = reservations.filter((reservation) => {
      const normalizedStatus = reservation.status.toLowerCase();
      if (!showCancelled && normalizedStatus === 'cancelled') return false;
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      const normalizedSource = (reservation.source || '').toUpperCase();
      if (sourceFilter !== 'all' && normalizedSource !== sourceFilter) return false;
      if (propertyFilter !== 'all' && reservation.propertyId !== propertyFilter) return false;
      if (hasSearch) {
        const property = propertyById.get(reservation.propertyId);
        const propertyName = (property?.name || '').toLowerCase();
        const guest = (reservation.guestName || '').toLowerCase();
        if (!guest.includes(debouncedSearch) && !propertyName.includes(debouncedSearch)) {
          return false;
        }
      }
      return true;
    });

    const layout = buildCalendarLayout({
      rangeStart,
      rangeEnd,
      reservations: filteredReservations,
      cellWidth,
    });

    return properties
      .filter((property) => propertyFilter === 'all' || property.id === propertyFilter)
      .map((property) => {
        const propertyMatchesSearch =
          hasSearch &&
          (property.name.toLowerCase().includes(debouncedSearch) ||
            (property.code || '').toLowerCase().includes(debouncedSearch));
        const reservationBlocks = (layout.reservationsByProperty[property.id] || []).map((item) => ({
          ...item,
          propertyName: property.name,
        }));
        const visibleBlocks = hasSearch
          ? reservationBlocks.filter(
              (block) =>
                propertyMatchesSearch ||
                block.guestName.toLowerCase().includes(debouncedSearch) ||
                property.name.toLowerCase().includes(debouncedSearch),
            )
          : reservationBlocks;
        return {
          id: property.id,
          name: property.name,
          code: property.code,
          color: property.color || 'gray',
          reservations: visibleBlocks.map((block) => ({
            ...block,
            guestName: hideSensitiveData ? 'Guest' : block.guestName,
            propertyColor: property.color || 'gray',
            isSearchMatch:
              !!debouncedSearch &&
              block.guestName.toLowerCase().includes(debouncedSearch),
            isHighlighted: highlightReservationId === block.id,
          })),
          lanesCount: layout.maxLanesPerProperty[property.id] ?? 1,
          propertyMatchesSearch,
        };
      })
      .filter((row) =>
        hasSearch ? row.propertyMatchesSearch || row.reservations.length > 0 : true,
      ) as Array<{
      id: string;
      name: string;
      code?: string | null;
      color?: string | null;
      reservations: (PositionedReservation & {
        propertyName: string;
        propertyColor?: string | null;
        isSearchMatch?: boolean;
      })[];
      lanesCount: number;
      propertyMatchesSearch?: boolean;
    }>;
  }, [
    cellWidth,
    debouncedSearch,
    properties,
    propertyFilter,
    rangeEnd,
    rangeStart,
    reservations,
    hideSensitiveData,
    sourceFilter,
    statusFilter,
    showCancelled,
    highlightReservationId,
  ]);

  const highlightedReservation = useMemo(
    () => reservations.find((item) => item.id === highlightReservationId) ?? null,
    [highlightReservationId, reservations],
  );

  const emptyStateType = useMemo(() => {
    if (properties.length === 0) {
      if ((user?.role || '').toUpperCase() === 'MANAGER') {
        return 'manager-no-assigned';
      }
      return 'no-properties';
    }
    if (rows.length > 0 && rows.every((row) => row.reservations.length === 0)) {
      return 'no-reservations';
    }
    return null;
  }, [properties.length, rows, user?.role]);

  const canEditReservation =
    (user?.role || '').toUpperCase() === 'ADMIN' ||
    (user?.role || '').toUpperCase() === 'SUPERADMIN' ||
    (user?.role || '').toUpperCase() === 'MANAGER';

  const cancelReservation = useCallback(
    async (reservationId: string) => {
      await reservationsApi.update(reservationId, { status: 'CANCELLED' });
      await fetchCalendar();
      showToast(c('saved'), 'success');
    },
    [c, fetchCalendar, showToast],
  );

  const downloadCsv = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <CalendarHeader
        startDate={rangeStart}
        endDate={rangeEnd}
        search={search}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        showCancelled={showCancelled}
        propertyFilter={propertyFilter}
        groupFilter={groupFilter}
        properties={properties.map((property) => ({ id: property.id, name: property.name }))}
        groups={groups}
        onSearchChange={setSearch}
        onStatusFilterChange={(next) => {
          setStatusFilter(next);
          updatePreferences({ calendarStatusFilter: next }).catch(() => undefined);
        }}
        onSourceFilterChange={setSourceFilter}
        onShowCancelledChange={setShowCancelled}
        onPropertyFilterChange={setPropertyFilter}
        onGroupFilterChange={(next) => {
          setGroupFilter(next);
          updatePreferences({ calendarGroupId: next === 'all' ? '' : next }).catch(() => undefined);
        }}
        onStartDateChange={(value) => {
          if (!value) return;
          setRangeStart(value);
          if (value >= rangeEnd) {
            setRangeEnd(addDays(value, BASE_DAYS));
          }
        }}
        onEndDateChange={(value) => {
          if (!value) return;
          const nextExclusive = addDays(value, 1);
          if (nextExclusive <= rangeStart) {
            setRangeEnd(addDays(rangeStart, 1));
            return;
          }
          setRangeEnd(nextExclusive);
        }}
        onToday={() => {
          const today = toDateOnlyString(new Date());
          setRangeStart(today);
          setRangeEnd(addDays(today, BASE_DAYS));
          setScrollToDate(today);
        }}
        onPrev={() => {
          setRangeStart((current) => addDays(current, -14));
          setRangeEnd((current) => addDays(current, -14));
        }}
        onNext={() => {
          setRangeStart((current) => addDays(current, 14));
          setRangeEnd((current) => addDays(current, 14));
        }}
        zoom={zoom}
        onZoomChange={(nextZoom) => {
          setZoom(nextZoom);
          localStorage.setItem('calendar.zoom', nextZoom);
          updatePreferences({ calendarZoom: nextZoom }).catch(() => undefined);
        }}
        onCopyLink={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            showToast(c('copied'), 'success');
          } catch {
            showToast(c('error'), 'error');
          }
        }}
        onExportCsv={async () => {
          try {
            const res = await exportsApi.exportReservations(rangeStart, rangeEnd);
            downloadCsv(res.data, `reservations-${rangeStart}-${rangeEnd}.csv`);
            showToast(c('saved'), 'success');
          } catch (err: unknown) {
            showToast(getApiErrorMessage(err, tErrors, c('error')), 'error');
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {c('calendarMicrocopy')}
      </p>

      {!onboardingBannerDismissed &&
      properties.length === 0 &&
      ((user?.role || '').toUpperCase() === 'ADMIN' || (user?.role || '').toUpperCase() === 'SUPERADMIN') ? (
        <div className="rounded-xl border border-border/60 bg-card p-3 text-sm">
          <p className="text-foreground">{c('calendarNoProperties')}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                router.push(
                  `${pathname.includes('/calendar') ? pathname.replace('/calendar', '/properties') : '/properties'}`,
                )
              }
            >
              {c('goToApartments')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setOnboardingBannerDismissed(true);
                localStorage.setItem('calendar.onboarding.dismissed', '1');
              }}
            >
              {c('close')}
            </Button>
          </div>
        </div>
      ) : null}

      {authLoading || loading ? (
        <CalendarSkeleton />
      ) : error ? (
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm leading-5 text-foreground">
          {error}
        </div>
      ) : emptyStateType ? (
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm leading-5 text-foreground">
          <p>
            {emptyStateType === 'manager-no-assigned'
              ? c('calendarNoAssignedProperties')
              : emptyStateType === 'no-properties'
                ? c('calendarNoProperties')
                : c('noReservations')}
          </p>
          {emptyStateType === 'no-properties' && (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') ? (
            <div className="mt-3">
              <Button
                onClick={() =>
                  router.push(
                    `${pathname.includes('/calendar') ? pathname.replace('/calendar', '/properties') : '/properties'}`,
                  )
                }
              >
                {c('goToApartments')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <CalendarGrid
          properties={rows}
          days={days}
          cellWidth={cellWidth}
          rowHeight={rowHeight}
          onCreateAt={(propertyId, day) => setSelectedCell({ propertyId, date: day })}
          onSelectReservation={(reservation) => setSelectedReservation(reservation)}
          onContextCancelReservation={async (reservation) => {
            if (reservation.status === 'CANCELLED') return;
            if (!confirm(tCalendar('cancelReservation'))) return;
            try {
              await cancelReservation(reservation.id);
            } catch (err: unknown) {
              showToast(getApiErrorMessage(err, tErrors, c('error')), 'error');
            }
          }}
          onSelectProperty={(property) => setSelectedProperty(property)}
          scrollToDate={scrollToDate}
          highlightReservationId={highlightReservationId}
          highlightPropertyId={highlightedReservation?.propertyId || null}
          highlightDate={highlightedReservation?.startDate || null}
        />
      )}

      <CreateReservationModal
        isOpen={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        onSuccess={() => {
          setSelectedCell(null);
          fetchCalendar();
        }}
        initialPropertyId={selectedCell?.propertyId}
        initialCheckIn={selectedCell?.date}
        initialCheckOut={selectedCell?.date ? addDays(selectedCell.date, 1) : undefined}
      />

      {selectedReservation ? (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{c('reservationDetails')}</h3>
            <button type="button" onClick={() => setSelectedReservation(null)} className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition duration-150 ease-out hover:bg-muted/60 hover:text-foreground">
              {c('close')}
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-5 text-foreground">
            <p><span className="text-muted-foreground">{c('client')}:</span> {selectedReservation.guestName}</p>
            <p><span className="text-muted-foreground">{c('property')}:</span> {selectedReservation.propertyName}</p>
            <p><span className="text-muted-foreground">{c('status')}:</span> <StatusBadge status={selectedReservation.status} className="ml-1" /></p>
            <p><span className="text-muted-foreground">{c('source')}:</span> {selectedReservation.source || 'DIRECT'}</p>
            <p><span className="text-muted-foreground">{c('dates')}:</span> {formatDate(locale, parseDateOnly(selectedReservation.startDate))} - {formatDate(locale, parseDateOnly(selectedReservation.endDate))}</p>
            {selectedReservation.channel ? (
              <p>
                <span className="text-muted-foreground">{c('syncedFrom')}:</span>{' '}
                {selectedReservation.channel}
                {selectedReservation.lastSyncAt
                  ? ` (${formatDate(locale, new Date(selectedReservation.lastSyncAt))})`
                  : ''}
              </p>
            ) : null}
            {selectedReservation.syncConflict ? (
              <span className="inline-flex items-center rounded-lg border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
                {c('conflict')}
              </span>
            ) : null}
            {selectedReservation.notes ? <p><span className="text-muted-foreground">{c('notes')}:</span> {selectedReservation.notes}</p> : null}
          </div>
          <div className="mt-6 flex gap-2">
            {canEditReservation ? (
              <button
                type="button"
                className="rounded-xl border border-border/60 px-3 py-2 text-xs text-foreground transition duration-150 ease-out hover:bg-muted/60"
                onClick={() => {
                  setEditReservationId(selectedReservation.id);
                  setEditError('');
                  setEditForm({
                    propertyId: selectedReservation.propertyId,
                    guestName: selectedReservation.guestName,
                    phoneNumber: '',
                    checkIn: selectedReservation.startDate,
                    checkOut: selectedReservation.endDate,
                    status: selectedReservation.status,
                    source: selectedReservation.source || 'DIRECT',
                    notes: selectedReservation.notes || '',
                  });
                }}
              >
                {tCalendar('editReservation')}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-xl border border-border/60 px-3 py-2 text-xs text-foreground transition duration-150 ease-out hover:bg-muted/60"
              onClick={async () => {
                if (!confirm(tCalendar('cancelReservation'))) return;
                try {
                  await cancelReservation(selectedReservation.id);
                  setSelectedReservation(null);
                } catch (err: unknown) {
                  showToast(getApiErrorMessage(err, tErrors, c('error')), 'error');
                }
              }}
            >
              {tCalendar('cancelReservation')}
            </button>
          </div>
        </div>
      ) : null}

      <Modal isOpen={!!editReservationId} onClose={() => setEditReservationId(null)} maxWidth="lg">
        <ModalHeader title={tCalendar('editReservation')} onClose={() => setEditReservationId(null)} />
        <ModalBody className="space-y-3">
          {editError ? (
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-foreground">
              {editError}
            </div>
          ) : null}
          <select
            className="select"
            value={editForm.propertyId}
            onChange={(event) => setEditForm((prev) => ({ ...prev, propertyId: event.target.value }))}
          >
            <option value="">{tForm('property')}</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder={tForm('guestName')}
            value={editForm.guestName}
            onChange={(event) => setEditForm((prev) => ({ ...prev, guestName: event.target.value }))}
          />
          <input
            className="input"
            placeholder={tForm('phone')}
            value={editForm.phoneNumber}
            onChange={(event) => setEditForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{tForm('startDate')}</label>
              <input
                className="input"
                type="date"
                value={editForm.checkIn}
                onChange={(event) => setEditForm((prev) => ({ ...prev, checkIn: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">{tForm('endDateCheckout')}</label>
              <input
                className="input"
                type="date"
                value={editForm.checkOut}
                onChange={(event) => setEditForm((prev) => ({ ...prev, checkOut: event.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">{tCalendar('endDateHelp')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="select"
              value={editForm.status}
              onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
            <select
              className="select"
              value={editForm.source}
              onChange={(event) => setEditForm((prev) => ({ ...prev, source: event.target.value }))}
            >
              <option value="DIRECT">DIRECT</option>
              <option value="AIRBNB">AIRBNB</option>
              <option value="BOOKING">BOOKING</option>
            </select>
          </div>
          <textarea
            className="input min-h-[90px]"
            placeholder={tForm('notes')}
            value={editForm.notes}
            onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setEditReservationId(null)}>
            {c('close')}
          </Button>
          <Button
            onClick={async () => {
              if (!editReservationId) return;
              setEditError('');
              if (!editForm.propertyId || !editForm.guestName.trim() || !editForm.checkIn || !editForm.checkOut) {
                setEditError(tErrors('required'));
                return;
              }
              if (editForm.checkIn >= editForm.checkOut) {
                setEditError(tErrors('invalidDate'));
                return;
              }
              setEditing(true);
              try {
                await reservationsApi.update(editReservationId, {
                  propertyId: editForm.propertyId,
                  guestName: editForm.guestName.trim(),
                  phoneNumber: editForm.phoneNumber.trim() || null,
                  checkIn: editForm.checkIn,
                  checkOut: editForm.checkOut,
                  status: editForm.status,
                  source: editForm.source,
                  notes: editForm.notes.trim() || null,
                });
                setEditReservationId(null);
                setSelectedReservation(null);
                await fetchCalendar();
                showToast(c('saved'), 'success');
              } catch (err: unknown) {
                const message =
                  err instanceof ApiClientError && err.status === 409
                    ? tErrors('overlap')
                    : getApiErrorMessage(err, tErrors, c('error'));
                setEditError(message);
                showToast(message, 'error');
              } finally {
                setEditing(false);
              }
            }}
            disabled={editing}
          >
            {editing ? '...' : tForm('save')}
          </Button>
        </ModalFooter>
      </Modal>

      {selectedProperty ? (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{c('property')}</h3>
            <button
              type="button"
              onClick={() => setSelectedProperty(null)}
              className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition duration-150 ease-out hover:bg-muted/60 hover:text-foreground"
            >
              {c('close')}
            </button>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-foreground">{selectedProperty.name}</p>
            <p className="text-muted-foreground">{selectedProperty.code || 'No code'}</p>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push(`${pathname.includes('/calendar') ? pathname.replace('/calendar', '/properties') : '/properties'}`)}
              className="rounded-xl border border-border/60 px-3 py-2 text-sm text-foreground transition duration-150 ease-out hover:bg-muted/60"
            >
              Open apartments
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
