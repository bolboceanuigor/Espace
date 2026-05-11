'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2, CircleAlert, TriangleAlert, XCircle } from 'lucide-react';

export type BillingTimelineStatus = 'COMPLETE' | 'WARNING' | 'ERROR' | 'PENDING';

type BillingTimelineItem = {
  key: string;
  label: string;
  status: BillingTimelineStatus;
  description?: string;
  actionUrl?: string;
};

type BillingTimelineProps = {
  items: BillingTimelineItem[];
};

const iconMap = {
  COMPLETE: CheckCircle2,
  WARNING: TriangleAlert,
  ERROR: XCircle,
  PENDING: CalendarDays,
} as const;

const toneMap = {
  COMPLETE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
  ERROR: 'border-rose-200 bg-rose-50 text-rose-700',
  PENDING: 'border-slate-200 bg-white text-slate-500',
} as const;

export default function BillingTimeline({ items }: BillingTimelineProps) {
  return (
    <div className="relative">
      <div className="hidden absolute left-6 right-6 top-6 h-px bg-slate-200 lg:block" />
      <div className="grid gap-3 lg:grid-cols-8">
        {items.map((item, index) => {
          const Icon = iconMap[item.status] || CircleAlert;
          const content = (
            <div className={`relative h-full rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneMap[item.status]}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold text-current/70">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{item.label}</h3>
              {item.description ? <p className="mt-2 text-xs leading-5 opacity-85">{item.description}</p> : null}
            </div>
          );

          return item.actionUrl ? (
            <Link key={item.key} href={item.actionUrl} className="block">
              {content}
            </Link>
          ) : (
            <div key={item.key}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
