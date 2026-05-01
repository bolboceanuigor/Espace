'use client';

import { memo } from 'react';
import ReservationBlock from './ReservationBlock';
import type { PositionedReservation } from '@/lib/calendarLayout';
import { isToday, isWeekend } from '@/lib/date';

type PropertyRowProps = {
  property: {
    id: string;
    name: string;
    code?: string | null;
    color?: string | null;
  };
  reservations: (PositionedReservation & {
    propertyName: string;
    propertyColor?: string | null;
    isSearchMatch?: boolean;
    isHighlighted?: boolean;
  })[];
  dayCount: number;
  cellWidth: number;
  baseRowHeight: number;
  laneHeight: number;
  lanesCount: number;
  stickyWidth: number;
  days: string[];
  onCreateAt: (propertyId: string, day: string) => void;
  onSelectReservation: (reservation: PositionedReservation & { propertyName: string }) => void;
  onContextCancelReservation?: (reservation: PositionedReservation & { propertyName: string }) => void;
  onSelectProperty: (property: { id: string; name: string; code?: string | null }) => void;
};

function PropertyRow({
  property,
  reservations,
  dayCount,
  cellWidth,
  baseRowHeight,
  laneHeight,
  lanesCount,
  stickyWidth,
  days,
  onCreateAt,
  onSelectReservation,
  onContextCancelReservation,
  onSelectProperty,
}: PropertyRowProps) {
  const rowHeight = baseRowHeight + Math.max(0, lanesCount - 1) * laneHeight;

  return (
    <div className="flex border-b border-border/60 bg-card">
      <div
        className="sticky left-0 z-10 flex items-center border-r border-border/60 bg-background px-3"
        style={{ width: stickyWidth, height: rowHeight }}
      >
        <span
          className="mr-2 h-8 w-1.5 rounded-full"
          style={{ backgroundColor: mapPropertyColor(property.color || 'gray') }}
        />
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onSelectProperty(property)}
            className="truncate text-left text-sm font-medium text-foreground underline-offset-2 transition hover:underline"
          >
            {property.name}
          </button>
          <p className="truncate text-[11px] text-muted-foreground">{property.code || 'No code'}</p>
        </div>
      </div>

      <div
        className="relative cursor-pointer"
        style={{
          width: dayCount * cellWidth,
          height: rowHeight,
          backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${cellWidth}px - 1px), hsl(var(--border) / 0.6) calc(${cellWidth}px - 1px), hsl(var(--border) / 0.6) ${cellWidth}px)`,
        }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('[data-reservation-block]')) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left;
          const dayIndex = Math.max(0, Math.min(dayCount - 1, Math.floor(x / cellWidth)));
          onCreateAt(property.id, days[dayIndex]);
        }}
      >
        {days.map((day, index) =>
          isWeekend(day) ? (
            <div key={`${property.id}-weekend-${index}`} className="pointer-events-none absolute inset-y-0 bg-muted/20" style={{ left: index * cellWidth, width: cellWidth }} />
          ) : null,
        )}
        {days.map((day, index) =>
          isToday(day) ? (
            <div key={`${property.id}-today-${index}`} className="pointer-events-none absolute inset-y-0 border-x border-primary/40 bg-muted/40" style={{ left: index * cellWidth, width: cellWidth }} />
          ) : null,
        )}

        {reservations.map((reservation) => (
          <div key={reservation.id} data-reservation-block>
            <ReservationBlock
              reservation={reservation}
              propertyColor={property.color || 'gray'}
              onSelect={onSelectReservation}
              onContextCancel={onContextCancelReservation}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PropertyRow);

function mapPropertyColor(color: string): string {
  switch (color) {
    case 'blue':
      return '#3b82f6';
    case 'teal':
      return '#14b8a6';
    case 'violet':
      return '#8b5cf6';
    case 'rose':
      return '#f43f5e';
    case 'amber':
      return '#f59e0b';
    case 'emerald':
      return '#10b981';
    case 'slate':
      return '#64748b';
    default:
      return '#94a3b8';
  }
}
