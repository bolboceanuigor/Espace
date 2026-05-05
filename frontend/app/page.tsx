import EspaceProductPage from '@/components/marketing/EspaceProductPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Espace - Administrare asociații de proprietari',
  description: 'Preview frontend pentru administrarea apartamentelor, locatarilor, contoarelor, plăților și comunicărilor.',
  openGraph: {
    title: 'Espace - Administrare asociații de proprietari',
    description: 'Preview frontend pentru administrarea apartamentelor, locatarilor, contoarelor, plăților și comunicărilor.',
    type: 'website',
  },
};

export default function HomePage() {
  return <EspaceProductPage active="home" />;
}
