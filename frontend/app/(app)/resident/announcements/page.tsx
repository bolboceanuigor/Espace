'use client';

import { CalendarDays, Megaphone, Tag } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';

const announcements = [
  { id: 'a1', title: 'Lucrări de întreținere la lift', category: 'Mentenanță', date: '03 Mai 2026', content: 'Liftul de pe Scara 2 va fi verificat între orele 10:00 și 13:00.', priority: 'important' },
  { id: 'a2', title: 'Ședință APC - buget lunar', category: 'Comunitate', date: '08 Mai 2026', content: 'Locatarii sunt invitați la ședința lunară pentru aprobarea cheltuielilor comune.', priority: 'normal' },
  { id: 'a3', title: 'Avarie apă caldă pe Scara 3', category: 'Urgent', date: '01 Mai 2026', content: 'Echipa tehnică investighează întreruperea. Revenim cu actualizări.', priority: 'urgent' },
];

export default function ResidentAnnouncementsPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Avizier" description="Anunțurile importante ale comunității tale." />
      <section className="grid gap-3">
        {announcements.map((item) => (
          <Card key={item.id} className={`p-4 ${item.priority === 'urgent' ? 'border-rose-200 bg-rose-50/40' : item.priority === 'important' ? 'border-amber-200 bg-amber-50/40' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{item.category}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{item.date}</span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
              </div>
              <Badge variant={item.priority === 'urgent' ? 'error' : item.priority === 'important' ? 'warning' : 'neutral'}>{item.priority}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.content}</p>
            <p className="mt-4 inline-flex items-center gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground"><Megaphone className="h-3.5 w-3.5" /> Publicat de administrație</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
