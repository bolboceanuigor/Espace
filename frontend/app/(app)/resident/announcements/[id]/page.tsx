'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Megaphone, Paperclip, Tag } from 'lucide-react';
import { Card } from '@/components/ui';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { communicationsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categoryLabels: Record<string, string> = {
  GENERAL: 'General',
  MAINTENANCE: 'Mentenanță',
  PAYMENTS: 'Plăți',
  EMERGENCY: 'Urgență',
  MEETING: 'Ședință',
  DOCUMENTS: 'Documente',
  OTHER: 'Altul',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Importantă',
  URGENT: 'Urgentă',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function ResidentAnnouncementDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await communicationsApi.getResidentAnnouncement(params.id);
      setData(response.data || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca anunțul.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Se încarcă anunțul..." />;
  if (error) {
    return (
      <div className="space-y-4 pb-24 md:pb-4">
        <MobilePageHeader title="Avizier" subtitle="Detalii anunț" showBackButton />
        <EmptyState title="Anunțul nu este disponibil" description={error} />
      </div>
    );
  }

  const announcement = data?.announcement;
  if (!announcement) {
    return (
      <div className="space-y-4 pb-24 md:pb-4">
        <MobilePageHeader title="Avizier" subtitle="Detalii anunț" showBackButton />
        <EmptyState title="Anunțul nu este disponibil" description="Anunțul nu există sau nu aparține contului tău." />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden pb-24 md:pb-6">
      <MobilePageHeader title="Avizier" subtitle="Detalii anunț" showBackButton />

      <Card className={`p-5 ${announcement.priority === 'URGENT' ? 'border-rose-200 bg-rose-50/35' : announcement.priority === 'HIGH' ? 'border-amber-200 bg-amber-50/35' : ''}`}>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            {categoryLabels[announcement.category] || announcement.category}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5" />
            {priorityLabels[announcement.priority] || announcement.priority}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(announcement.publishedAt || announcement.createdAt)}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{announcement.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.association?.shortName || announcement.association?.shortName || 'A.P.C.'}
        </p>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground">{announcement.body || announcement.content}</div>

        <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-white/70 p-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Atașamentele vor fi disponibile ulterior.
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="text-xs font-semibold text-muted-foreground">
            {announcement.isRead ? 'Marcat ca citit' : 'Se marchează ca citit la deschidere'}
          </span>
          <Link href={localizedPath('/resident/announcements')} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la avizier
          </Link>
        </div>
      </Card>
    </div>
  );
}
