import { SaasPlanDetailsPage } from '@/components/superadmin/SaasBillingPages';

export default function SuperadminBillingPlanDetailsPage({ params }: { params: { id: string } }) {
  return <SaasPlanDetailsPage id={params.id} />;
}
