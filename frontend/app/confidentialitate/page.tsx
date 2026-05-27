import type { Metadata } from 'next';
import { LegalPublicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Politica de confidentialitate',
  description: 'Cum sunt tratate datele personale si operationale in Espace.',
};

export default function Page() {
  return <LegalPublicPage page="privacy" />;
}
