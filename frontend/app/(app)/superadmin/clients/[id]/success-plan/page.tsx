import { ClientSuccessPlanPage } from '@/components/superadmin/clients/CustomerSuccessPages';

export default function Page({ params }: { params: { id: string } }) {
  return <ClientSuccessPlanPage id={params.id} />;
}
