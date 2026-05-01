'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, useToast } from '@/components/ui';
import { organizationsApi } from '@/lib/api';

type OnboardingWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
};

export default function OnboardingWizard({ isOpen, onClose, onCompleted }: OnboardingWizardProps) {
  const tActions = useTranslations('actions');
  const tCommon = useTranslations('common');
  const { showToast } = useToast();
  const [loadingDemo, setLoadingDemo] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Get started</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow these 3 steps to understand the product quickly.
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">1. Create first property</p>
            <p className="text-xs text-muted-foreground">Add apartments/properties to start scheduling.</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">2. Add first reservation</p>
            <p className="text-xs text-muted-foreground">Create a reservation from calendar cell click.</p>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="text-sm font-medium text-foreground">3. Invite team (optional)</p>
            <p className="text-xs text-muted-foreground">Invite managers and assign properties.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              setLoadingDemo(true);
              try {
                await organizationsApi.loadDemoData();
                showToast(tCommon('saved'), 'success');
                onCompleted();
              } catch {
                showToast(tCommon('error'), 'error');
              } finally {
                setLoadingDemo(false);
              }
            }}
            disabled={loadingDemo}
          >
            {loadingDemo ? '...' : tActions('loadDemo')}
          </Button>
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
