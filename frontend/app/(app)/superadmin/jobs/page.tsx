'use client';

import { useEffect, useState } from 'react';
import { schedulerApi } from '@/lib/api';

type JobRow = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  lastRunAt?: string | null;
};

export default function SuperadminJobsPage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await schedulerApi.superadminListJobs();
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const runNow = async (name: string) => {
    setRunning(name);
    try {
      await schedulerApi.superadminRunJob(name);
      await load();
    } finally {
      setRunning(null);
    }
  };

  const toggleStatus = async (row: JobRow) => {
    if (row.status === 'ACTIVE') await schedulerApi.superadminDisableJob(row.name);
    else await schedulerApi.superadminEnableJob(row.name);
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Scheduled Jobs</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-4 gap-2 border-b border-border/60 pb-2 text-xs text-muted-foreground">
          <span>Job name</span>
          <span>Status</span>
          <span>Last run</span>
          <span>Actions</span>
        </div>
        <div className="space-y-2 pt-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-4 gap-2 rounded-lg border border-border/60 px-2 py-2 text-sm text-foreground">
              <span>{row.name}</span>
              <span>{row.status}</span>
              <span>{row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : '-'}</span>
              <span className="flex gap-2">
                <button
                  className="rounded border px-2 py-1 text-xs"
                  disabled={running === row.name}
                  onClick={() => runNow(row.name)}
                >
                  {running === row.name ? 'Running...' : 'Run now'}
                </button>
                <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleStatus(row)}>
                  {row.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                </button>
              </span>
            </div>
          ))}
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        </div>
      </div>
    </div>
  );
}

