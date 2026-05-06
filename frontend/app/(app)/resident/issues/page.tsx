'use client';

import Link from 'next/link';
import { PlusCircle, Wrench } from 'lucide-react';
import { Badge, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import { residentIssues, residentIssuePriorityVariant, residentIssueStatusVariant } from '@/lib/resident-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function ResidentIssuesPage() {
  const active = residentIssues.filter((request) => request.status !== 'Rezolvată');
  const history = residentIssues.filter((request) => request.status === 'Rezolvată');

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Cereri"
        description="Trimite și urmărește solicitările pentru apartamentul tău."
        rightSlot={<ButtonLink href="/resident/issues/new"><PlusCircle className="h-4 w-4" /> Cerere nouă</ButtonLink>}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active" value={active.length} description="În atenția administrației" icon={<Wrench className="h-5 w-5" />} tone="warning" />
        <StatCard label="Noi" value={residentIssues.filter((item) => item.status === 'Nouă').length} description="Trimise recent" icon={<Wrench className="h-5 w-5" />} />
        <StatCard label="Rezolvate" value={history.length} description="Finalizate" icon={<Wrench className="h-5 w-5" />} tone="success" />
      </section>

      <Section title="Cereri active">
        {active.map((request) => <IssueCard key={request.id} request={request} />)}
      </Section>

      <Section title="Istoric cereri">
        {history.map((request) => <IssueCard key={request.id} request={request} />)}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-semibold text-foreground">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function IssueCard({ request }: { request: (typeof residentIssues)[number] }) {
  const localizedPath = useLocalizedPath();

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{request.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{request.category} · {request.date}</p>
        </div>
        <Badge variant={residentIssueStatusVariant[request.status]}>{request.status}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{request.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={residentIssuePriorityVariant[request.priority]}>{request.priority}</Badge>
        <Link href={localizedPath('/resident/chat')} className="inline-flex min-h-9 items-center rounded-xl border border-border/70 px-3 text-xs font-semibold hover:bg-muted/60">
          Mesaj
        </Link>
      </div>
    </Card>
  );
}
