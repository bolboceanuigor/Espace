import { UpgradeOpportunityDetailPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <UpgradeOpportunityDetailPage id={params.id} />;
}
