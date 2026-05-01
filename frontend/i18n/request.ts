import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale } from '@/i18n';

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale && isLocale(locale) ? locale : defaultLocale;

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  };
});
