import { TemplateDetailPage } from '@/components/notifications/NotificationProviderPages';

export default function Page({ params }: { params: { id: string } }) {
  return <TemplateDetailPage id={params.id} />;
}
