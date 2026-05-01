'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  isWeekend,
  max,
  min,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import dynamic from 'next/dynamic';
import { io } from 'socket.io-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { calendarApi } from '@/lib/api';
import MiniMonthOverview from './MiniMonthOverview';

const CreateReservationModal = dynamic(() => import('./CreateReservationModal'), { ssr: false });

interface Reservation {
  id: string;
  guestName?: string;
  clientName?: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
}

interface Property {
  id: string;
  name: string;
  address?: string;
  reservations?: Reservation[];
}

type ReservationBar = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  totalPrice: number;
  status: string;
  propertyName: string;
  statusClass: string;
  left: number;
  width: number;
};

const PROPERTY_COLUMN_WIDTH = 260;
const CELL_WIDTH = 56;
const ROW_HEIGHT = 62;
const DEFAULT_DAYS_VISIBLE = 40;

function getStatusClass(status: string): string {
  const value = (status || '').toLowerCase();
  if (value === 'cancelled') return 'bg-red-100 text-red-700 border-red-200';
  if (value === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function buildReservationBars(
  reservations: Reservation[] | undefined,
  viewStart: Date,
  viewEnd: Date,
  propertyName: string,
  statusFilter: string,
): ReservationBar[] {
  if (!reservations?.length) return [];

  const viewEndExclusive = addDays(endOfDay(viewEnd), 1);
  const bars: ReservationBar[] = [];

  for (const reservation of reservations) {
    const status = (reservation.status || '').toLowerCase();
    if (statusFilter !== 'all' && status !== statusFilter) {
      continue;
    }

    const startDate = parseISO(reservation.checkIn);
    const endDate = parseISO(reservation.checkOut);
    const overlapStart = max([startDate, viewStart]);
    const overlapEndExclusive = min([endDate, viewEndExclusive]);

    const spanDays = differenceInCalendarDays(overlapEndExclusive, overlapStart);
    if (spanDays <= 0) continue;

    const startOffsetDays = differenceInCalendarDays(overlapStart, viewStart);
    bars.push({
      id: reservation.id,
      label: reservation.guestName || reservation.clientName || 'Guest',
      start: startDate,
      end: endDate,
      totalPrice: reservation.totalPrice,
      status: reservation.status,
      propertyName,
      statusClass: getStatusClass(reservation.status),
      left: startOffsetDays * CELL_WIDTH,
      width: spanDays * CELL_WIDTH,
    });
  }

  return bars;
}

const CalendarPropertyRow = memo(function CalendarPropertyRow({
  property,
  bars,
  days,
  isEven,
  onCreateReservationAt,
  onSelectReservation,
}: {
  property: Property;
  bars: ReservationBar[];
  days: Date[];
  isEven: boolean;
  onCreateReservationAt: (propertyId: string, date: Date) => void;
  onSelectReservation: (reservation: ReservationBar) => void;
}) {
  const onTimelineClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('[data-reservation-bar]')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const dayIndex = Math.max(0, Math.min(days.length - 1, Math.floor(offsetX / CELL_WIDTH)));
      onCreateReservationAt(property.id, days[dayIndex]);
    },
    [days, onCreateReservationAt, property.id],
  );

  return (
    <div className={`flex border-b border-gray-200 ${isEven ? 'bg-white' : 'bg-gray-50/40'}`} style={{ height: ROW_HEIGHT }}>
      <div
        className={`sticky left-0 z-20 flex shrink-0 items-center border-r border-gray-200 px-4 ${
          isEven ? 'bg-white' : 'bg-gray-50/40'
        }`}
        style={{ width: PROPERTY_COLUMN_WIDTH }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800">{property.name}</p>
          <p className="truncate text-xs text-gray-500">{property.address || 'No address'}</p>
        </div>
      </div>

      <div
        className="relative cursor-pointer"
        onClick={onTimelineClick}
        style={{
          width: days.length * CELL_WIDTH,
          backgroundImage:
            `repeating-linear-gradient(to right, transparent 0, transparent calc(${CELL_WIDTH}px - 1px), rgba(229,231,235,0.8) calc(${CELL_WIDTH}px - 1px), rgba(229,231,235,0.8) ${CELL_WIDTH}px)`,
        }}
      >
        {days.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const weekend = isWeekend(day);
          if (!isToday && !weekend) return null;
          return (
            <div
              key={`${property.id}-${day.toISOString()}`}
              className={isToday ? 'absolute inset-y-0 bg-blue-50/80' : 'absolute inset-y-0 bg-red-50/40'}
              style={{ left: idx * CELL_WIDTH, width: CELL_WIDTH }}
            />
          );
        })}

        {bars.map((bar) => (
          <div
            key={bar.id}
            data-reservation-bar
            onClick={(event) => {
              event.stopPropagation();
              onSelectReservation(bar);
            }}
            className={`group absolute top-2.5 flex h-9 items-center rounded-xl border px-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${bar.statusClass}`}
            style={{ left: bar.left + 4, width: Math.max(28, bar.width - 8) }}
          >
            <p className="truncate text-[11px] font-semibold">{bar.label}</p>
            <div className="pointer-events-none absolute -top-24 left-0 hidden w-56 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-xl group-hover:block">
              <p className="font-semibold text-gray-900">{bar.label}</p>
              <p className="mt-1">
                {format(bar.start, 'dd MMM yyyy')} - {format(bar.end, 'dd MMM yyyy')}
              </p>
              <p className="mt-1 font-medium">{bar.totalPrice} EUR</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function CalendarView() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysVisible, setDaysVisible] = useState(DEFAULT_DAYS_VISIBLE);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ propertyId: string; date: Date } | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<ReservationBar | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const viewStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const viewEnd = useMemo(() => addDays(viewStart, daysVisible - 1), [viewStart, daysVisible]);
  const days = useMemo(() => Array.from({ length: daysVisible }, (_, idx) => addDays(viewStart, idx)), [viewStart, daysVisible]);

  const barsByProperty = useMemo(() => {
    const map = new Map<string, ReservationBar[]>();
    for (const property of properties) {
      map.set(
        property.id,
        buildReservationBars(property.reservations, viewStart, days[days.length - 1], property.name, statusFilter),
      );
    }
    return map;
  }, [days, properties, statusFilter, viewStart]);

  const filteredProperties = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return properties.filter((property) => {
      if (propertyFilter !== 'all' && property.id !== propertyFilter) {
        return false;
      }

      const bars = barsByProperty.get(property.id) ?? [];
      if (!query) {
        return bars.length > 0 || propertyFilter === 'all' || property.id === propertyFilter;
      }

      const propertyMatch = property.name.toLowerCase().includes(query) || (property.address || '').toLowerCase().includes(query);
      const reservationMatch = bars.some((bar) => bar.label.toLowerCase().includes(query));
      return propertyMatch || reservationMatch;
    });
  }, [barsByProperty, properties, propertyFilter, searchTerm]);

  const fetchData = useCallback(async (startDate: Date, initial: boolean) => {
    if (initial) setLoading(true);
    else setNavigating(true);

    try {
      const endDate = addDays(startDate, daysVisible);
      const response = await calendarApi.getCalendar(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
      );
      setProperties(response.data?.properties ?? []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
      setNavigating(false);
    }
  }, [daysVisible]);

  useEffect(() => {
    fetchData(viewStart, true);
  }, [fetchData, viewStart]);

  const currentStartRef = useRef<Date>(viewStart);
  useEffect(() => {
    currentStartRef.current = viewStart;
  }, [viewStart]);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!socketUrl) return;
    const socket = io(socketUrl);

    const refresh = () => {
      fetchData(currentStartRef.current, false);
    };

    socket.on('reservation:created', refresh);
    socket.on('reservation:updated', refresh);
    socket.on('reservation:deleted', refresh);

    return () => {
      socket.off('reservation:created', refresh);
      socket.off('reservation:updated', refresh);
      socket.off('reservation:deleted', refresh);
      socket.close();
    };
  }, [fetchData]);

  const rowVirtualizer = useVirtualizer({
    count: filteredProperties.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    paddingStart: 0,
  });

  const onCreateReservationAt = useCallback((propertyId: string, date: Date) => {
    setSelectedCell({ propertyId, date });
    setIsModalOpen(true);
  }, []);

  const onSelectReservation = useCallback((reservation: ReservationBar) => {
    setSelectedReservation(reservation);
  }, []);

  const onCloseModal = useCallback(() => {
    setSelectedCell(null);
    setIsModalOpen(false);
  }, []);

  const onCreateSuccess = useCallback(() => {
    fetchData(viewStart, false);
  }, [fetchData, viewStart]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-80 animate-pulse rounded-xl bg-gray-50" />
      </div>
    );
  }

  const gridWidth = PROPERTY_COLUMN_WIDTH + days.length * CELL_WIDTH;

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate((date) => subWeeks(date, 1))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentDate((date) => addWeeks(date, 1))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Today
              </button>
              <h2 className="ml-2 text-sm font-semibold text-gray-800">
                {format(viewStart, 'dd MMM yyyy')} - {format(viewEnd, 'dd MMM yyyy')}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={format(viewStart, 'yyyy-MM-dd')}
                onChange={(event) => setCurrentDate(new Date(`${event.target.value}T12:00:00`))}
                className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700"
              />
              <input
                type="number"
                min={14}
                max={90}
                value={daysVisible}
                onChange={(event) => setDaysVisible(Math.max(14, Math.min(90, Number(event.target.value) || DEFAULT_DAYS_VISIBLE)))}
                className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700"
                title="Visible days"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search client/property"
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700"
              >
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={propertyFilter}
                onChange={(event) => setPropertyFilter(event.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700"
              >
                <option value="all">All properties</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
              <MiniMonthOverview date={currentDate} rangeStart={viewStart} rangeEnd={viewEnd} />
              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                + New Reservation
              </button>
            </div>
          </div>
        </div>

        {navigating ? <div className="h-0.5 w-full animate-pulse bg-blue-500" /> : null}

        <div
          ref={scrollRef}
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 330px)' }}
        >
          <div style={{ width: gridWidth, minWidth: '100%' }}>
            <div className="sticky top-0 z-30 flex border-b border-gray-200 bg-white">
              <div
                className="sticky left-0 z-40 flex shrink-0 items-center border-r border-gray-200 bg-white px-4 py-3"
                style={{ width: PROPERTY_COLUMN_WIDTH }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Property</p>
              </div>
              <div className="flex">
                {days.map((day) => {
                  const today = isSameDay(day, new Date());
                  const weekend = isWeekend(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex h-14 flex-col items-center justify-center border-r border-gray-200 text-xs ${
                        today ? 'bg-blue-50 text-blue-700' : weekend ? 'bg-red-50/40 text-red-600' : 'text-gray-600'
                      }`}
                      style={{ width: CELL_WIDTH }}
                    >
                      <span>{format(day, 'EEE')}</span>
                      <span className="mt-0.5 text-base font-semibold">{format(day, 'd')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const property = filteredProperties[virtualItem.index];
                return (
                  <div
                    key={property.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: `translateY(${virtualItem.start}px)`,
                      width: '100%',
                    }}
                  >
                    <CalendarPropertyRow
                      property={property}
                      bars={barsByProperty.get(property.id) ?? []}
                      days={days}
                      isEven={virtualItem.index % 2 === 0}
                      onCreateReservationAt={onCreateReservationAt}
                      onSelectReservation={onSelectReservation}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <CreateReservationModal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        onSuccess={onCreateSuccess}
        initialPropertyId={selectedCell?.propertyId}
        initialCheckIn={selectedCell?.date ? format(selectedCell.date, 'yyyy-MM-dd') : undefined}
        initialCheckOut={selectedCell?.date ? format(addDays(selectedCell.date, 1), 'yyyy-MM-dd') : undefined}
      />

      {selectedReservation ? (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-gray-200 bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Reservation details</h3>
            <button
              type="button"
              onClick={() => setSelectedReservation(null)}
              className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
          <div className="mt-5 space-y-3 text-sm text-gray-700">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
              <p className="mt-1 font-medium text-gray-900">{selectedReservation.label}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Property</p>
              <p className="mt-1 font-medium text-gray-900">{selectedReservation.propertyName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Dates</p>
              <p className="mt-1">
                {format(selectedReservation.start, 'dd MMM yyyy')} - {format(selectedReservation.end, 'dd MMM yyyy')}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
              <p className="mt-1 capitalize">{selectedReservation.status.toLowerCase()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
              <p className="mt-1 font-semibold text-gray-900">{selectedReservation.totalPrice} EUR</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
