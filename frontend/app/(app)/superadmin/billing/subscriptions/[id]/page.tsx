import { SaasSubscriptionDetailsPage } from '@/components/superadmin/SaasBillingPages';

export default function SuperadminBillingSubscriptionDetailsPage({ params }: { params: { id: string } }) {
  return <SaasSubscriptionDetailsPage id={params.id} />;
}
