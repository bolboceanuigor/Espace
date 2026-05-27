import type { Metadata } from 'next';
import { LegalPublicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Trust Center',
  description: 'Incredere, securitate si transparenta pentru platforma Espace.',
};

export default function Page() {
  return <LegalPublicPage page="trust" />;
}
