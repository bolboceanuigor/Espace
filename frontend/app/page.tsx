import type { Metadata } from 'next';
import { PublicWebsitePage } from '@/components/public-site/PublicWebsite';

export const metadata: Metadata = {
  title: 'Espace — Platformă SaaS pentru administrarea APC-urilor',
  description:
    'Espace ajută asociațiile de proprietari să gestioneze apartamente, locatari, facturi, plăți, contoare, solicitări și comunicarea cu locatarii într-o platformă modernă.',
  openGraph: {
    title: 'Espace — Platformă SaaS pentru administrarea APC-urilor',
    description:
      'Administrare modernă pentru APC-uri: apartamente, locatari, facturi, plăți, contoare, solicitări și portal locatar.',
    type: 'website',
  },
};

export default function HomePage() {
  return <PublicWebsitePage page="home" />;
}
