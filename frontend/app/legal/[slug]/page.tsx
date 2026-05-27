import type { Metadata } from 'next';
import { LegalDynamicPage } from '@/components/public-site/LegalPublicPages';

export const metadata: Metadata = {
  title: 'Espace — Document legal',
  description: 'Document public Espace despre incredere, securitate si date.',
};

export default function Page({ params }: { params: { slug: string } }) {
  return <LegalDynamicPage slug={params.slug} />;
}
