import type { CalendarReservation } from './calendarTypes';
import { clampDate, diffDays } from './date';

export type PositionedReservation = CalendarReservation & {
  leftPx: number;
  widthPx: number;
  laneIndex: number;
  startClamped: string;
  endClamped: string;
};

export type CalendarLayoutResult = {
  reservationsByProperty: Record<string, PositionedReservation[]>;
  maxLanesPerProperty: Record<string, number>;
};

export function buildCalendarLayout(params: {
  rangeStart: string;
  rangeEnd: string;
  reservations: CalendarReservation[];
  cellWidth: number;
}): CalendarLayoutResult {
  const { rangeStart, rangeEnd, reservations, cellWidth } = params;
  const byProperty = new Map<string, PositionedReservation[]>();

  for (const reservation of reservations) {
    const startClamped = clampDate(reservation.startDate, rangeStart, rangeEnd);
    const endClamped = clampDate(reservation.endDate, rangeStart, rangeEnd);
    if (startClamped >= endClamped) continue;
    const leftPx = diffDays(rangeStart, startClamped) * cellWidth;
    const widthPx = diffDays(startClamped, endClamped) * cellWidth;
    if (widthPx <= 0) continue;
    const next: PositionedReservation = {
      ...reservation,
      leftPx,
      widthPx,
      laneIndex: 0,
      startClamped,
      endClamped,
    };
    const list = byProperty.get(reservation.propertyId) ?? [];
    list.push(next);
    byProperty.set(reservation.propertyId, list);
  }

  const reservationsByProperty: Record<string, PositionedReservation[]> = {};
  const maxLanesPerProperty: Record<string, number> = {};

  byProperty.forEach((list, propertyId) => {
    list.sort((a, b) =>
      a.startClamped === b.startClamped
        ? a.endClamped.localeCompare(b.endClamped)
        : a.startClamped.localeCompare(b.startClamped),
    );
    const laneEnds: string[] = [];
    for (const reservation of list) {
      let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= reservation.startClamped);
      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(reservation.endClamped);
      } else {
        laneEnds[laneIndex] = reservation.endClamped;
      }
      reservation.laneIndex = laneIndex;
    }
    reservationsByProperty[propertyId] = list;
    maxLanesPerProperty[propertyId] = Math.max(1, laneEnds.length);
  });

  return { reservationsByProperty, maxLanesPerProperty };
}
