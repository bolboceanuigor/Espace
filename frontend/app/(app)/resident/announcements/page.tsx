'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, Tag } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { normalizeResidentAnnouncement, residentAnnouncementVariant, residentAnnouncements } from '@/lib/resident-mvp-data';

export default function ResidentAnnouncementsPage() {
  const [rows, setRows] = useState<typeof residentAnnouncements>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');

  useEffect(() => {
    let active = true;
    residentDemoApi
      .announcements()
      .then((res) => {
        if (!active) return;
        const apiRows = (res.data || []).map(normalizeResidentAnnouncement);
        setRows(apiRows);
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setRows(residentAnnouncements);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Avizier"
        description="Anunțurile importante ale comunității tale."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />
      <div className="flex flex-wrap gap-2">
        {['General', 'Reparații', 'Urgent', 'Administrare'].map((category) => (
          <span key={category} className="shrink-0 rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-semibold text-muted-foreground">
            {category}
          </span>
        ))}
      </div>
      <section className="grid gap-3">
        {rows.map((item) => (
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
        {!rows.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">{source === 'api' ? 'Nu există anunțuri active.' : 'Nu există anunțuri încă.'}</Card> : null}
      </section>
    </div>
  );
}
