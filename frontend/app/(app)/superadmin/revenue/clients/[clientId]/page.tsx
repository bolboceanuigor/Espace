import { RevenueProfilePage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { clientId: string } }) {
  return <RevenueProfilePage clientId={params.clientId} />;
}
