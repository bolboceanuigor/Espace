import { InterventionsPage } from '@/components/superadmin/clients/CustomerSuccessPages';

export default function Page({ params }: { params: { id: string } }) {
  return <InterventionsPage clientId={params.id} />;
}
