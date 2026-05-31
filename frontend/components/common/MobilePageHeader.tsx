'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

type MobilePageHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
};

export default function MobilePageHeader({ title, subtitle, actionLabel, onAction, showBackButton = false, onBack }: MobilePageHeaderProps) {
  const router = useRouter();
  return (
    <div className="space-y-2 rounded-xl border border-border/75 bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={() => (onBack ? onBack() : router.back())}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 text-foreground transition hover:bg-muted/60"
              aria-label="Înapoi"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">{title}</h1>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
