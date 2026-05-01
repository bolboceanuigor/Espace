'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Wrench } from 'lucide-react';
import { maintenanceApi } from '@/lib/api';

export default function ResidentMaintenancePage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const response = await maintenanceApi.residentEventsList();
    setRows(response.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Planned works</h1>
        <p className="text-sm text-muted-foreground">Scheduled maintenance relevant for your building/staircase/apartment.</p>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-foreground">{row.title}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              {new Date(row.startsAt).toLocaleString()}
              {row.endsAt ? ` -> ${new Date(row.endsAt).toLocaleString()}` : ''}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Scope: {row.targetType}
              {row.building?.name ? ` • ${row.building.name}` : ''}
              {row.staircase?.name ? ` • ${row.staircase.name}` : ''}
              {row.apartment?.number ? ` • Ap. ${row.apartment.number}` : ''}
            </p>
            {row.description ? <p className="mt-2 text-sm text-muted-foreground">{row.description}</p> : null}
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-muted-foreground">Nu exista lucrari planificate.</p> : null}
      </div>
    </div>
  );
}
