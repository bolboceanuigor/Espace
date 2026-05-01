const LOCALE_MAP: Record<string, string> = {
  ro: 'ro-RO',
  ru: 'ru-RU',
  en: 'en-US',
};

export function formatDate(
  locale: string,
  date: Date | string,
  style: 'short' | 'long' = 'long',
): string {
  const resolvedLocale = LOCALE_MAP[locale] || LOCALE_MAP.ro;
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(resolvedLocale, options).format(value);
}
