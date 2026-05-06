'use client';

import { CalendarDays, Megaphone, Tag } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { residentAnnouncementVariant, residentAnnouncements } from '@/lib/resident-mvp-data';

export default function ResidentAnnouncementsPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Avizier" description="Anunțurile importante ale comunității tale." />
      <div className="flex flex-wrap gap-2">
        {['General', 'Reparații', 'Urgent', 'Administrare'].map((category) => (
          <span key={category} className="shrink-0 rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-semibold text-muted-foreground">
            {category}
          </span>
        ))}
      </div>
      <section className="grid gap-3">
        {residentAnnouncements.map((item) => (
          <Card key={item.id} className={`p-4 ${item.category === 'Urgent' ? 'border-rose-200 bg-rose-50/40' : item.category === 'Reparații' ? 'border-amber-200 bg-amber-50/40' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{item.category}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{item.date}</span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
              </div>
              <Badge variant={residentAnnouncementVariant[item.category]}>{item.category}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.content}</p>
            <p className="mt-4 inline-flex items-center gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5" />
              Publicat de administrație
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
