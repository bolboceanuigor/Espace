import { ClientFilesPage } from '@/components/superadmin/clients/ClientKnowledgePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientFilesPage id={params.id} />;
}
