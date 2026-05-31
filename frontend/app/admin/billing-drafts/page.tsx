import { Suspense } from 'react';
import { BillingDraftsPage } from '@/components/billing/BillingDraftPages';

export default function AdminBillingDraftsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Se încarcă drafturile de facturi...</div>}>
      <BillingDraftsPage />
    </Suspense>
  );
}
