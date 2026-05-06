'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Filter, Building2, AlertCircle, Lightbulb, HelpCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui';
import { feedbackApi, superadminApi } from '@/lib/api';

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  BUG: { label: 'Bug', icon: AlertCircle, color: 'bg-red-50 text-red-700' },
  IDEA: { label: 'Idee', icon: Lightbulb, color: 'bg-amber-50 text-amber-700' },
  QUESTION: { label: 'Intrebare', icon: HelpCircle, color: 'bg-blue-50 text-blue-700' },
  COMPLAINT: { label: 'Reclamatie', icon: AlertTriangle, color: 'bg-orange-50 text-orange-700' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Nou', color: 'bg-blue-50 text-blue-700' },
  REVIEWED: { label: 'Revizuit', color: 'bg-purple-50 text-purple-700' },
  IN_PROGRESS: { label: 'In lucru', color: 'bg-cyan-50 text-cyan-700' },
  RESOLVED: { label: 'Rezolvat', color: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Respins', color: 'bg-red-50 text-red-700' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Scazuta', color: 'bg-slate-50 text-slate-700' },
  MEDIUM: { label: 'Medie', color: 'bg-amber-50 text-amber-700' },
  HIGH: { label: 'Ridicata', color: 'bg-red-50 text-red-700' },
};

export default function SuperadminFeedbackPage() {
  const [items, setItems] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    organizationId: '',
    type: '',
    status: '',
    priority: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, orgRes] = await Promise.all([
        feedbackApi.superadminList({
          organizationId: filters.organizationId || undefined,
          type: (filters.type as any) || undefined,
          status: (filters.status as any) || undefined,
          priority: (filters.priority as any) || undefined,
        }),
        superadminApi.listOrgs(),
      ]);
      setItems(res.data || []);
      setOrgs(orgRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [filters.organizationId, filters.type, filters.status, filters.priority]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback global</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toate mesajele de feedback de la utilizatori, organizate dupa prioritate si status.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Filter className="hidden h-4 w-4 text-muted-foreground lg:block" />
          <select 
            className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
            value={filters.organizationId} 
            onChange={(e) => setFilters((p) => ({ ...p, organizationId: e.target.value }))}
          >
            <option value="">Toate organizatiile</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <select 
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
            value={filters.type} 
            onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
          >
            <option value="">Toate tipurile</option>
            {Object.entries(typeConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select 
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
            value={filters.status} 
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">Toate statusurile</option>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select 
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-foreground/20" 
            value={filters.priority} 
            onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}
          >
            <option value="">Toate prioritatile</option>
            {Object.entries(priorityConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Se incarca feedback-ul...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <Card className="py-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-foreground">Niciun feedback gasit</p>
          <p className="mt-1 text-sm text-muted-foreground">Modifica filtrele pentru a vedea mai multe rezultate.</p>
        </Card>
      )}

      {/* Feedback List */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const TypeIcon = typeConfig[item.type]?.icon || MessageSquare;
            return (
              <Card key={item.id} className="p-5 transition hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left content */}
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeConfig[item.type]?.color || 'bg-muted'}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${typeConfig[item.type]?.color || 'bg-muted'}`}>
                          {typeConfig[item.type]?.label || item.type}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.message}</p>
                      {item.pageUrl && (
                        <p className="mt-1 text-xs text-muted-foreground">Pagina: {item.pageUrl}</p>
                      )}
                      {item.organization?.name && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {item.organization.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right controls */}
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <select
                        className="h-9 rounded-lg border border-border bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-foreground/20"
                        value={item.status}
                        onChange={async (e) => {
                          await feedbackApi.superadminUpdate(item.id, { status: e.target.value as any });
                          await load();
                        }}
                      >
                        {Object.entries(statusConfig).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-muted-foreground">Prioritate</label>
                      <select
                        className="h-9 rounded-lg border border-border bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-foreground/20"
                        value={item.priority}
                        onChange={async (e) => {
                          await feedbackApi.superadminUpdate(item.id, { priority: e.target.value as any });
                          await load();
                        }}
                      >
                        {Object.entries(priorityConfig).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
