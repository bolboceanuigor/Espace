import { SaasPlanFormPage } from '@/components/superadmin/SaasBillingPages';

export default function EditSuperadminBillingPlanPage({ params }: { params: { id: string } }) {
  return <SaasPlanFormPage id={params.id} />;
}
