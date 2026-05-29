import { Suspense } from 'react';
import { SuperadminActivityTimelinePage } from '@/components/superadmin/SuperadminActivityTimelinePage';

export default function SuperadminActivityPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500">Se încarcă activitatea...</main>}>
      <SuperadminActivityTimelinePage />
    </Suspense>
  );
}
