import { AdminInvoiceIntentsPage } from '@/components/payments/OnlinePaymentsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <AdminInvoiceIntentsPage id={params.id} />;
}
