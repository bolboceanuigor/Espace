export type ReservationStatusKey = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'BLOCKED';

export function normalizeReservationStatus(value: string): ReservationStatusKey {
  const normalized = (value || '').toUpperCase();
  if (normalized === 'CONFIRMED' || normalized === 'PENDING' || normalized === 'CANCELLED') {
    return normalized;
  }
  return 'BLOCKED';
}

export function reservationStatusClass(status: string): string {
  const key = normalizeReservationStatus(status);
  if (key === 'CONFIRMED') return 'border-primary/30 bg-primary/20 text-foreground';
  if (key === 'PENDING') return 'border-secondary/30 bg-secondary/20 text-foreground';
  if (key === 'CANCELLED') return 'border-muted-foreground/20 bg-muted text-muted-foreground opacity-80';
  return 'border-muted-foreground/20 bg-muted text-foreground';
}
