'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search, Siren, Wrench } from 'lucide-react';
import { Badge, Card, Input, PageHeader, StatCard } from '@/components/ui';
import {
  adminIssues,
  issuePriorityVariant,
  issueStatusVariant,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
} from '@/lib/admin-mvp-data';

const categories: Array<'Toate' | IssueCategory> = ['Toate', 'Apă', 'Încălzire', 'Curățenie', 'Lift', 'Reparații', 'Altele'];
const priorities: Array<'Toate' | IssuePriority> = ['Toate', 'Normal', 'Important', 'Urgent'];
const statuses: Array<'Toate' | IssueStatus> = ['Toate', 'Nouă', 'În lucru', 'Rezolvată'];

export default function AdminIssuesPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Toate' | IssueCategory>('Toate');
  const [priority, setPriority] = useState<'Toate' | IssuePriority>('Toate');
  const [status, setStatus] = useState<'Toate' | IssueStatus>('Toate');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return adminIssues.filter((item) => {
      const matchesQuery = !needle || `${item.title} ${item.apartment} ${item.category} ${item.resident} ${item.message}`.toLowerCase().includes(needle);
      const matchesCategory = category === 'Toate' || item.category === category;
      const matchesPriority = priority === 'Toate' || item.priority === priority;
      const matchesStatus = status === 'Toate' || item.status === status;
      return matchesQuery && matchesCategory && matchesPriority && matchesStatus;
    });
  }, [category, priority, query, status]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Cereri" description="Solicitări și intervenții pentru apartamente și spații comune." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cereri noi" value={adminIssues.filter((item) => item.status === 'Nouă').length} description="Așteaptă preluare" icon={<AlertCircle className="h-5 w-5" />} tone="warning" />
        <StatCard label="În lucru" value={adminIssues.filter((item) => item.status === 'În lucru').length} description="Urmărite activ" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Rezolvate" value={adminIssues.filter((item) => item.status === 'Rezolvată').length} description="Închise recent" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Urgente" value={adminIssues.filter((item) => item.priority === 'Urgent').length} description="Necesită atenție rapidă" icon={<Siren className="h-5 w-5" />} tone="danger" />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută titlu, apartament, locatar sau mesaj" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={category} onChange={(value) => setCategory(value as 'Toate' | IssueCategory)} options={categories} label="Categorie" />
          <Select value={priority} onChange={(value) => setPriority(value as 'Toate' | IssuePriority)} options={priorities} label="Prioritate" />
          <Select value={status} onChange={(value) => setStatus(value as 'Toate' | IssueStatus)} options={statuses} label="Status" />
        </div>
      </Card>

      <section className="grid gap-3">
        {filtered.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-foreground">{request.title}</h2>
                  <Badge variant={issuePriorityVariant[request.priority]}>{request.priority}</Badge>
                  <Badge variant={issueStatusVariant[request.status]}>{request.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {request.category} · {request.apartment} · {request.resident} · {request.date}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{request.message}</p>
              </div>
              <Link href={`/admin/issues/${request.id}`} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                Deschide
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.035)] outline-none focus:ring-2 focus:ring-foreground/10"
      >
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
