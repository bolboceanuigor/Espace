import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicWebsitePage } from '@/components/public-site/PublicWebsite';
import { defaultLocale, isLocale } from '@/i18n';

type LocalizedHomePageProps = {
  params?: { locale?: string };
};

export async function generateMetadata({ params }: LocalizedHomePageProps): Promise<Metadata> {
  const localeCandidate = params?.locale;
  const locale = typeof localeCandidate === 'string' && isLocale(localeCandidate) ? localeCandidate : defaultLocale;
  const t = await getTranslations({ locale, namespace: 'publicSite.meta' });

  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    openGraph: {
      title: t('homeTitle'),
      description: t('homeOgDescription'),
      type: 'website',
    },
  };
}

export default function LocalizedHomePage() {
  return <PublicWebsitePage page="home" />;
}
