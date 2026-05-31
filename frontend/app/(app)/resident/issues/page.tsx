'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Wrench } from 'lucide-react';
import { ButtonLink, Card, PageHeader, StatCard, StatusBadge } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { normalizeResidentIssue, ResidentIssueStatus, ResidentIssuePriority } from '@/lib/resident-mvp-data';

const issueStatusToStatusBadge: Record<ResidentIssueStatus, 'pending' | 'active' | 'paid'> = {
  'Nouă': 'pending',
  'În lucru': 'active',
  'Rezolvată': 'paid',
};

const issuePriorityToStatusBadge: Record<ResidentIssuePriority, 'draft' | 'partial' | 'overdue'> = {
  'Normal': 'draft',
  'Important': 'partial',
  'Urgent': 'overdue',
};
import { useLocalizedPath } from '@/lib/use-localized-path';

type ResidentIssue = ReturnType<typeof normalizeResidentIssue>;

export default function ResidentIssuesPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<ResidentIssue[]>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'error'>('loading');
  const active = rows.filter((request) => request.status !== 'Rezolvată');
  const history = rows.filter((request) => request.status === 'Rezolvată');

  useEffect(() => {
    let activeRequest = true;
    residentDemoApi
      .issues()
      .then((res) => {
        if (!activeRequest) return;
        const apiRows = (res.data || []).map(normalizeResidentIssue);
        setRows(apiRows);
        setSource('api');
      })
      .catch(() => {
        if (!activeRequest) return;
        setRows([]);
        setSource('error');
      });
    return () => {
      activeRequest = false;
    };
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Cereri"
        description="Trimite și urmărește solicitările pentru apartamentul tău."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'API indisponibil'}
            </span>
            <ButtonLink href={localizedPath('/resident/issues/new')}><PlusCircle className="h-4 w-4" /> Cerere nouă</ButtonLink>
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active" value={active.length} description="În atenția administrației" icon={<Wrench className="h-5 w-5" />} tone="warning" />
        <StatCard label="Noi" value={rows.filter((item) => item.status === 'Nouă').length} description="Trimise recent" icon={<Wrench className="h-5 w-5" />} />
        <StatCard label="Rezolvate" value={history.length} description="Finalizate" icon={<Wrench className="h-5 w-5" />} tone="success" />
      </section>

      <Section title="Cereri active">
        {active.map((request) => <IssueCard key={request.id} request={request} />)}
        {!active.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">{source === 'loading' ? 'Se încarcă datele...' : 'Nu ai cereri active.'}</Card> : null}
      </Section>

      <Section title="Istoric cereri">
        {history.map((request) => <IssueCard key={request.id} request={request} />)}
        {!history.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">{source === 'loading' ? 'Se încarcă datele...' : 'Nu există cereri încă. Trimite prima cerere către administrator.'}</Card> : null}
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

function IssueCard({ request }: { request: ResidentIssue }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{request.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{request.category} · {request.date}</p>
        </div>
        <StatusBadge status={request.status === 'Rezolvată' ? 'RESOLVED' : request.status === 'În lucru' ? 'IN_PROGRESS' : 'NEW'} label={request.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{request.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={request.priority === 'Urgent' ? 'URGENT' : request.priority === 'Important' ? 'WARNING' : 'INFO'} label={request.priority} />
      </div>
    </Card>
  );
}
