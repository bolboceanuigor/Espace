import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { defaultLocale, isLocale } from '@/i18n';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: { locale?: string } | Promise<{ locale?: string }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolved = typeof (params as Promise<{ locale?: string }>)?.then === 'function'
    ? await (params as Promise<{ locale?: string }>)
    : (params as { locale?: string });
  const locale = (resolved?.locale && isLocale(resolved.locale) ? resolved.locale : defaultLocale) as 'ro' | 'en' | 'ru';
  if (!isLocale(locale)) {
    notFound();
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
