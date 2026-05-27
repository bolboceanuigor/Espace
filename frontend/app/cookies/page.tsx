import type { Metadata } from 'next';
import { LegalPublicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Politica cookies',
  description: 'Cum pot fi folosite cookies si tehnologii similare in Espace.',
};

export default function Page() {
  return <LegalPublicPage page="cookies" />;
}
