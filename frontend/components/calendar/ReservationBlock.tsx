'use client';

import { memo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/formatDate';
import { reservationStatusClass } from '@/lib/reservationStatus';
import type { PositionedReservation } from '@/lib/calendarLayout';
import { parseDateOnly } from '@/lib/date';
import { StatusBadge } from '@/components/ui';

type ReservationBlockProps = {
  reservation: PositionedReservation & {
    propertyName: string;
    propertyColor?: string | null;
    isSearchMatch?: boolean;
    isHighlighted?: boolean;
  };
  propertyColor?: string;
  onSelect: (reservation: PositionedReservation & { propertyName: string }) => void;
  onContextCancel?: (reservation: PositionedReservation & { propertyName: string }) => void;
  onReservationDragStart?: (reservationId: string) => void;
  onReservationDrop?: (reservationId: string, targetDate: string) => void;
  onReservationResize?: (reservationId: string, direction: 'start' | 'end') => void;
};

function ReservationBlock({
  reservation,
  propertyColor,
  onSelect,
  onContextCancel,
  onReservationDragStart,
  onReservationDrop,
  onReservationResize,
}: ReservationBlockProps) {
  const locale = useLocale();
  const c = useTranslations('common');
  const normalized = reservation.status.toUpperCase();
  const classes = reservationStatusClass(normalized);
  const showText = reservation.widthPx >= 88;
  const laneTop = 4 + reservation.laneIndex * 22;
  const accentColor = mapPropertyColor(propertyColor || reservation.propertyColor || 'gray');

  return (
    <button
      type="button"
      data-reservation-block
      data-reservation-id={reservation.id}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(reservation);
      }}
      className={`group absolute flex h-[18px] items-center rounded-lg border px-1.5 text-left text-[10px] font-medium transition duration-150 ease-out hover:-translate-y-px hover:shadow-sm ${
        reservation.isHighlighted ? 'animate-pulse' : ''
      } ${classes}`}
      style={{
        top: laneTop,
        left: reservation.leftPx + 1,
        width: Math.max(12, reservation.widthPx - 2),
        borderLeft: `3px solid ${accentColor}`,
        boxShadow:
          reservation.isHighlighted || reservation.isSearchMatch
            ? `0 0 0 1px ${accentColor}`
            : undefined,
      }}
      title={`${reservation.guestName} | ${formatDate(locale, parseDateOnly(reservation.startDate))} - ${formatDate(locale, parseDateOnly(reservation.endDate))}`}
      onMouseDown={() => {
        // TODO(dnd): use this hook when drag is implemented.
        onReservationDragStart?.(reservation.id);
      }}
      onMouseUp={() => {
        // TODO(dnd): use these hooks when drop/resize is implemented.
        onReservationDrop?.(reservation.id, reservation.startClamped);
        onReservationResize?.(reservation.id, 'end');
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextCancel?.(reservation);
      }}
    >
      {showText ? <span className="truncate">{reservation.guestName}</span> : null}
      <div className="pointer-events-none absolute -top-32 left-0 hidden w-60 rounded-xl border border-border/60 bg-card p-2 text-xs text-muted-foreground shadow-sm group-hover:block">
        <p className="font-semibold">{reservation.guestName}</p>
        <p className="mt-1">
          {formatDate(locale, parseDateOnly(reservation.startDate))} - {formatDate(locale, parseDateOnly(reservation.endDate))}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span>{c('status')}:</span>
          <StatusBadge status={normalized} />
        </div>
        <p className="mt-1 capitalize">
          {c('source')}: {(reservation.source || 'direct').toLowerCase()}
        </p>
        {reservation.channel ? (
          <p className="mt-1 capitalize">Channel: {reservation.channel.toLowerCase()}</p>
        ) : null}
        {reservation.syncConflict ? <p className="mt-1 font-medium text-foreground">Conflict</p> : null}
      </div>
    </button>
  );
}

export default memo(ReservationBlock);

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
