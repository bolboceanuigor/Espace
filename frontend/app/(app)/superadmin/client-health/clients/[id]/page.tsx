import { ClientHealthDetailPage } from '@/components/superadmin/clients/ClientHealthPages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientHealthDetailPage id={params.id} />;
}
