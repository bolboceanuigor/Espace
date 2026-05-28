import { RevenueProfilePage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { associationId: string } }) {
  return <RevenueProfilePage associationId={params.associationId} />;
}
