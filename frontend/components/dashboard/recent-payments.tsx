'use client';

import { Reservation } from './types';

export function RecentPayments({ items }: { items: Reservation[] }) {
  const tags = ['Succes', 'Info', 'Urgent', 'Succes', 'Info'];
  const tagClass = (tag: string) =>
    tag === 'Urgent'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tag === 'Succes'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Activitate Recente</h3>
          <p className="text-xs text-muted-foreground">Ultimele actiuni din condominiu</p>
        </div>
        <span className="text-xs text-primary">Live</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-white px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {(item.guestName || 'P').slice(0, 2).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-foreground">{item.guestName || 'Plata inregistrata'}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.checkIn).toLocaleDateString()} · Acum 5 min</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600">+{Math.round(item.totalPrice)} RON</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tagClass(tags[index % tags.length])}`}>
                  {tags[index % tags.length]}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nu exista plati recente.</p>
        )}
      </div>
    </div>
  );
}
