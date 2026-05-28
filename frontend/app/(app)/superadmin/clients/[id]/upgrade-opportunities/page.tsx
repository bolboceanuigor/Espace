import { UpgradeOpportunitiesPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <UpgradeOpportunitiesPage clientId={params.id} />;
}
