'use client';

import { PdfFallbackPage } from '@/components/print/DocumentPrintPages';
import { billingSaasApi } from '@/lib/api';

export default function Page({ params }: { params: { id: string } }) {
  return <PdfFallbackPage loader={() => billingSaasApi.getAdminSaasInvoicePdfFallback(params.id)} />;
}
