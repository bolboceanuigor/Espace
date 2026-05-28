import { ClientRetentionPage } from '@/components/superadmin/RetentionPages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientRetentionPage clientId={params.id} view="renewal" />;
}
