'use client';

import { FileText, Wallet, Megaphone, AlertTriangle, UserPlus, CalendarClock } from 'lucide-react';

export function Announcements({ totalReservations }: { totalReservations: number }) {
  const actions = [
    { title: 'Generează facturi', detail: 'Emite facturile lunare', tone: 'bg-blue-50/80 border-blue-100', icon: FileText },
    { title: 'Înregistrează plată', detail: 'Adaugă o plată manuală', tone: 'bg-emerald-50/80 border-emerald-100', icon: Wallet },
    { title: 'Publică anunț', detail: 'Informează locatarii', tone: 'bg-amber-50/80 border-amber-100', icon: Megaphone },
    { title: 'Raportează problemă', detail: 'Creează o sesizare nouă', tone: 'bg-rose-50/80 border-rose-100', icon: AlertTriangle },
    { title: 'Adaugă locatar', detail: 'Înregistrează un locatar', tone: 'bg-violet-50/80 border-violet-100', icon: UserPlus },
    { title: 'Planifică ședință', detail: 'Stabilește o întâlnire cu locatarii', tone: 'bg-cyan-50/80 border-cyan-100', icon: CalendarClock },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Acțiuni rapide</h3>
          <p className="text-xs text-muted-foreground">Acces rapid la funcțiile principale</p>
        </div>
        <span className="text-xs text-primary">{totalReservations} elemente</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((issue) => (
          <div key={issue.title} className={`rounded-xl border px-3 py-3.5 ${issue.tone}`}>
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/80">
              <issue.icon className="h-4 w-4 text-foreground/75" />
            </div>
            <div>
              <p className="font-medium text-foreground">{issue.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{issue.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
