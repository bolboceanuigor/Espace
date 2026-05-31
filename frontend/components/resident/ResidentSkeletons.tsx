'use client';

import { Card } from '@/components/ui';

export function ResidentCardSkeleton() {
  return (
    <Card className="min-h-28 animate-pulse bg-white">
      <div className="h-4 w-1/3 rounded-full bg-muted/85" />
      <div className="mt-4 h-7 w-1/2 rounded-full bg-muted/85" />
      <div className="mt-4 grid gap-2">
        <div className="h-3 rounded-full bg-muted/70" />
        <div className="h-3 w-2/3 rounded-full bg-muted/70" />
      </div>
    </Card>
  );
}

export function ResidentPageSkeleton() {
  return (
    <div className="space-y-4">
      <ResidentCardSkeleton />
      <ResidentCardSkeleton />
      <ResidentCardSkeleton />
    </div>
  );
}

export const InvoiceCardSkeleton = ResidentCardSkeleton;
export const RequestCardSkeleton = ResidentCardSkeleton;
export const MeterCardSkeleton = ResidentCardSkeleton;
