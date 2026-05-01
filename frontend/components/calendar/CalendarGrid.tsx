'use client';

import { format, isSameDay } from 'date-fns';
import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslations } from 'next-intl';
import PropertyRow from './PropertyRow';
import type { PositionedReservation } from '@/lib/calendarLayout';
import { parseDateOnly } from '@/lib/date';

type GridProperty = {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
  reservations: (PositionedReservation & {
    propertyName: string;
    propertyColor?: string | null;
    isSearchMatch?: boolean;
    isHighlighted?: boolean;
  })[];
  lanesCount: number;
};

type CalendarGridProps = {
  properties: GridProperty[];
  days: string[];
  cellWidth: number;
  rowHeight: number;
  onCreateAt: (propertyId: string, day: string) => void;
  onSelectReservation: (reservation: PositionedReservation & { propertyName: string }) => void;
  onContextCancelReservation?: (reservation: PositionedReservation & { propertyName: string }) => void;
  onSelectProperty: (property: { id: string; name: string; code?: string | null }) => void;
  scrollToDate?: string | null;
  highlightReservationId?: string | null;
  highlightPropertyId?: string | null;
  highlightDate?: string | null;
};

const BASE_ROW_HEIGHT = 48;
const LANE_HEIGHT = 22;
const STICKY_COLUMN_WIDTH = 240;

export default function CalendarGrid({
  properties,
  days,
  cellWidth,
  rowHeight,
  onCreateAt,
  onSelectReservation,
  onContextCancelReservation,
  onSelectProperty,
  scrollToDate,
  highlightReservationId,
  highlightPropertyId,
  highlightDate,
}: CalendarGridProps) {
  const c = useTranslations('common');
  const containerRef = useRef<HTMLDivElement>(null);

  const todayIndex = useMemo(() => days.findIndex((day) => isSameDay(parseDateOnly(day), new Date())), [days]);
  const rowSizes = useMemo(
    () => properties.map((property) => Math.max(BASE_ROW_HEIGHT, BASE_ROW_HEIGHT + Math.max(0, property.lanesCount - 1) * LANE_HEIGHT)),
    [properties],
  );

  const rowVirtualizer = useVirtualizer({
    count: properties.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => rowSizes[index] ?? rowHeight,
    overscan: 6,
  });

  useEffect(() => {
    if (!scrollToDate || !containerRef.current) return;
    const index = days.findIndex((day) => day === scrollToDate);
    if (index < 0) return;
    requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector<HTMLElement>(`[data-day-header="${scrollToDate}"]`);
      if (target) {
        target.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        return;
      }
      containerRef.current?.scrollTo({
        left: Math.max(0, index * cellWidth - STICKY_COLUMN_WIDTH),
        behavior: 'smooth',
      });
    });
  }, [cellWidth, days, scrollToDate]);

  useEffect(() => {
    if (!highlightReservationId || !containerRef.current) return;
    if (highlightPropertyId) {
      const rowIndex = properties.findIndex((property) => property.id === highlightPropertyId);
      if (rowIndex >= 0) {
        rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' });
      }
    }

    if (highlightDate) {
      const dayIndex = days.findIndex((day) => day === highlightDate);
      if (dayIndex >= 0) {
        requestAnimationFrame(() => {
          const target = containerRef.current?.querySelector<HTMLElement>(
            `[data-day-header="${highlightDate}"]`,
          );
          if (target) {
            target.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
            return;
          }
          containerRef.current?.scrollTo({
            left: Math.max(0, dayIndex * cellWidth - STICKY_COLUMN_WIDTH),
            behavior: 'smooth',
          });
        });
      }
    }

    const timeout = window.setTimeout(() => {
      const block = containerRef.current?.querySelector<HTMLElement>(
        `[data-reservation-id="${highlightReservationId}"]`,
      );
      block?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [
    cellWidth,
    days,
    highlightDate,
    highlightPropertyId,
    highlightReservationId,
    properties,
    rowVirtualizer,
  ]);

  return (
    <div ref={containerRef} className="overflow-auto rounded-2xl border border-border/60 bg-card" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div style={{ width: STICKY_COLUMN_WIDTH + days.length * cellWidth, minWidth: '100%' }}>
        <div className="sticky top-0 z-20 flex border-b border-border/60 bg-background">
          <div
            className="sticky left-0 z-30 flex items-center border-r border-border/60 bg-background px-3"
            style={{ width: STICKY_COLUMN_WIDTH, height: 52 }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Property</p>
          </div>

          <div className="flex">
            {days.map((day, index) => {
              const dayDate = parseDateOnly(day);
              const isToday = index === todayIndex;
              const isWeekend = dayDate.getUTCDay() === 0 || dayDate.getUTCDay() === 6;
              return (
                <div
                  key={day}
                  data-day-header={day}
                  className={`flex flex-col items-center justify-center border-r border-border/60 text-[11px] ${
                    isToday
                      ? 'border-primary/40 bg-muted/40 text-foreground'
                      : isWeekend
                        ? 'bg-muted/20 text-muted-foreground'
                        : 'text-muted-foreground'
                  }`}
                  style={{ width: cellWidth, height: 52 }}
                >
                  <span>{format(dayDate, 'EE')}</span>
                  <span className="font-semibold">{format(dayDate, 'd')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">{c('noReservations')}</div>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
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
                  <PropertyRow
                    property={property}
                    reservations={property.reservations}
                    dayCount={days.length}
                    cellWidth={cellWidth}
                    baseRowHeight={BASE_ROW_HEIGHT}
                    laneHeight={LANE_HEIGHT}
                    lanesCount={property.lanesCount}
                    stickyWidth={STICKY_COLUMN_WIDTH}
                    days={days}
                    onCreateAt={onCreateAt}
                    onSelectReservation={onSelectReservation}
                    onContextCancelReservation={onContextCancelReservation}
                    onSelectProperty={onSelectProperty}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
