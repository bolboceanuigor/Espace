'use client';

import { AlertTriangle } from 'lucide-react';
import { Button, ButtonLink, Card } from '@/components/ui';

export default function ResidentErrorState({
  title = 'Nu am putut încărca pagina',
  message = 'Verifică conexiunea și încearcă din nou.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry ? <Button onClick={onRetry}>Actualizează</Button> : null}
        <ButtonLink href="/resident" variant="secondary">
          Acasă
        </ButtonLink>
      </div>
    </Card>
  );
}
