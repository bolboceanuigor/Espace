import { UpgradeOpportunitiesPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { clientId: string } }) {
  return <UpgradeOpportunitiesPage clientId={params.clientId} />;
}
