import { Suspense } from 'react';
import { FinancialReportPrintPage } from '@/components/print/DocumentPrintPages';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FinancialReportPrintPage />
    </Suspense>
  );
}
