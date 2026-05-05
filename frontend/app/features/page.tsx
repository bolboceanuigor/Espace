import EspaceProductPage from '@/components/marketing/EspaceProductPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Funcționalități Espace - Administrare APC',
  description:
    'Funcționalități pentru asociații de proprietari: apartamente, locatari, contoare, plăți, cereri, avizier și mesaje.',
};

export default function FeaturesPage() {
  return <EspaceProductPage active="features" />;
}
