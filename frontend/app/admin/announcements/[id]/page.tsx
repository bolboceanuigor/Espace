'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArrowLeft, Edit3, Megaphone, Users } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import { announcementCategoryVariant, findAnnouncementById } from '@/lib/admin-mvp-data';

export default function AdminAnnouncementDetailsPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const announcement = findAnnouncementById(params?.id);

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/announcements`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la avizier
      </Link>

      <PageHeader
        title={announcement.title}
        description={`${announcement.category} · ${announcement.date}`}
        rightSlot={<Badge variant={announcement.status === 'Activ' ? 'success' : 'neutral'}>{announcement.status}</Badge>}
      />

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Categorie" value={announcement.category} description="Tip anunț" icon={<Megaphone className="h-5 w-5" />} tone={announcement.category === 'Urgent' ? 'danger' : 'neutral'} />
        <StatCard label="Audiență" value={announcement.audience} description="Cine vede anunțul" icon={<Users className="h-5 w-5" />} tone="success" />
        <StatCard label="Status" value={announcement.status} description="Stare publicare" icon={<Archive className="h-5 w-5" />} tone={announcement.status === 'Activ' ? 'success' : 'neutral'} />
      </section>

      <Card>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/${locale}/admin/announcements/${announcement.id}`} variant="secondary"><Edit3 className="h-4 w-4" /> Editează</ButtonLink>
          <ButtonLink href={`/${locale}/admin/announcements/${announcement.id}`} variant="secondary"><Archive className="h-4 w-4" /> Arhivează</ButtonLink>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={announcementCategoryVariant[announcement.category]}>{announcement.category}</Badge>
          <Badge variant={announcement.status === 'Activ' ? 'success' : 'neutral'}>{announcement.status}</Badge>
          <span className="text-sm text-muted-foreground">{announcement.date}</span>
        </div>
        <div className="mt-5 max-w-3xl space-y-4 text-sm leading-7 text-muted-foreground">
          <p>{announcement.content}</p>
          <p className="rounded-2xl border border-border/70 bg-muted/25 p-4">
            Audiență: <span className="font-semibold text-foreground">{announcement.audience}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
