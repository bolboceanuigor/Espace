'use client';

import { useEffect, useMemo, useState } from 'react';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';

type SmokeStatus = 'NOT_TESTED' | 'PASSED' | 'FAILED';

type SmokeItem = {
  key: string;
  group: 'Navigation' | 'Auth' | 'Admin core flow' | 'Resident core flow';
  title: string;
  status: SmokeStatus;
  notes: string;
  lastTestedAt: string | null;
};

const STORAGE_KEY = 'superadmin_smoke_test_v1';

const DEFAULT_ITEMS: SmokeItem[] = [
  { key: 'nav-admin-menu', group: 'Navigation', title: 'Admin menu works', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'nav-resident-menu', group: 'Navigation', title: 'Resident menu works', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'nav-superadmin-menu', group: 'Navigation', title: 'Superadmin menu works', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'nav-mobile-bottom', group: 'Navigation', title: 'Mobile bottom nav works', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'nav-more-menu', group: 'Navigation', title: 'More menu works', status: 'NOT_TESTED', notes: '', lastTestedAt: null },

  { key: 'auth-superadmin-login', group: 'Auth', title: 'Superadmin login', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'auth-admin-login', group: 'Auth', title: 'Admin login', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'auth-resident-login', group: 'Auth', title: 'Resident login', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'auth-role-redirect', group: 'Auth', title: 'Role redirect', status: 'NOT_TESTED', notes: '', lastTestedAt: null },

  { key: 'admin-create-building', group: 'Admin core flow', title: 'Create building', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-create-staircase', group: 'Admin core flow', title: 'Create staircase', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-create-apartment', group: 'Admin core flow', title: 'Create apartment', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-create-resident', group: 'Admin core flow', title: 'Create resident', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-create-tariff', group: 'Admin core flow', title: 'Create tariff', status: 'NOT_TESTED', notes: 'Pending dedicated backend tariff CRUD.', lastTestedAt: null },
  { key: 'admin-generate-charges', group: 'Admin core flow', title: 'Generate charges', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-generate-invoice', group: 'Admin core flow', title: 'Generate invoice', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-record-payment', group: 'Admin core flow', title: 'Record payment', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-create-announcement', group: 'Admin core flow', title: 'Create announcement', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-create-issue', group: 'Admin core flow', title: 'Create issue', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'admin-send-chat', group: 'Admin core flow', title: 'Send chat message', status: 'NOT_TESTED', notes: '', lastTestedAt: null },

  { key: 'resident-view-dashboard', group: 'Resident core flow', title: 'View dashboard', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'resident-view-invoice', group: 'Resident core flow', title: 'View invoice', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'resident-view-payments', group: 'Resident core flow', title: 'View payment history', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'resident-create-issue', group: 'Resident core flow', title: 'Create issue', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'resident-send-chat', group: 'Resident core flow', title: 'Send chat message', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
  { key: 'resident-view-announcement', group: 'Resident core flow', title: 'View announcement', status: 'NOT_TESTED', notes: '', lastTestedAt: null },
];

const GROUP_ORDER: Array<SmokeItem['group']> = ['Navigation', 'Auth', 'Admin core flow', 'Resident core flow'];

export default function SuperadminSmokeTestPage() {
  const [items, setItems] = useState<SmokeItem[]>(DEFAULT_ITEMS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SmokeItem[];
      const byKey = new Map(parsed.map((entry) => [entry.key, entry]));
      const merged = DEFAULT_ITEMS.map((entry) => byKey.get(entry.key) || entry);
      setItems(merged);
    } catch {
      setItems(DEFAULT_ITEMS);
    }
  }, []);

  const persist = (next: SmokeItem[]) => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const grouped = useMemo(() => {
    const map = new Map<SmokeItem['group'], SmokeItem[]>();
    for (const group of GROUP_ORDER) map.set(group, []);
    for (const item of items) map.get(item.group)?.push(item);
    return map;
  }, [items]);

  const stats = useMemo(() => {
    const passed = items.filter((item) => item.status === 'PASSED').length;
    const failed = items.filter((item) => item.status === 'FAILED').length;
    const notTested = items.filter((item) => item.status === 'NOT_TESTED').length;
    const progress = items.length ? Math.round((passed / items.length) * 100) : 0;
    return { passed, failed, notTested, progress };
  }, [items]);

  const updateStatus = (key: string, status: SmokeStatus) => {
    const next = items.map((item) =>
      item.key === key ? { ...item, status, lastTestedAt: new Date().toISOString() } : item,
    );
    persist(next);
  };

  const updateNotes = (key: string, notes: string) => {
    const next = items.map((item) => (item.key === key ? { ...item, notes } : item));
    persist(next);
  };

  const resetAll = () => {
    persist(DEFAULT_ITEMS);
  };

  if (!items.length) {
    return <EmptyState title="No smoke tests configured" description="Smoke test definitions are missing." />;
  }

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader
        title="Smoke Test"
        subtitle="Validate navigation and core role flows end-to-end without dead ends."
      />

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{stats.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${stats.progress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">Passed: {stats.passed}</span>
          <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">Failed: {stats.failed}</span>
          <span className="rounded-md border border-border/70 bg-background px-2 py-1 text-muted-foreground">Not tested: {stats.notTested}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={resetAll}>
          Reset checklist
        </Button>
      </div>

      {GROUP_ORDER.map((group) => (
        <section key={group} className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">{group}</h2>
          <div className="mt-3 space-y-3">
            {grouped.get(group)?.map((item) => (
              <div key={item.key} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <StatusBadge status={item.status} />
                </div>
                <textarea
                  className="mt-2 min-h-[70px] w-full rounded-md border border-border bg-background p-2 text-sm"
                  placeholder="Test notes"
                  value={item.notes}
                  onChange={(event) => updateNotes(item.key, event.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(item.key, 'PASSED')}>
                    Mark passed
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => updateStatus(item.key, 'FAILED')}>
                    Mark failed
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(item.key, 'NOT_TESTED')}>
                    Mark not tested
                  </Button>
                </div>
                {item.lastTestedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last tested: {new Date(item.lastTestedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
