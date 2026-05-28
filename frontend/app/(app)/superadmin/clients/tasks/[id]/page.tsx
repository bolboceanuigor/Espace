import { ClientTaskDetailPage } from '@/components/superadmin/clients/ClientLifecyclePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientTaskDetailPage id={params.id} />;
}
