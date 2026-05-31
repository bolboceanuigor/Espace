'use client';

import { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui';

export default function ResidentFinancialCard({
  label,
  amount,
  status,
  description,
  actions,
}: {
  label: string;
  amount: string;
  status: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-primary p-5 text-primary-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-primary-foreground/72">{label}</p>
          <Badge variant="success">{status}</Badge>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-normal">{amount}</p>
        {description ? <p className="mt-2 text-sm leading-6 text-primary-foreground/75">{description}</p> : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </Card>
  );
}
