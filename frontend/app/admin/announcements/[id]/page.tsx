'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Archive, Copy, Eye, Megaphone, Pencil, Users } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
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

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Programat',
  PUBLISHED: 'Publicat',
  ARCHIVED: 'Arhivat',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminAnnouncementDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await communicationsApi.getAdminAnnouncement(params.id);
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

  const announcement = data?.announcement;
  const readStats = data?.readStats || {};

  const publish = async () => {
    await communicationsApi.publishAdminAnnouncement(params.id);
    await load();
  };

  const archive = async () => {
    await communicationsApi.archiveAdminAnnouncement(params.id);
    await load();
  };

  const duplicate = async () => {
    const response = await communicationsApi.duplicateAdminAnnouncement(params.id);
    router.push(localizedPath(`/admin/announcements/${response.data?.id}`));
  };

  if (loading) return <LoadingState label="Se încarcă anunțul..." />;
  if (error) return <EmptyState title="Anunțul nu a fost găsit" description={error} />;
  if (!announcement) return <EmptyState title="Anunțul nu a fost găsit" description="Reveniți la lista de anunțuri." />;

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title={announcement.title}
        description="Detalii anunț, vizibilitate și preview pentru locatar."
        rightSlot={
          <div className="flex flex-wrap justify-end gap-2">
            <Link href={localizedPath('/admin/announcements')} className="inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
              Înapoi la listă
            </Link>
            {announcement.status !== 'ARCHIVED' ? (
              <Link href={localizedPath(`/admin/announcements/${announcement.id}/edit`)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
                <Pencil className="h-4 w-4" />
                Editează
              </Link>
            ) : null}
            {announcement.status !== 'PUBLISHED' && announcement.status !== 'ARCHIVED' ? (
              <button type="button" onClick={() => publish().catch(() => undefined)} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
                <Megaphone className="h-4 w-4" />
                Publică
              </button>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Status" value={statusLabels[announcement.status] || announcement.status} />
        <StatCard label="Locatari vizați" value={readStats.targetedResidents || 0} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Citiri" value={readStats.readCount || 0} icon={<Eye className="h-5 w-5" />} />
        <StatCard label="Rată citire" value={`${readStats.readRate || 0}%`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <BadgeText>{categoryLabels[announcement.category] || announcement.category}</BadgeText>
            <BadgeText>{priorityLabels[announcement.priority] || announcement.priority}</BadgeText>
            <BadgeText>{announcement.pinned ? 'Fixat sus' : 'Nefixat'}</BadgeText>
            <BadgeText>{announcement.visibleToResidents ? 'Vizibil locatarilor' : 'Ascuns locatarilor'}</BadgeText>
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
            {announcement.body}
          </div>
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
            Atașamentele nu sunt conectate în acest task.
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3 p-4 text-sm">
            <Info label="APC" value={data?.association?.shortName || 'A.P.C.'} />
            <Info label="Vizibilitate" value={announcement.audience || announcement.visibilityType} />
            <Info label="Publicare" value={formatDate(announcement.publishedAt || announcement.publishAt)} />
            <Info label="Expirare" value={formatDate(announcement.expiresAt)} />
            <Info label="Autor" value={announcement.createdBy?.name || 'Administrator'} />
            <Info label="Ultima actualizare" value={formatDate(announcement.updatedAt)} />
          </Card>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold text-foreground">Preview locatar</p>
            <div className="rounded-2xl border border-border/70 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avizier</p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">{announcement.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{announcement.excerpt || announcement.preview}</p>
            </div>
          </Card>

          <Card className="space-y-2 p-4">
            <button type="button" onClick={() => duplicate().catch(() => undefined)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            {announcement.status !== 'ARCHIVED' ? (
              <button type="button" onClick={() => archive().catch(() => undefined)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
                <Archive className="h-4 w-4" />
                Arhivează
              </button>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function BadgeText({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">{children}</span>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value || '—'}</span>
    </div>
  );
}
