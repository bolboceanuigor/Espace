import { SaasInvoicePrintPage } from '@/components/print/DocumentPrintPages';

export default function Page({ params }: { params: { id: string } }) {
  return <SaasInvoicePrintPage id={params.id} audience="superadmin" receipt />;
}
