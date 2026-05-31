'use client';

import { ButtonLink, Card, PageHeader } from '@/components/ui';

type ModulePlaceholderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  primaryHref: string;
  primaryLabel: string;
  points?: string[];
};

export default function ModulePlaceholder({
  title,
  description,
  eyebrow = 'Modul în pregătire',
  primaryHref,
  primaryLabel,
  points = [],
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        rightSlot={<ButtonLink href={primaryHref} variant="secondary">{primaryLabel}</ButtonLink>}
      />
      <Card className="overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {eyebrow}
            </span>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground">
              Interfața va fi conectată la date reale în faza următoare.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Pentru Phase 1 păstrăm navigația și structura vizuală funcționale, fără să adăugăm logică nouă sau modele backend.
            </p>
          </div>
          <div className="rounded-2xl border border-border/75 bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">Ce va conține modulul</p>
            <div className="mt-3 space-y-2">
              {(points.length ? points : ['Listă clară', 'Filtre simple', 'Acțiuni rapide']).map((point) => (
                <div key={point} className="rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm text-muted-foreground">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
