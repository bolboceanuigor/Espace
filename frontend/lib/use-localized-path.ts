'use client';

import { useParams } from 'next/navigation';
import { defaultLocale, isLocale, locales } from '@/i18n';

export function useLocalizedPath() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  return (path: string) => {
    if (!path.startsWith('/')) return path;
    if (locales.some((item) => path === `/${item}` || path.startsWith(`/${item}/`))) return path;
    return `/${locale}${path}`;
  };
}
