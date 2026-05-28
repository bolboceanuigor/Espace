import { RevenueProfilePage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <RevenueProfilePage clientId={params.id} />;
}
