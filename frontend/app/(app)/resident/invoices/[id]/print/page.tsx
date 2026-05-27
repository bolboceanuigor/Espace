import { InvoicePrintPage } from '@/components/print/DocumentPrintPages';

export default function Page({ params }: { params: { id: string } }) {
  return <InvoicePrintPage id={params.id} audience="resident" />;
}
