import { Suspense } from 'react';

import { ApartmentsFinancialReportPage } from '@/components/reports/FinancialReportsPages';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Se încarcă raportul...</div>}>
      <ApartmentsFinancialReportPage />
    </Suspense>
  );
}
