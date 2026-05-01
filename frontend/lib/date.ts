const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnlyString(date: Date): string {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(utc).toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(value: string, days: number): string {
  const base = parseDateOnly(value);
  if (Number.isNaN(base.getTime())) return value;
  const next = new Date(base.getTime() + days * DAY_MS);
  return toDateOnlyString(next);
}

export function diffDays(start: string, end: string): number {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

export function clampDate(value: string, min: string, max: string): string {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function isWeekend(value: string): boolean {
  const date = parseDateOnly(value);
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isToday(value: string): boolean {
  return value === toDateOnlyString(new Date());
}
