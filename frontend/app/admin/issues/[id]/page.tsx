'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, MessageCircle, StickyNote, Wrench } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import { issuesApi } from '@/lib/api';
import { findIssueById, issuePriorityVariant, issueStatusVariant, normalizeApiIssue, type AdminIssue } from '@/lib/admin-mvp-data';

export default function AdminIssueDetailsPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const fallback = useMemo(() => findIssueById(params?.id), [params?.id]);
  const [issue, setIssue] = useState<AdminIssue>(fallback);
  const [source, setSource] = useState<'api' | 'mock'>('mock');

  useEffect(() => {
    let active = true;
    if (!params?.id) return undefined;
    issuesApi
      .get(params.id)
      .then((res) => {
        if (!active) return;
        setIssue(normalizeApiIssue(res.data));
        setSource('api');
      })
      .catch(() => {
        if (!active) return;
        setIssue(fallback);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, [fallback, params?.id]);

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/issues`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la cereri
      </Link>

      <PageHeader
        title={issue.title}
        description={`${issue.category} · ${issue.apartment} · ${issue.resident}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date demo'}
            </span>
            <Badge variant={issueStatusVariant[issue.status]}>{issue.status}</Badge>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Prioritate" value={issue.priority} description="Nivel de intervenție" icon={<Wrench className="h-5 w-5" />} tone={issue.priority === 'Urgent' ? 'danger' : issue.priority === 'Important' ? 'warning' : 'neutral'} />
        <StatCard label="Status" value={issue.status} description="Flux administrativ" icon={<Clock3 className="h-5 w-5" />} tone={issue.status === 'Rezolvată' ? 'success' : 'warning'} />
        <StatCard label="Apartament" value={issue.apartment} description={issue.resident} icon={<MessageCircle className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Data" value={issue.date} description="Data raportării" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>

      <Card>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/${locale}/admin/issues/${issue.id}`} variant="secondary"><Clock3 className="h-4 w-4" /> Marchează în lucru</ButtonLink>
          <ButtonLink href={`/${locale}/admin/issues/${issue.id}`} variant="secondary"><CheckCircle2 className="h-4 w-4" /> Marchează rezolvată</ButtonLink>
          <ButtonLink href={`/${locale}/admin/chat`} variant="primary"><MessageCircle className="h-4 w-4" /> Scrie locatarului</ButtonLink>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <SectionTitle icon={<Wrench className="h-5 w-5" />} title="Descriere" description="Detalii primite de la locatar." />
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{issue.category}</Badge>
            <Badge variant={issuePriorityVariant[issue.priority]}>{issue.priority}</Badge>
            <Badge variant={issueStatusVariant[issue.status]}>{issue.status}</Badge>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{issue.description}</p>
        </Card>

        <Card>
          <SectionTitle icon={<StickyNote className="h-5 w-5" />} title="Note interne" description="Vizibile doar pentru administratori." />
          <div className="space-y-3">
            {issue.internalNotes.map((note) => (
              <p key={note} className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">{note}</p>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <SectionTitle icon={<Clock3 className="h-5 w-5" />} title="Timeline / activitate" description="Evoluția cererii în timp." />
        <div className="space-y-3">
          {issue.timeline.map((entry) => (
            <div key={`${entry.title}-${entry.date}`} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-foreground">{entry.title}</p>
                <p className="text-xs text-muted-foreground">{entry.date}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
