import { ClientReminderDetailPage } from '@/components/superadmin/clients/ClientLifecyclePages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientReminderDetailPage id={params.id} />;
}
