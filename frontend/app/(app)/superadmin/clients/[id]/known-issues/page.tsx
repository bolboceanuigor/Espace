import { ClientKnownIssuesPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientKnownIssuesPage id={params.id} />;
}
