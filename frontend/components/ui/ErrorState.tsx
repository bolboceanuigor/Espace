'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

type ErrorStateProps = {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export default function ErrorState({
  title = 'Nu am putut încărca datele',
  message = 'Reîncearcă sau verifică conexiunea la server.',
  retryLabel = 'Reîncearcă',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-critical/20 bg-critical/10 p-5 text-critical shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-critical/15 bg-white text-critical shadow-sm">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-critical/90">{message}</p>
          {onRetry ? (
            <Button className="mt-4" variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
