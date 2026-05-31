'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { organizationsApi } from '@/lib/api';

type OnboardingWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
};

export default function OnboardingWizard({ isOpen, onClose, onCompleted }: OnboardingWizardProps) {
  const tActions = useTranslations('actions');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Configurare inițială</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Parcurge pașii de bază pentru a pregăti organizația reală.
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">1. Adaugă primul apartament</p>
            <p className="text-xs text-muted-foreground">Definește blocul, scara și apartamentele pentru A.P.C.</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">2. Adaugă primul locatar</p>
            <p className="text-xs text-muted-foreground">Leagă proprietarii și locatarii de apartamente.</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">3. Invită echipa</p>
            <p className="text-xs text-muted-foreground">Adaugă administratorii care gestionează condominiul.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await organizationsApi.dismissOnboarding();
              onClose();
            }}
          >
            {tActions('skip')}
          </Button>
          <Button size="sm" onClick={onCompleted}>
            {tActions('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
