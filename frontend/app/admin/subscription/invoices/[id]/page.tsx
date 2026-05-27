import { AdminSaasInvoiceDetailPage } from '@/components/subscription/AdminSaasInvoicePages';

export default function Page({ params }: { params: { id: string } }) {
  return <AdminSaasInvoiceDetailPage id={params.id} />;
}
