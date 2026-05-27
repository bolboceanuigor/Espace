import { Suspense } from 'react';
import { MeterConsumptionReportPrintPage } from '@/components/print/DocumentPrintPages';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MeterConsumptionReportPrintPage />
    </Suspense>
  );
}
