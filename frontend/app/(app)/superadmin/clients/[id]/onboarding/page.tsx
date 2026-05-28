import { ClientDetailPage } from '@/components/superadmin/clients/ClientLifecyclePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientDetailPage id={params.id} tab="onboarding" />;
}
