export function parseDateOnly(value: string): Date {
  // Treat incoming YYYY-MM-DD as UTC midnight to avoid TZ drift.
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}
