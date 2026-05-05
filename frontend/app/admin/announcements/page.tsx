'use client';

import Link from 'next/link';
import { CalendarDays, Megaphone, PlusCircle, Tag } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader } from '@/components/ui';
import { adminAnnouncements, announcementCategoryVariant } from '@/lib/admin-mvp-data';

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Avizier"
        description="Anunțuri oficiale pentru locatari, cu categorii clare și stare de publicare."
        rightSlot={<ButtonLink href="/admin/announcements/ann-1"><PlusCircle className="h-4 w-4" /> Adaugă anunț</ButtonLink>}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['General', 'Reparații', 'Urgent', 'Administrare'].map((category) => (
          <span key={category} className="shrink-0 rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-semibold text-muted-foreground">
            {category}
          </span>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminAnnouncements.map((item) => (
          <Card key={item.id} className={`p-4 ${item.category === 'Urgent' ? 'border-rose-200 bg-rose-50/35' : item.category === 'Reparații' ? 'border-amber-200 bg-amber-50/35' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-2 py-1">
                    <Tag className="h-3 w-3" />
                    {item.category}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {item.date}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
              </div>
              <Badge variant={announcementCategoryVariant[item.category]}>{item.category}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.preview}</p>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5" />
                {item.status}
              </span>
              <Link href={`/admin/announcements/${item.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-border/70 px-3 text-xs font-semibold hover:bg-muted/60">
                Deschide
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
