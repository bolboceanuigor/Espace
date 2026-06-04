import { getTranslations } from 'next-intl/server';
import { defaultLocale, isLocale } from '@/i18n';

type TermsPageProps = {
  params?: { locale?: string };
};

export default async function TermsPage({ params }: TermsPageProps) {
  const localeCandidate = params?.locale;
  const locale = typeof localeCandidate === 'string' && isLocale(localeCandidate) ? localeCandidate : defaultLocale;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-5 py-8">
      <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-foreground">
        {t('body')}
      </div>
    </main>
  );
}
