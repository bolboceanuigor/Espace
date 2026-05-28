import { InvoiceCollectionsPage } from '@/components/superadmin/RevenueOperationsPages';

export default function Page({ params }: { params: { id: string } }) {
  return <InvoiceCollectionsPage invoiceId={params.id} />;
}
