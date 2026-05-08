'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onboardingApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const STEPS = [
  { key: 'ORGANIZATION_DETAILS', title: 'Date A.P.C.', optional: false, href: '/admin/settings/organization' },
  { key: 'ADD_FIRST_BUILDING', title: 'Clădire / bloc', optional: false, href: '/admin/buildings' },
  { key: 'ADD_STAIRCASES', title: 'Scări', optional: false, href: '/admin/staircases' },
  { key: 'ADD_APARTMENTS', title: 'Apartamente', optional: false, href: '/admin/apartments' },
  { key: 'ADD_RESIDENTS', title: 'Locatari', optional: false, href: '/admin/residents' },
  { key: 'ADD_METERS', title: 'Contoare', optional: false, href: '/admin/meters' },
  { key: 'CONFIGURE_TARIFFS', title: 'Tarife', optional: false, href: '/admin/tariffs' },
  { key: 'GENERATE_FIRST_INVOICES', title: 'Facturi', optional: false, href: '/admin/invoices' },
  { key: 'FINISH_SETUP', title: 'Finalizare', optional: false, href: '/admin' },
] as const;

export default function AdminOnboardingPage() {
  const localizedPath = useLocalizedPath();
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

  if (loading) return <p className="text-sm text-muted-foreground">Se încarcă datele...</p>;

  const checklist = state?.checklist || {};
  const progress = Number(state?.progressDetails?.percent ?? state?.progress ?? 0);
  const steps = state?.steps?.length ? state.steps : STEPS;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Configurare inițială</h1>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{state?.progressDetails?.label || `${progress}% completat`}</p>
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
        {steps.map((step: any, index: number) => {
          const doneByChecklist =
            (step.key === 'ORGANIZATION_DETAILS' && checklist.organizationDetails) ||
            (step.key === 'ADD_FIRST_BUILDING' && checklist.buildingsCreated) ||
            (step.key === 'ADD_STAIRCASES' && checklist.staircasesCreated) ||
            (step.key === 'ADD_APARTMENTS' && (checklist.apartmentsCreated || checklist.apartmentsImported)) ||
            (step.key === 'ADD_RESIDENTS' && checklist.residentsImported) ||
            (step.key === 'ADD_METERS' && checklist.metersCreated) ||
            (step.key === 'CONFIGURE_TARIFFS' && checklist.tariffsConfigured) ||
            (step.key === 'GENERATE_FIRST_INVOICES' && (checklist.invoicesGenerated || checklist.firstInvoicesGenerated));
          const done = Boolean(step.completed ?? doneByChecklist);
          const active = index === currentIndex;
          return (
            <div key={step.key} className={`rounded-lg border px-3 py-2 text-sm ${active ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{index + 1}. {step.title}</p>
                <span className={`text-xs ${done ? 'text-emerald-600' : 'text-muted-foreground'}`}>{done ? 'Completat' : step.optional ? 'Opțional' : 'Necesar'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={localizedPath(steps[currentIndex]?.href || '/admin')} className="rounded-md border border-border/70 px-3 py-2 text-sm">
          Deschide pasul curent
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
            Omite pasul opțional
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
          Continuă
        </button>
        <Link href={localizedPath('/admin/settings/organization')} className="rounded-md border border-border/70 px-3 py-2 text-sm">
          Continuă mai târziu
        </Link>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
          onClick={async () => {
            await onboardingApi.adminComplete();
            await load();
          }}
        >
          Finalizează configurarea
        </button>
      </div>
    </div>
  );
}
