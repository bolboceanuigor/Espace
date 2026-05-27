import { SuperadminAssociationUsagePage } from '@/components/superadmin/SaasUsagePages';

export default function SuperadminSubscriptionUsagePage({ params }: { params: { id: string } }) {
  return <SuperadminAssociationUsagePage subscriptionId={params.id} />;
}
