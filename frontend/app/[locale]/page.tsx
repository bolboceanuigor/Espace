import EspaceProductPage from '@/components/marketing/EspaceProductPage';
import type { Metadata } from 'next';
import { defaultLocale, isLocale } from '@/i18n';

type LocaleHomePageProps = {
  params: { locale?: string };
};

export async function generateMetadata({ params }: LocaleHomePageProps): Promise<Metadata> {
  const locale = isLocale(params.locale || '') ? params.locale : defaultLocale;
  const title = locale === 'en' ? 'Espace - Condominium Management' : 'Espace - Administrare asociații de proprietari';
  const description =
    locale === 'en'
      ? 'Frontend preview for condominiums: apartments, meters, payments, requests and resident communication.'
      : 'Preview frontend pentru administrarea apartamentelor, locatarilor, contoarelor, plăților și comunicărilor.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default function LocaleHomePage() {
  return <EspaceProductPage active="home" />;
}
