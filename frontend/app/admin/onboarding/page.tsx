'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onboardingApi } from '@/lib/api';

const STEPS = [
  { key: 'ORGANIZATION_DETAILS', title: 'Organization details', optional: false, href: '/admin/settings/organization' },
  { key: 'ADD_FIRST_BUILDING', title: 'Add first building', optional: false, href: '/admin/buildings' },
  { key: 'ADD_STAIRCASES', title: 'Add staircases', optional: false, href: '/admin/buildings' },
  { key: 'IMPORT_APARTMENTS', title: 'Import apartments', optional: false, href: '/admin/imports/new' },
  { key: 'IMPORT_RESIDENTS', title: 'Import residents', optional: false, href: '/admin/imports/new' },
  { key: 'CONFIGURE_TARIFFS', title: 'Configure tariffs', optional: true, href: '/admin/reports' },
  { key: 'CONFIGURE_PAYMENT_METHODS', title: 'Configure payment methods', optional: true, href: '/admin/settings/payment-providers' },
  { key: 'GENERATE_FIRST_INVOICES', title: 'Generate first invoices', optional: false, href: '/admin/invoices' },
  { key: 'INVITE_RESIDENTS', title: 'Invite residents', optional: true, href: '/admin/invitations' },
  { key: 'FINISH_SETUP', title: 'Finish setup', optional: false, href: '/admin' },
] as const;

export default function AdminOnboardingPage() {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await onboardingApi.adminGet();
    setState(res.data);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const currentIndex = useMemo(() => {
    const key = state?.organization?.onboardingStep || STEPS[0].key;
    const index = STEPS.findIndex((step) => step.key === key);
    return index >= 0 ? index : 0;
  }, [state?.organization?.onboardingStep]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading onboarding...</p>;

  const checklist = state?.checklist || {};
  const progress = Number(state?.progress || 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organization Onboarding</h1>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{progress}% completed</p>
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
        {STEPS.map((step, index) => {
          const doneByIndex = index < currentIndex;
          const doneByChecklist =
            (step.key === 'ADD_FIRST_BUILDING' && checklist.buildingsCreated) ||
            (step.key === 'IMPORT_APARTMENTS' && checklist.apartmentsImported) ||
            (step.key === 'IMPORT_RESIDENTS' && checklist.residentsImported) ||
            (step.key === 'CONFIGURE_TARIFFS' && checklist.tariffsConfigured) ||
            (step.key === 'CONFIGURE_PAYMENT_METHODS' && checklist.paymentProviderConfigured) ||
            (step.key === 'GENERATE_FIRST_INVOICES' && checklist.firstInvoicesGenerated);
          const done = doneByIndex || doneByChecklist;
          const active = index === currentIndex;
          return (
            <div key={step.key} className={`rounded-lg border px-3 py-2 text-sm ${active ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{index + 1}. {step.title}</p>
                <span className={`text-xs ${done ? 'text-emerald-600' : 'text-muted-foreground'}`}>{done ? 'Done' : step.optional ? 'Optional' : 'Required'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={STEPS[currentIndex]?.href || '/admin'} className="rounded-md border border-border/70 px-3 py-2 text-sm">
          Open current step
        </Link>
        {STEPS[currentIndex]?.optional ? (
          <button
            className="rounded-md border border-border/70 px-3 py-2 text-sm"
            onClick={async () => {
              const next = Math.min(currentIndex + 1, STEPS.length - 1);
              await onboardingApi.adminUpdateStep({
                onboardingStatus: 'IN_PROGRESS',
                onboardingStep: STEPS[next].key,
              });
              await load();
            }}
          >
            Skip optional step
          </button>
        ) : null}
        <button
          className="rounded-md border border-border/70 px-3 py-2 text-sm"
          onClick={async () => {
            const next = Math.min(currentIndex + 1, STEPS.length - 1);
            await onboardingApi.adminUpdateStep({
              onboardingStatus: 'IN_PROGRESS',
              onboardingStep: STEPS[next].key,
            });
            await load();
          }}
        >
          Continue
        </button>
        <Link href="/admin/settings/organization" className="rounded-md border border-border/70 px-3 py-2 text-sm">
          Continue later
        </Link>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
          onClick={async () => {
            await onboardingApi.adminComplete();
            await load();
          }}
        >
          Finish setup
        </button>
      </div>
    </div>
  );
}

