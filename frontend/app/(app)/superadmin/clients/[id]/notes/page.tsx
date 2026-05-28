import { ClientNotesPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientNotesPage id={params.id} />;
}
