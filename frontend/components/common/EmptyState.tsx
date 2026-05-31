'use client';

import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 p-8 text-center shadow-card">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-accent/35 text-primary/75">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="mt-4 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/20 hover:bg-muted/70" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
