'use client';

import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { format, addDays, eachDayOfInterval, isSameDay, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import { calendarApi, reservationsApi } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import MiniMonthOverview from './MiniMonthOverview';
import { getSocketBaseUrl } from '@/lib/runtime-config';

const CreateReservationModal = dynamic(() => import('./CreateReservationModal'), { ssr: false });

interface Property {
  id: string;
  name: string;
  address?: string;
  cleaningPrice?: number;
  reservations: Reservation[];
}

interface Reservation {
  id: string;
  clientName: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
  cleaningStatus?: string;
}

function getReservationStatusClass(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending') return 'pending';
  return 'confirmed';
}

const CELL_WIDTH = 30;
const ROW_HEIGHT = 34;
const VIRTUALIZE_THRESHOLD = 30;
const DAYS_VIEW = 40;
const PROPERTY_COLUMN_WIDTH = 100;

const HorizontalCalendarRow = memo(function HorizontalCalendarRow({
  property,
  dateRange,
  today,
  isEvenRow,
  readOnly,
  onCellClick,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  property: Property;
  dateRange: Date[];
  today: Date;
  isEvenRow: boolean;
  readOnly?: boolean;
  onCellClick: (propertyId: string, date: Date) => void;
  onDragStart: (e: React.DragEvent, reservation: Reservation, propertyId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, propertyId: string, date: Date) => void;
}) {
  return (
    <div
      className={`flex border-b border-gray-200 ${isEvenRow ? 'bg-white' : 'bg-gray-50/50'}`}
      style={{ height: ROW_HEIGHT }}
    >
      <div
        className={`sticky left-0 z-20 border-r border-gray-200 px-1.5 py-1 shadow-[2px_0_2px_-1px_rgba(0,0,0,0.04)] ${isEvenRow ? 'bg-white' : 'bg-gray-50/50'}`}
        style={{ width: PROPERTY_COLUMN_WIDTH, minWidth: PROPERTY_COLUMN_WIDTH }}
      >
        <div className="text-xs font-medium text-gray-900 truncate" title={property.name}>{property.name}</div>
      </div>

      <div className="flex relative" style={{ width: dateRange.length * CELL_WIDTH }}>
        {dateRange.map((date) => {
          const reservation = property.reservations.find((r) => {
            const checkIn = parseISO(r.checkIn);
            const checkOut = parseISO(r.checkOut);
            return date >= checkIn && date <= checkOut;
          });

          const isReservationStart = reservation && isSameDay(date, parseISO(reservation.checkIn));
          const isToday = isSameDay(date, today);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          if (isReservationStart) {
            const checkIn = parseISO(reservation.checkIn);
            const checkOut = parseISO(reservation.checkOut);
            const stayNights = differenceInDays(checkOut, checkIn) || 1;
            const tooltip = `${reservation.clientName} · ${stayNights} night${stayNights !== 1 ? 's' : ''} · ${reservation.totalPrice}€`;
            const statusClass = getReservationStatusClass(reservation.status);
            const reservationDays = eachDayOfInterval({ start: checkIn, end: checkOut });
            const visibleDays = reservationDays.filter((d) =>
              dateRange.some((rd) => isSameDay(rd, d))
            ).length;
            const cleaningStatus = (reservation.cleaningStatus || 'pending').toLowerCase();

            return (
              <div
                key={date.toISOString()}
                className="relative"
                style={{ width: visibleDays * CELL_WIDTH }}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, property.id, date)}
              >
                <div
                  draggable={!readOnly}
                  onDragStart={readOnly ? undefined : (e) => onDragStart(e, reservation, property.id)}
                  onDragEnd={readOnly ? undefined : (e) => ((e.target as HTMLElement).style.opacity = '1')}
                  className={`reservation-block reservation-block-compact ${statusClass} relative mx-0.5 my-0.5 flex items-center overflow-hidden ${readOnly ? '' : 'cursor-move'}`}
                  style={{ height: ROW_HEIGHT - 4, minWidth: Math.max(visibleDays * CELL_WIDTH - 4, 20) }}
                  title={tooltip}
                >
                  {(cleaningStatus === 'done' || cleaningStatus === 'in progress' || cleaningStatus === 'in_progress' || cleaningStatus === 'pending') && (
                    <span
                      className={`cleaning-badge cleaning-badge-compact ${
                        cleaningStatus === 'done' ? 'done' : cleaningStatus === 'in progress' || cleaningStatus === 'in_progress' ? 'in-progress' : 'pending'
                      }`}
                    />
                  )}
                  <span className="text-xs truncate px-1 py-0.5 block min-w-0">{reservation.clientName}</span>
                </div>
              </div>
            );
          }

          if (reservation && !isReservationStart) return null;

          return (
            <div
              key={date.toISOString()}
              className={`border-r border-gray-200 ${!readOnly ? 'cursor-pointer hover:bg-gray-50' : ''} ${isToday ? 'bg-gray-100' : ''} ${isWeekend ? 'bg-red-50/30' : ''}`}
              style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
              onClick={readOnly ? undefined : () => onCellClick(property.id, date)}
              onDragOver={readOnly ? undefined : onDragOver}
              onDrop={readOnly ? undefined : (e) => onDrop(e, property.id, date)}
            />
          );
        })}
      </div>
    </div>
  );
});

const rangeKey = (start: Date, d: number) => `${format(start, 'yyyy-MM-dd')}-${d}`;

export default function HorizontalCalendar({ readOnly = false }: { readOnly?: boolean }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const days = DAYS_VIEW;
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ propertyId: string; date: Date } | null>(null);
  const [draggedReservation, setDraggedReservation] = useState<{ id: string; propertyId: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowScrollRef = useRef<HTMLDivElement>(null);
  const prevRangeKeyRef = useRef<string | null>(null);

  const dateRange = useMemo(
    () => eachDayOfInterval({ start: startDate, end: addDays(startDate, days - 1) }),
    [startDate, days]
  );
  const today = useMemo(() => new Date(), []);

  const fetchCalendarData = useCallback(async (start: Date, d: number, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setNavigating(true);
    try {
      const response = await calendarApi.getCalendar(
        format(start, 'yyyy-MM-dd'),
        format(addDays(start, d), 'yyyy-MM-dd'),
      );
      const data = response.data as { properties: Property[] };
      setProperties(data.properties ?? []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
      setNavigating(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarData(startDate, days, true);
  }, []);

  useEffect(() => {
    const key = rangeKey(startDate, days);
    if (prevRangeKeyRef.current === null) {
      prevRangeKeyRef.current = key;
      return;
    }
    if (prevRangeKeyRef.current !== key) {
      prevRangeKeyRef.current = key;
      fetchCalendarData(startDate, days, false);
    }
  }, [startDate, days, fetchCalendarData]);

  useEffect(() => {
    const socketUrl = getSocketBaseUrl();
    if (!socketUrl) return;
    const newSocket = io(socketUrl);

    newSocket.on('reservation:created', () => fetchCalendarData(startDate, days, false));
    newSocket.on('reservation:updated', () => fetchCalendarData(startDate, days, false));
    newSocket.on('reservation:deleted', () => fetchCalendarData(startDate, days, false));

    return () => {
      newSocket.close();
    };
  }, [startDate, days, fetchCalendarData]);

  const handleCellClick = useCallback((propertyId: string, date: Date) => {
    if (readOnly) return;
    if (!draggedReservation) {
      setSelectedCell({ propertyId, date });
      setIsModalOpen(true);
    }
  }, [draggedReservation, readOnly]);

  const handleDragStart = useCallback((e: React.DragEvent, reservation: Reservation, propertyId: string) => {
    setDraggedReservation({ id: reservation.id, propertyId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', reservation.id);
    (e.target as HTMLElement).style.opacity = '0.5';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetPropertyId: string, targetDate: Date) => {
      e.preventDefault();
      if (!draggedReservation) return;

      const reservation = properties
        .flatMap((p) => p.reservations.map((r) => ({ ...r, propertyId: p.id })))
        .find((r) => r.id === draggedReservation.id);

      if (!reservation) {
        setDraggedReservation(null);
        return;
      }

      const checkIn = parseISO(reservation.checkIn);
      const checkOut = parseISO(reservation.checkOut);
      const duration = differenceInDays(checkOut, checkIn);
      const newCheckIn = startOfDay(targetDate);
      const newCheckOut = addDays(newCheckIn, duration);

      if (targetPropertyId !== reservation.propertyId) {
        alert('Moving between properties is not supported yet');
        setDraggedReservation(null);
        return;
      }

      try {
        await reservationsApi.move(
          reservation.id,
          format(newCheckIn, 'yyyy-MM-dd'),
          format(newCheckOut, 'yyyy-MM-dd')
        );
        await fetchCalendarData(startDate, days, false);
      } catch (err: unknown) {
        alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to move reservation');
      } finally {
        setDraggedReservation(null);
      }
    },
    [draggedReservation, properties, fetchCalendarData, startDate, days]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCell(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    fetchCalendarData(startDate, days, false);
  }, [fetchCalendarData, startDate, days]);

  const goToPrevWeek = useCallback(() => setStartDate((d) => addDays(d, -7)), []);
  const goToNextWeek = useCallback(() => setStartDate((d) => addDays(d, 7)), []);
  const goToToday = useCallback(() => {
    const todayDate = new Date();
    setStartDate(todayDate);
    setTimeout(() => {
      if (gridRef.current) {
        const newDateRange = eachDayOfInterval({ start: todayDate, end: addDays(todayDate, days - 1) });
        const todayIndex = newDateRange.findIndex((d) => isSameDay(d, todayDate));
        if (todayIndex !== -1) {
          gridRef.current.scrollLeft = Math.max(0, todayIndex * CELL_WIDTH - 80);
        }
      }
    }, 100);
  }, [days]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevWeek();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextWeek();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevWeek, goToNextWeek]);

  const virtualize = properties.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: properties.length,
    getScrollElement: () => rowScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
  const totalHeight = properties.length * ROW_HEIGHT;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 px-3 py-2 animate-pulse flex justify-between">
          <div className="h-5 bg-gray-100 rounded w-40" />
          <div className="h-7 bg-gray-100 rounded w-20" />
        </div>
        <div className="border-b border-gray-200 flex animate-pulse">
          <div className="shrink-0 h-8 bg-gray-50 border-r border-gray-200" style={{ width: PROPERTY_COLUMN_WIDTH }} />
          {[...Array(20)].map((_, i) => (
            <div key={i} className="h-8 shrink-0 bg-gray-50/80 border-r border-gray-200" style={{ width: CELL_WIDTH }} />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex border-b border-gray-200 animate-pulse">
            <div className="shrink-0 h-8 border-r border-gray-200 bg-gray-50/50" style={{ width: PROPERTY_COLUMN_WIDTH }} />
            {[...Array(20)].map((_, j) => (
              <div key={j} className="h-8 shrink-0 bg-gray-50/30 border-r border-gray-200" style={{ width: CELL_WIDTH }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2">
          {navigating && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-200 overflow-hidden">
              <div className="h-full w-1/3 bg-gray-500 animate-pulse rounded-full" />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevWeek}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded text-xs"
                title="Previous"
              >
                ←
              </button>
              <button
                onClick={goToNextWeek}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded text-xs"
                title="Next"
              >
                →
              </button>
              <span className="text-xs font-medium text-gray-700 min-w-[140px] text-center">
                {format(startDate, 'MMM d')} – {format(addDays(startDate, days - 1), 'MMM d')}
              </span>
              <button
                onClick={goToToday}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Today
              </button>
              <input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) setStartDate(new Date(val + 'T12:00:00'));
                }}
                className="w-28 px-1.5 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <MiniMonthOverview
                date={startDate}
                rangeStart={startDate}
                rangeEnd={addDays(startDate, days - 1)}
              />
              {!readOnly && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-black rounded-lg hover:opacity-90"
                  title="New reservation (N)"
                >
                  + New
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          ref={gridRef}
          className="overflow-auto scroll-smooth"
          style={{ maxHeight: 'calc(100vh - 260px)', scrollBehavior: 'smooth' }}
        >
          <div className="inline-block min-w-full">
            <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
              <div className="flex" style={{ paddingLeft: PROPERTY_COLUMN_WIDTH }}>
                {dateRange.map((date) => {
                  const isToday = isSameDay(date, today);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div
                      key={date.toISOString()}
                      className={`border-r border-gray-200 text-center py-0.5 ${isToday ? 'bg-gray-100' : ''}`}
                      style={{ width: CELL_WIDTH, minWidth: CELL_WIDTH }}
                    >
                      <div className={`text-[10px] font-bold leading-tight ${isToday ? 'text-gray-800' : 'text-gray-900'}`}>
                        {format(date, 'd')}
                      </div>
                      <div className={`text-[9px] leading-tight ${isWeekend ? 'text-red-500' : 'text-gray-400'}`}>
                        {format(date, 'EEE')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {virtualize ? (
              <div
                ref={rowScrollRef}
                className="overflow-y-auto overflow-x-hidden shrink-0"
                style={{ height: 'calc(100vh - 320px)', minHeight: 180 }}
              >
                <div style={{ height: totalHeight, position: 'relative', width: dateRange.length * CELL_WIDTH + PROPERTY_COLUMN_WIDTH }}>
                  {virtualItems.map((virtualRow) => {
                    const property = properties[virtualRow.index];
                    return (
                      <div
                        key={property.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <HorizontalCalendarRow
                          property={property}
                          dateRange={dateRange}
                          today={today}
                          isEvenRow={virtualRow.index % 2 === 0}
                          readOnly={readOnly}
                          onCellClick={handleCellClick}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div ref={rowScrollRef}>
                {properties.map((property, propertyIndex) => (
                  <HorizontalCalendarRow
                    key={property.id}
                    property={property}
                    dateRange={dateRange}
                    today={today}
                    isEvenRow={propertyIndex % 2 === 0}
                    readOnly={readOnly}
                    onCellClick={handleCellClick}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateReservationModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialPropertyId={selectedCell?.propertyId}
        initialCheckIn={selectedCell?.date ? format(selectedCell.date, 'yyyy-MM-dd') : undefined}
        initialCheckOut={selectedCell?.date ? format(addDays(selectedCell.date, 1), 'yyyy-MM-dd') : undefined}
      />
    </>
  );
}
