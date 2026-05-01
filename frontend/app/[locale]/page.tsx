import LandingPageContent from '@/components/marketing/LandingPageContent';
import type { Metadata } from 'next';
import { defaultLocale, isLocale } from '@/i18n';

type LocaleHomePageProps = {
  params: { locale?: string };
};

export async function generateMetadata({ params }: LocaleHomePageProps): Promise<Metadata> {
  const locale = isLocale(params.locale || '') ? params.locale : defaultLocale;
  const title = locale === 'en' ? 'CondoFlow - Condominium Management' : 'CondoFlow - Platforma pentru e-Condominiu';
  const description =
    locale === 'en'
      ? 'SaaS platform for condominiums: invoices, payments, maintenance and resident communication.'
      : 'Platforma SaaS pentru administrare asociatii, facturi, plati si comunicare cu locatarii.';

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
  return <LandingPageContent />;
}
