import { SavedReportsPage } from '@/components/superadmin/clients/CustomerSuccessReportsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <SavedReportsPage id={params.id} />;
}
