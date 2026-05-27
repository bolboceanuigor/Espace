import type { Metadata } from 'next';
import { LegalPublicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Termeni de utilizare',
  description: 'Reguli generale pentru folosirea platformei Espace.',
};

export default function Page() {
  return <LegalPublicPage page="terms" />;
}
