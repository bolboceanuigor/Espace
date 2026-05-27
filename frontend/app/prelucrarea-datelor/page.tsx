import type { Metadata } from 'next';
import { LegalPublicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Prelucrarea datelor',
  description: 'Informatii despre rolurile si responsabilitatile legate de datele administrate in Espace.',
};

export default function Page() {
  return <LegalPublicPage page="data-processing" />;
}
