import { SuperadminProviderDetailPage } from '@/components/payments/OnlinePaymentsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <SuperadminProviderDetailPage id={params.id} />;
}
