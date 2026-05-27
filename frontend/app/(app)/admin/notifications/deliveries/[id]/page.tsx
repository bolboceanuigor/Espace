import { DeliveryDetailPage } from '@/components/notifications/NotificationProviderPages';

export default function Page({ params }: { params: { id: string } }) {
  return <DeliveryDetailPage id={params.id} admin />;
}
