import { ClientFollowUpDetailPage } from '@/components/superadmin/clients/ClientLifecyclePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientFollowUpDetailPage id={params.id} />;
}
