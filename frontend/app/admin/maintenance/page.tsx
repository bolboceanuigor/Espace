'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminStructureApi, maintenanceApi, teamApi } from '@/lib/api';

const STATUS = ['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export default function AdminMaintenancePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', priority: '', assignedTo: '', buildingId: '' });
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'PLANNED',
    relatedIssueId: '',
    buildingId: '',
    staircaseId: '',
    assignedToUserId: '',
    priority: 'MEDIUM',
    scheduledAt: '',
  });

  const load = async () => {
    const [tasksRes, buildingsRes, teamRes] = await Promise.all([
      maintenanceApi.tasksList({
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        assignedTo: filters.assignedTo || undefined,
        buildingId: filters.buildingId || undefined,
      }),
      adminStructureApi.listBuildings(),
      teamApi.list(),
    ]);
    setRows(tasksRes.data || []);
    setBuildings(buildingsRes.data || []);
    setTeam((teamRes.data?.items || []).filter((x: any) => ['TECHNICIAN', 'MANAGER', 'ORG_ADMIN'].includes(x.role)));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [filters.status, filters.priority, filters.assignedTo, filters.buildingId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Maintenance tasks</h1>
        <Link href="/admin/maintenance/calendar" className="rounded-md border border-border/70 px-3 py-2 text-sm">
          Calendar view
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-4">
        <select className="select" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">All status</option>
          {STATUS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select className="select" value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}>
          <option value="">All priority</option>
          {PRIORITY.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select className="select" value={filters.assignedTo} onChange={(e) => setFilters((p) => ({ ...p, assignedTo: e.target.value }))}>
          <option value="">All assignees</option>
          {team.map((member: any) => (
            <option key={member.userId} value={member.userId}>{member.fullName || member.email}</option>
          ))}
        </select>
        <select className="select" value={filters.buildingId} onChange={(e) => setFilters((p) => ({ ...p, buildingId: e.target.value }))}>
          <option value="">All buildings</option>
          {buildings.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-3">
        <input className="input" placeholder="Task title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        <select className="select" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
          <option value="PLANNED">PLANNED</option>
          <option value="REACTIVE">REACTIVE</option>
        </select>
        <input className="input" placeholder="Related issue id (for reactive)" value={form.relatedIssueId} onChange={(e) => setForm((p) => ({ ...p, relatedIssueId: e.target.value }))} />
        <select className="select" value={form.buildingId} onChange={(e) => setForm((p) => ({ ...p, buildingId: e.target.value }))}>
          <option value="">Building</option>
          {buildings.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className="select" value={form.assignedToUserId} onChange={(e) => setForm((p) => ({ ...p, assignedToUserId: e.target.value }))}>
          <option value="">Assign to</option>
          {team.map((member: any) => (
            <option key={member.userId} value={member.userId}>{member.fullName || member.email}</option>
          ))}
        </select>
        <select className="select" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
          {PRIORITY.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <input className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))} />
        <button
          className="rounded-md border border-border/70 px-3 py-2 text-sm"
          onClick={async () => {
            await maintenanceApi.tasksCreate({
              ...form,
              relatedIssueId: form.relatedIssueId || undefined,
              buildingId: form.buildingId || undefined,
              assignedToUserId: form.assignedToUserId || undefined,
              scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
            });
            setForm({
              title: '',
              description: '',
              type: 'PLANNED',
              relatedIssueId: '',
              buildingId: '',
              staircaseId: '',
              assignedToUserId: '',
              priority: 'MEDIUM',
              scheduledAt: '',
            });
            await load();
          }}
        >
          Add task
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{row.title}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.status}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.priority}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.type}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.building?.name || '-'} · {row.assignedTo?.email || '-'} · {row.relatedIssue?.title || '-'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await maintenanceApi.tasksUpdate(row.id, { status: 'IN_PROGRESS' }); await load(); }}>
                Start
              </button>
              <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await maintenanceApi.tasksUpdate(row.id, { status: 'COMPLETED' }); await load(); }}>
                Complete
              </button>
              <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await maintenanceApi.tasksDelete(row.id); await load(); }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

