import { PaymentReceiptPrintPage } from '@/components/print/DocumentPrintPages';

export default function Page({ params }: { params: { id: string } }) {
  return <PaymentReceiptPrintPage id={params.id} audience="admin" />;
}
