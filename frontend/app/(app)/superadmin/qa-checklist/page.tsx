'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { superadminApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

type QACheckStatus = 'NOT_TESTED' | 'PASSED' | 'FAILED';

type QACheck = {
  id: string;
  key: string;
  section: string;
  title: string;
  status: QACheckStatus;
  notes: string | null;
  lastTestedAt: string | null;
  testedByUserId: string | null;
  testedByUser?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
};

const SECTION_ORDER = [
  'Authentication',
  'Organization flow',
  'Admin setup flow',
  'Financial flow',
  'Resident flow',
  'Admin operations',
  'Security checks',
  'Mobile checks',
  'Automation checks',
  'Error handling',
];

export default function SuperadminQAChecklistPage() {
  const { showToast } = useToast();
  const [checks, setChecks] = useState<QACheck[]>([]);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminApi.listQAChecklist();
      const list = (res.data || []) as QACheck[];
      setChecks(list);
      setNotesDraft(
        list.reduce<Record<string, string>>((acc, item) => {
          acc[item.id] = item.notes || '';
          return acc;
        }, {}),
      );
    } catch {
      showToast('Eroare la încărcarea checklist-ului QA', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, QACheck[]>();
    for (const section of SECTION_ORDER) {
      map.set(section, []);
    }
    for (const check of checks) {
      if (!map.has(check.section)) {
        map.set(check.section, []);
      }
      map.get(check.section)!.push(check);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [checks]);

  const progress = useMemo(() => {
    if (!checks.length) return 0;
    const passedCount = checks.filter((item) => item.status === 'PASSED').length;
    return Math.round((passedCount / checks.length) * 100);
  }, [checks]);

  const saveStatus = async (id: string, status: QACheckStatus) => {
    setSavingId(id);
    try {
      const payload = {
        status,
        notes: (notesDraft[id] || '').trim(),
      };
      const res = await superadminApi.updateQACheck(id, payload);
      const updated = res.data as QACheck;
      setChecks((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setNotesDraft((prev) => ({ ...prev, [id]: updated.notes || '' }));
      showToast('Salvat cu succes');
    } catch {
      showToast('Eroare la salvare', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <MobilePageHeader
        title="QA Checklist"
        subtitle="Validation end-to-end pentru beta launch, doar pentru SUPER_ADMIN."
      />

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {loading ? <LoadingState label="Se încarcă checklist-ul QA..." rows={6} /> : null}

      {!loading && checks.length === 0 ? (
        <EmptyState title="Nu există date încă" description="Checklist-ul QA nu este disponibil momentan." />
      ) : null}

      {!loading ? (
        <div className="space-y-4">
          {grouped.map(([section, items]) => (
            <section key={section} className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">{section}</h2>
              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <textarea
                      className="mt-2 min-h-[80px] w-full rounded-md border border-border bg-background p-2 text-sm"
                      placeholder="Note de test (opțional)"
                      value={notesDraft[item.id] ?? ''}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={savingId === item.id}
                        onClick={() => saveStatus(item.id, 'PASSED')}
                      >
                        Mark passed
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        isLoading={savingId === item.id}
                        onClick={() => saveStatus(item.id, 'FAILED')}
                      >
                        Mark failed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={savingId === item.id}
                        onClick={() => saveStatus(item.id, 'NOT_TESTED')}
                      >
                        Reset
                      </Button>
                    </div>
                    {(item.lastTestedAt || item.testedByUser?.email) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last tested:{' '}
                        {item.lastTestedAt ? new Date(item.lastTestedAt).toLocaleString() : 'n/a'} by{' '}
                        {item.testedByUser?.email || 'n/a'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
