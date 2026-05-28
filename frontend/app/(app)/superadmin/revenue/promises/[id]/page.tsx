import { RevenuePromiseDetailPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RevenuePromiseDetailPage id={params.id} />;
}
