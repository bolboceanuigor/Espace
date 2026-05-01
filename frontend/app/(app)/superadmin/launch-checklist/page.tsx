'use client';

import { useMemo } from 'react';
import MobilePageHeader from '@/components/common/MobilePageHeader';

const CHECKS = [
  { key: 'organizationCreated', label: 'Organization created' },
  { key: 'onboardingWorks', label: 'Onboarding works' },
  { key: 'invoicesGenerate', label: 'Invoices generate' },
  { key: 'paymentsWork', label: 'Payments work' },
  { key: 'notificationsWork', label: 'Notifications work' },
  { key: 'chatWorks', label: 'Chat works' },
  { key: 'mobileUxWorks', label: 'Mobile UX works' },
] as const;

export default function SuperadminLaunchChecklistPage() {
  const completion = useMemo(() => 0, []);

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Launch checklist" subtitle="Final verification before onboarding first real organizations." />
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Completion</span>
          <span>{completion}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
        {CHECKS.map((check) => (
          <label key={check.key} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground">
            <input type="checkbox" disabled />
            <span>{check.label}</span>
          </label>
        ))}
      </div>

      <p className="rounded-xl border border-dashed border-border/70 bg-card/40 p-3 text-xs text-muted-foreground">
        Note: checklist-ul este intenționat simplu pentru beta launch. Bifează manual pașii în timpul verificărilor operaționale.
      </p>
    </div>
  );
}
