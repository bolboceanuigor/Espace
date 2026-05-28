import { RevenueCollectionDetailPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RevenueCollectionDetailPage id={params.id} />;
}
