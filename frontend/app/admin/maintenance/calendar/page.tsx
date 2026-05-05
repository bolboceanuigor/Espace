'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { adminStructureApi, maintenanceApi } from '@/lib/api';

const STATUS = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const TARGET_TYPES = ['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'] as const;

export default function AdminMaintenanceCalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetType: 'ORGANIZATION',
    buildingId: '',
    staircaseId: '',
    apartmentId: '',
    startsAt: '',
    endsAt: '',
    status: 'PLANNED',
    notifyResidents: true,
  });

  const load = useCallback(async () => {
    const [eventsRes, buildingsRes, apartmentsRes] = await Promise.all([
      maintenanceApi.eventsList({ status: status || undefined }),
      adminStructureApi.listBuildings(),
      adminStructureApi.listApartments(),
    ]);
    setEvents(eventsRes.data || []);
    setBuildings(buildingsRes.data || []);
    setApartments(apartmentsRes.data || []);
    const uniqueStaircases = new Map<string, any>();
    for (const apt of apartmentsRes.data || []) {
      if (apt.staircase?.id && !uniqueStaircases.has(apt.staircase.id)) {
        uniqueStaircases.set(apt.staircase.id, apt.staircase);
      }
    }
    setStaircases(Array.from(uniqueStaircases.values()));
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const event of events) {
      const dayKey = new Date(event.startsAt).toLocaleDateString();
      map.set(dayKey, [...(map.get(dayKey) || []), event]);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Maintenance calendar</h1>
          <p className="text-sm text-muted-foreground">Planned works and scheduled maintenance events.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/maintenance" className="rounded-md border border-border/70 px-3 py-2 text-sm">
            Tasks
          </Link>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New event
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Filters</p>
          <select className="select w-56" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {groupedByDay.map(([day, rows]) => (
          <div key={day} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-medium text-foreground">{day}</p>
            <div className="mt-2 space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">{row.title}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.status}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.targetType}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.startsAt).toLocaleString()}
                    {row.endsAt ? ` -> ${new Date(row.endsAt).toLocaleString()}` : ''}
                    {' • '}
                    {row.building?.name || row.staircase?.name || row.apartment?.number || '-'}
                  </p>
                  {row.description ? <p className="mt-1 text-sm text-muted-foreground">{row.description}</p> : null}
                  <div className="mt-2 flex gap-2 text-xs">
                    {row.status !== 'IN_PROGRESS' ? (
                      <button className="rounded-md border border-border/70 px-2 py-1" onClick={async () => { await maintenanceApi.eventsUpdate(row.id, { status: 'IN_PROGRESS' }); await load(); }}>
                        Start
                      </button>
                    ) : null}
                    {row.status !== 'COMPLETED' ? (
                      <button className="rounded-md border border-border/70 px-2 py-1" onClick={async () => { await maintenanceApi.eventsUpdate(row.id, { status: 'COMPLETED' }); await load(); }}>
                        Complete
                      </button>
                    ) : null}
                    <button className="rounded-md border border-border/70 px-2 py-1" onClick={async () => { await maintenanceApi.eventsDelete(row.id); await load(); }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!events.length ? <p className="text-sm text-muted-foreground">No maintenance events planned.</p> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border/70 bg-card p-4">
            <p className="text-base font-semibold text-foreground">Create maintenance event</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="input" placeholder="Title" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
              <select className="select" value={form.targetType} onChange={(event) => setForm((prev) => ({ ...prev, targetType: event.target.value }))}>
                {TARGET_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <textarea className="input min-h-[80px] md:col-span-2" placeholder="Description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              {form.targetType === 'BUILDING' ? (
                <select className="select" value={form.buildingId} onChange={(event) => setForm((prev) => ({ ...prev, buildingId: event.target.value }))}>
                  <option value="">Select building</option>
                  {buildings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {form.targetType === 'STAIRCASE' ? (
                <select className="select" value={form.staircaseId} onChange={(event) => setForm((prev) => ({ ...prev, staircaseId: event.target.value }))}>
                  <option value="">Select staircase</option>
                  {staircases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {form.targetType === 'APARTMENT' ? (
                <select className="select" value={form.apartmentId} onChange={(event) => setForm((prev) => ({ ...prev, apartmentId: event.target.value }))}>
                  <option value="">Select apartment</option>
                  {apartments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.building?.name} / {item.staircase?.name} / #{item.number}
                    </option>
                  ))}
                </select>
              ) : null}
              <input className="input" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))} />
              <input className="input" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))} />
              <select className="select" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                {STATUS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.notifyResidents} onChange={(event) => setForm((prev) => ({ ...prev, notifyResidents: event.target.checked }))} />
                Notify residents
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  await maintenanceApi.eventsCreate({
                    ...form,
                    buildingId: form.buildingId || undefined,
                    staircaseId: form.staircaseId || undefined,
                    apartmentId: form.apartmentId || undefined,
                    startsAt: new Date(form.startsAt).toISOString(),
                    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
                  });
                  setOpen(false);
                  setForm({
                    title: '',
                    description: '',
                    targetType: 'ORGANIZATION',
                    buildingId: '',
                    staircaseId: '',
                    apartmentId: '',
                    startsAt: '',
                    endsAt: '',
                    status: 'PLANNED',
                    notifyResidents: true,
                  });
                  await load();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
