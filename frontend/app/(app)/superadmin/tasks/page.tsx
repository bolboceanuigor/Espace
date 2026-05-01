'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { superadminApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type RelatedType = 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const RELATED_TYPES: RelatedType[] = ['ORGANIZATION', 'LEAD', 'DEMO_REQUEST', 'FEATURE_REQUEST', 'SUPPORT'];

export default function SuperadminTasksPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dueFilter, setDueFilter] = useState(
    searchParams?.get('due') === 'overdue' ? 'OVERDUE' : searchParams?.get('due') === 'today' ? 'TODAY' : '',
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    status: 'TODO' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    relatedType: '' as '' | RelatedType,
    relatedId: '',
    dueDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminApi.listTasks({
        priority: (priorityFilter || undefined) as any,
        dueFilter: (dueFilter || undefined) as any,
      });
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, dueFilter]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, any[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
      CANCELLED: [],
    };
    for (const item of items) map[item.status as TaskStatus].push(item);
    return map;
  }, [items]);

  const resetDraft = () =>
    setDraft({
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      relatedType: '',
      relatedId: '',
      dueDate: '',
    });

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Superadmin Task Board" subtitle="Track sales, support and product tasks with consistent workflow." />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2">
          <select className="input h-9 w-40" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select className="input h-9 w-40" value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
            <option value="">All due dates</option>
            <option value="OVERDUE">Overdue</option>
            <option value="TODAY">Due today</option>
            <option value="UPCOMING">Upcoming</option>
          </select>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Create task
          </Button>
        </div>
      </div>

      {loading ? <LoadingState label="Loading tasks..." rows={4} /> : null}

      {!loading ? <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {STATUSES.map((status) => (
          <div key={status} className="rounded-xl border border-border/70 bg-card p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {status} ({grouped[status].length})
            </p>
            <div className="mt-2 space-y-2">
              {grouped[status].map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="rounded-lg border border-border/60 p-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input className="input h-8 w-full" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
                        <textarea className="min-h-[80px] w-full rounded-md border border-border bg-background p-2 text-xs" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <select className="input h-8" value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}>
                            {STATUSES.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                          <select className="input h-8" value={draft.priority} onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}>
                            {PRIORITIES.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                          <select className="input h-8" value={draft.relatedType} onChange={(e) => setDraft((prev) => ({ ...prev, relatedType: e.target.value as any }))}>
                            <option value="">No related type</option>
                            {RELATED_TYPES.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                          <input className="input h-8" placeholder="Related ID" value={draft.relatedId} onChange={(e) => setDraft((prev) => ({ ...prev, relatedId: e.target.value }))} />
                          <input type="datetime-local" className="input h-8 col-span-2" value={draft.dueDate} onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                            onClick={async () => {
                              if (!draft.title.trim()) return;
                              await superadminApi.updateTask(item.id, {
                                title: draft.title.trim(),
                                description: draft.description.trim() || undefined,
                                status: draft.status,
                                priority: draft.priority,
                                relatedType: (draft.relatedType || undefined) as any,
                                relatedId: draft.relatedId.trim() || undefined,
                                dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : undefined,
                              });
                              setEditingId(null);
                              resetDraft();
                              await load();
                            }}
                          >
                            Save
                          </button>
                          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={() => { setEditingId(null); resetDraft(); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <StatusBadge status={item.priority} />
                        </div>
                        {item.description ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p> : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {item.dueDate ? <span>Due: {new Date(item.dueDate).toLocaleString()}</span> : null}
                          {item.relatedType ? <span>{item.relatedType}</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.status !== 'DONE' ? (
                            <Button size="sm" variant="secondary" onClick={async () => { await superadminApi.updateTask(item.id, { status: 'DONE' }); await load(); showToast('Salvat cu succes'); }}>
                              Mark done
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(item.id);
                              setDraft({
                                title: item.title || '',
                                description: item.description || '',
                                status: item.status || 'TODO',
                                priority: item.priority || 'MEDIUM',
                                relatedType: item.relatedType || '',
                                relatedId: item.relatedId || '',
                                dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : '',
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={async () => { if (!window.confirm('Sigur ștergi task-ul?')) return; await superadminApi.deleteTask(item.id); await load(); showToast('Salvat cu succes'); }}>
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {!grouped[status].length ? <EmptyState title="Nu există date încă" description="Adaugă primul task în această coloană." /> : null}
            </div>
          </div>
        ))}
      </div> : null}

      {showCreate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-xl rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-medium text-foreground">Create task</p>
            <div className="mt-3 space-y-2">
              <input className="input w-full" placeholder="Title" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
              <textarea className="min-h-[100px] w-full rounded-md border border-border bg-background p-3 text-sm" placeholder="Description" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input h-9" value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}>
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select className="input h-9" value={draft.priority} onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}>
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select className="input h-9" value={draft.relatedType} onChange={(e) => setDraft((prev) => ({ ...prev, relatedType: e.target.value as any }))}>
                  <option value="">No related type</option>
                  {RELATED_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <input className="input h-9" placeholder="Related ID" value={draft.relatedId} onChange={(e) => setDraft((prev) => ({ ...prev, relatedId: e.target.value }))} />
                <input type="datetime-local" className="input h-9 col-span-2" value={draft.dueDate} onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); resetDraft(); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!draft.title.trim()) {
                    showToast('Titlul este obligatoriu.', 'error');
                    return;
                  }
                  try {
                    await superadminApi.createTask({
                      title: draft.title.trim(),
                      description: draft.description.trim() || undefined,
                      status: draft.status,
                      priority: draft.priority,
                      relatedType: (draft.relatedType || undefined) as any,
                      relatedId: draft.relatedId.trim() || undefined,
                      dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : undefined,
                    });
                    setShowCreate(false);
                    resetDraft();
                    await load();
                    showToast('Salvat cu succes');
                  } catch {
                    showToast('Eroare la salvare', 'error');
                  }
                }}
              >
                Save task
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
