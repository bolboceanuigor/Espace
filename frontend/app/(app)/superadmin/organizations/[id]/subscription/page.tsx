import { AssociationSaasSubscriptionPage } from '@/components/superadmin/SaasBillingPages';

export default function SuperadminOrganizationSubscriptionPage({ params }: { params: { id: string } }) {
  return <AssociationSaasSubscriptionPage id={params.id} />;
}
