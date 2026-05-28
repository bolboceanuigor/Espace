import { ClientKnowledgeOverviewPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientKnowledgeOverviewPage id={params.id} />;
}
