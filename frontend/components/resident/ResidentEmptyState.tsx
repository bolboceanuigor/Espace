'use client';

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { ButtonLink, Card } from '@/components/ui';

export default function ResidentEmptyState({
  title,
  text,
  actionHref,
  actionLabel,
  icon,
}: {
  title: string;
  text: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{text}</p>
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} className="mt-5">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </Card>
  );
}
