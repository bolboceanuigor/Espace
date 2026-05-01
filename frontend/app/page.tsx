import LandingPageContent from '@/components/marketing/LandingPageContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CondoFlow - Platforma pentru e-Condominiu',
  description: 'Platforma SaaS pentru administrare asociatii, facturi, plati si comunicare cu locatarii.',
  openGraph: {
    title: 'CondoFlow - Platforma pentru e-Condominiu',
    description: 'Platforma SaaS pentru administrare asociatii, facturi, plati si comunicare cu locatarii.',
    type: 'website',
  },
};

export default function HomePage() {
  return <LandingPageContent />;
}
