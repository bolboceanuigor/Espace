'use client';

import { Info } from 'lucide-react';
import { isDemoPresentationModeEnabled } from '@/lib/demo-presentation';

type DemoPresentationHintProps = {
  text: string;
  tooltip?: string;
};

export default function DemoPresentationHint({ text, tooltip }: DemoPresentationHintProps) {
  if (!isDemoPresentationModeEnabled()) return null;
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
      <span className="inline-flex items-center gap-2">
        <Info className="h-4 w-4" />
        {text}
      </span>
      {tooltip ? (
        <p className="mt-1 text-xs text-sky-700" title={tooltip}>
          {tooltip}
        </p>
      ) : null}
    </div>
  );
}
