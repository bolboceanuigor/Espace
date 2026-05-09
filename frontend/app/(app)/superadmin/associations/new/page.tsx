import { Suspense } from 'react';
import AssociationOnboardingWizard from '@/components/superadmin/AssociationOnboardingWizard';
import Card from '@/components/ui/Card';

export default function NewAssociationOnboardingPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm font-semibold text-muted-foreground">Se încarcă wizard-ul...</Card>}>
      <AssociationOnboardingWizard />
    </Suspense>
  );
}
