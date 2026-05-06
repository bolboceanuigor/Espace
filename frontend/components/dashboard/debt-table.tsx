'use client';

import { Reservation } from './types';

export function DebtTable({ items }: { items: Reservation[] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <h3 className="text-base font-semibold text-foreground">Datorii restante</h3>
      <p className="mt-1 text-sm text-muted-foreground">Apartamente ordonate după soldul restant.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-2">Locatar</th>
              <th className="py-2 pr-2">Scadență</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 text-right">Sumă</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-2 text-foreground">{item.guestName || 'Locatar'}</td>
                  <td className="py-3 pr-2 text-muted-foreground">{new Date(item.checkIn).toLocaleDateString()}</td>
                  <td className="py-3 pr-2">
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-foreground">{Math.round(item.totalPrice)} MDL</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nu există datorii restante.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
