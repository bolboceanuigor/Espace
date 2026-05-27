import type { Metadata } from 'next';
import { LegalPublicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Legal & Trust',
  description: 'Documente publice despre securitate, confidentialitate, termeni si prelucrarea datelor.',
};

export default function Page() {
  return <LegalPublicPage page="legal-index" />;
}
