import { ClientLinksPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientLinksPage id={params.id} />;
}
