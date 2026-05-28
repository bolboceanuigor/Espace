import { InterventionRunPage } from '@/components/superadmin/clients/CustomerSuccessPages';

export default function Page({ params }: { params: { id: string } }) {
  return <InterventionRunPage id={params.id} />;
}
