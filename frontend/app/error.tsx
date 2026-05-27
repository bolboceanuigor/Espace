'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { systemMonitoringApi } from '@/lib/api';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    systemMonitoringApi.reportClientError({
      message: error.message || 'Unexpected frontend error',
      stack: error.stack || '',
      code: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      metadata: { digest: error.digest },
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-border/60 bg-card p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">A apărut o eroare neașteptată.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Încearcă din nou. Eroarea a fost înregistrată în Monitoring.</p>
      {error.digest ? <p className="mt-2 text-xs text-muted-foreground">Error ID: {error.digest}</p> : null}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
          Reîncearcă
        </button>
        <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-xl border border-border/60 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
          Înapoi
        </Link>
      </div>
    </div>
  );
}
