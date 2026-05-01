'use client';

import { Suspense, useEffect, useState } from 'react';
import CalendarBoard from '@/components/calendar/CalendarBoard';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { organizationsApi } from '@/lib/api';

function CalendarBoardFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/60 bg-muted/30 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
      <p className="text-sm text-muted-foreground">Loading calendar…</p>
    </div>
  );
}

export default function CalendarPage() {
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    organizationsApi
      .getOnboardingState()
      .then((res) => {
        setShowWizard(!!res.data?.showWizard);
      })
      .catch(() => {
        setShowWizard(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <h1 className="text-lg font-semibold text-foreground">Calendar</h1>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Compact timeline board for reservations and apartments.
        </p>
      </div>
      <Suspense fallback={<CalendarBoardFallback />}>
        <CalendarBoard />
      </Suspense>
      <OnboardingWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onCompleted={() => {
          setShowWizard(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
