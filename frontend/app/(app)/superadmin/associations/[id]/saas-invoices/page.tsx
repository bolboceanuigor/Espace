import { SuperadminSaasInvoicesPage } from '@/components/superadmin/SaasInvoicePages';

export default function Page({ params }: { params: { id: string } }) {
  return <SuperadminSaasInvoicesPage associationId={params.id} />;
}
