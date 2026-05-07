'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search, Siren, Wrench } from 'lucide-react';
import { Badge, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { issuesApi } from '@/lib/api';
import {
  adminIssues,
  issuePriorityVariant,
  issueStatusVariant,
  normalizeApiIssue,
  type AdminIssue,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
} from '@/lib/admin-mvp-data';
import { useLocalizedPath } from '@/lib/use-localized-path';

const categories: Array<'Toate' | IssueCategory> = ['Toate', 'Apă', 'Încălzire', 'Curățenie', 'Lift', 'Reparații', 'Altele'];
const priorities: Array<'Toate' | IssuePriority> = ['Toate', 'Normal', 'Important', 'Urgent'];
const statuses: Array<'Toate' | IssueStatus> = ['Toate', 'Nouă', 'În lucru', 'Rezolvată'];

export default function AdminIssuesPage() {
  const localizedPath = useLocalizedPath();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'Toate' | IssueCategory>('Toate');
  const [priority, setPriority] = useState<'Toate' | IssuePriority>('Toate');
  const [status, setStatus] = useState<'Toate' | IssueStatus>('Toate');
  const [rows, setRows] = useState<AdminIssue[]>([]);
  const [source, setSource] = useState<'loading' | 'api' | 'mock'>('loading');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const loadIssues = async () => {
    const res = await issuesApi.list();
    const apiRows = (res.data || []).map(normalizeApiIssue);
    setRows(apiRows);
    setSource('api');
  };

  useEffect(() => {
    let active = true;
    loadIssues().catch(() => {
        if (!active) return;
        setRows(adminIssues);
        setSource('mock');
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesQuery = !needle || `${item.title} ${item.apartment} ${item.category} ${item.resident} ${item.message}`.toLowerCase().includes(needle);
      const matchesCategory = category === 'Toate' || item.category === category;
      const matchesPriority = priority === 'Toate' || item.priority === priority;
      const matchesStatus = status === 'Toate' || item.status === status;
      return matchesQuery && matchesCategory && matchesPriority && matchesStatus;
    });
  }, [category, priority, query, rows, status]);

  const updateStatus = async (requestId: string, nextStatus: 'NEW' | 'IN_PROGRESS' | 'RESOLVED') => {
    setActionError('');
    setActionMessage('');
    setUpdatingId(requestId);
    try {
      const res = await issuesApi.updateStatus(requestId, nextStatus);
      const next = normalizeApiIssue(res.data);
      setRows((current) => current.map((item) => (item.id === requestId ? next : item)));
      setSource('api');
      setActionMessage('Statusul cererii a fost actualizat.');
      await loadIssues().catch(() => undefined);
    } catch {
      setActionError('Nu am putut actualiza statusul cererii.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Cereri"
        description="Solicitări și intervenții pentru apartamente și spații comune."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
          </span>
        }
      />

      {actionMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {actionMessage}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {actionError}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cereri noi" value={rows.filter((item) => item.status === 'Nouă').length} description="Așteaptă preluare" icon={<AlertCircle className="h-5 w-5" />} tone="warning" />
        <StatCard label="În lucru" value={rows.filter((item) => item.status === 'În lucru').length} description="Urmărite activ" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Rezolvate" value={rows.filter((item) => item.status === 'Rezolvată').length} description="Închise recent" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Urgente" value={rows.filter((item) => item.priority === 'Urgent').length} description="Necesită atenție rapidă" icon={<Siren className="h-5 w-5" />} tone="danger" />
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
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                <button type="button" onClick={() => updateStatus(request.id, request.status === 'Rezolvată' ? 'NEW' : 'IN_PROGRESS')} disabled={updatingId === request.id} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60">
                  {request.status === 'Rezolvată' ? 'Redeschide' : 'În lucru'}
                </button>
                <button type="button" onClick={() => updateStatus(request.id, 'RESOLVED')} disabled={updatingId === request.id} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60">
                  Rezolvată
                </button>
                <Link href={localizedPath(`/admin/issues/${request.id}`)} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
                  Deschide
                </Link>
              </div>
            </div>
          </Card>
        ))}
        {source === 'loading' ? <Card className="p-5 text-sm font-medium text-muted-foreground">Se încarcă datele...</Card> : null}
        {source !== 'loading' && !filtered.length ? <Card className="p-5 text-sm font-medium text-muted-foreground">Nu există cereri încă.</Card> : null}
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
