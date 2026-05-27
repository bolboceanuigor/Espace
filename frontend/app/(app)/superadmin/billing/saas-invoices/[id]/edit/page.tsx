import { SaasInvoiceFormPage } from '@/components/superadmin/SaasInvoicePages';

export default function Page({ params }: { params: { id: string } }) {
  return <SaasInvoiceFormPage id={params.id} />;
}
