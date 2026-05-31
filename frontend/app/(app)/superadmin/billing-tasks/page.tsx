import { Suspense } from 'react';
import SuperadminBillingTasksPage from '@/components/superadmin/SuperadminBillingTasksPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperadminBillingTasksPage />
    </Suspense>
  );
}
