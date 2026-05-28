import { ClientDecisionsPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientDecisionsPage id={params.id} />;
}
