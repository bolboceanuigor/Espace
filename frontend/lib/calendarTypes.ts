export type CalendarRange = {
  start: string;
  end: string;
};

export type CalendarProperty = {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
  groupId?: string | null;
};

export type CalendarReservationStatus =
  | 'CONFIRMED'
  | 'PENDING'
  | 'CANCELLED'
  | 'BLOCKED';

export type CalendarChannel = 'AIRBNB' | 'BOOKING' | 'DIRECT';

export type CalendarReservation = {
  id: string;
  propertyId: string;
  guestName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (exclusive)
  status: CalendarReservationStatus;
  channel?: CalendarChannel | null;
  externalId?: string | null;
  lastSyncAt?: string | null;
  syncConflict?: boolean;
  rawPayload?: unknown;
  source?: string | null;
  notes?: string | null;
};
