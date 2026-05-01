'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Plus, ThumbsUp } from 'lucide-react';
import { roadmapApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const STATUSES = ['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'] as const;
const CATEGORIES = ['PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER'] as const;

export default function RoadmapPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'OTHER' as (typeof CATEGORIES)[number],
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await roadmapApi.list({
      status: (filters.status || undefined) as any,
      category: (filters.category || undefined) as any,
    });
    setItems(res.data || []);
  }, [filters.status, filters.category]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Lightbulb className="h-5 w-5" />
          Public roadmap
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Submit requests and vote for features that matter most.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <select className="input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select className="input" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Plus className="h-4 w-4" />
          Create feature request
        </p>
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-56"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as any }))}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              className="rounded-md border border-border/70 px-3 py-2 text-sm"
              disabled={submitting}
              onClick={async () => {
                if (!form.title.trim() || !form.description.trim()) return;
                setSubmitting(true);
                try {
                  await roadmapApi.create({
                    title: form.title.trim(),
                    description: form.description.trim(),
                    category: form.category,
                  });
                  setForm({ title: '', description: '', category: 'OTHER' });
                  await load();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const userVoted = !!item.votes?.length;
          return (
            <div key={item.id} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-border/70 px-2 py-1 text-xs text-muted-foreground">{item.status}</span>
                  <span className="rounded-lg border border-border/70 px-2 py-1 text-xs text-muted-foreground">{item.category}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-foreground">{item.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  by {item.createdBy?.firstName || item.createdBy?.role || 'User'} • {new Date(item.createdAt).toLocaleDateString()}
                </p>
                <button
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs ${
                    userVoted ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 text-foreground'
                  }`}
                  onClick={async () => {
                    if (!user?.id) return;
                    if (userVoted) {
                      await roadmapApi.unvote(item.id);
                    } else {
                      await roadmapApi.vote(item.id);
                    }
                    await load();
                  }}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {item._count?.votes || 0}
                </button>
              </div>
            </div>
          );
        })}
        {!items.length ? <p className="text-sm text-muted-foreground">No feature requests found.</p> : null}
      </div>
    </div>
  );
}
