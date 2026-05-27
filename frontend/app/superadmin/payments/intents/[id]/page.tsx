import { IntentDetailPage } from '@/components/payments/OnlinePaymentsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <IntentDetailPage id={params.id} audience="superadmin" />;
}
