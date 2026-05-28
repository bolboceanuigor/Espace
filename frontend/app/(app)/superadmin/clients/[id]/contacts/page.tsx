import { ClientContactsPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientContactsPage id={params.id} />;
}
