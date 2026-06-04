import type { Metadata } from 'next';
import { PublicWebsitePage } from '@/components/public-site/PublicWebsite';

export const metadata: Metadata = {
  title: 'Espace SaaS — Platformă modernă pentru administrarea condominiilor',
  description:
    'Espace ajută administratorii APC să gestioneze locatari, apartamente, contoare, facturi, plăți, cereri și comunicarea într-un singur loc.',
  openGraph: {
    title: 'Espace SaaS — Platformă modernă pentru administrarea condominiilor',
    description:
      'Administrare modernă pentru APC-uri: locatari, apartamente, contoare, facturi, plăți, cereri și comunicare.',
    type: 'website',
  },
};

export default function HomePage() {
  return <PublicWebsitePage page="home" />;
}
