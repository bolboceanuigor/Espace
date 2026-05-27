import { SaasInvoiceDetailPage } from '@/components/superadmin/SaasInvoicePages';

export default function Page({ params }: { params: { id: string } }) {
  return <SaasInvoiceDetailPage id={params.id} />;
}
