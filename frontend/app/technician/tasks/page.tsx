'use client';

import { useEffect, useState } from 'react';
import { maintenanceApi } from '@/lib/api';

const STATUS = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export default function TechnicianTasksPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const res = await maintenanceApi.technicianTasks();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">My technician tasks</h1>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{row.title}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.status}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.priority}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.building?.name || '-'} · {row.staircase?.name || '-'} · {row.relatedIssue?.title || '-'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUS.map((status) => (
                <button
                  key={status}
                  className="rounded-md border border-border/70 px-2 py-1 text-xs"
                  onClick={async () => {
                    await maintenanceApi.technicianUpdateTask(row.id, { status });
                    await load();
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

