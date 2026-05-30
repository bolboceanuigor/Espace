'use client';

import { X } from 'lucide-react';

type DetailDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function DetailDrawer({ open, title, description, onClose, children, footer }: DetailDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" aria-label="Închide detaliile" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-border/70 bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 text-muted-foreground transition hover:bg-muted/65 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <footer className="border-t border-border/70 bg-muted/25 p-4">{footer}</footer> : null}
      </aside>
    </div>
  );
}
