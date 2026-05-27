'use client';

import { PdfFallbackPage } from '@/components/print/DocumentPrintPages';
import { invoicesApi } from '@/lib/api';

export default function Page({ params }: { params: { id: string } }) {
  return <PdfFallbackPage loader={() => invoicesApi.adminPdfFallback(params.id)} />;
}
