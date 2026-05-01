'use client';

import { useEffect, useState } from 'react';
import { issuesApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button, { ButtonLink } from '@/components/ui/Button';
import LoadingState from '@/components/common/LoadingState';
import { useToast } from '@/components/ui/ToastProvider';

export default function AdminIssuesPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const res = await issuesApi.adminList({
        status: (filters.status || undefined) as any,
        category: (filters.category || undefined) as any,
        priority: (filters.priority || undefined) as any,
        page,
        limit: 12,
      });
      setRows((res.data as any)?.data || []);
      setTotalPages((res.data as any)?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [filters.status, filters.category, filters.priority, page]);

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Issue management" subtitle="Monitor and update resident reports quickly." />
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-3">
        <select className="select" value={filters.status} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, status: e.target.value })); }}>
          <option value="">Toate statusurile</option>
          {['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className="select" value={filters.priority} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, priority: e.target.value })); }}>
          <option value="">Toate prioritatile</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className="select" value={filters.category} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, category: e.target.value })); }}>
          <option value="">Toate categoriile</option>
          {['WATER', 'ELECTRICITY', 'ELEVATOR', 'CLEANING', 'HEATING', 'SECURITY', 'OTHER'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>
      {loading ? <LoadingState label="Se încarcă sesizările..." rows={4} /> : null}

      {!loading ? <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{row.title}</p>
              <StatusBadge status={row.status} />
              <StatusBadge status={row.priority === 'URGENT' ? 'ERROR' : 'INFO'} className="uppercase" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.category} • {row.locationType} • {row.createdBy?.email || '-'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={async () => {
                await issuesApi.adminUpdate(row.id, { status: 'IN_PROGRESS' });
                await load();
                showToast('Salvat cu succes');
              }}>
                Mark in progress
              </Button>
              <Button size="sm" variant="secondary" onClick={async () => {
                await issuesApi.adminUpdate(row.id, { status: 'RESOLVED' });
                await load();
                showToast('Salvat cu succes');
              }}>
                Mark resolved
              </Button>
              <ButtonLink href={`/admin/issues/${row.id}`} size="sm" variant="outline">
                Details
              </ButtonLink>
            </div>
          </div>
        ))}
        {!rows.length ? <EmptyState title="Nu există date încă" description="Nu există sesizări pentru filtrele selectate." /> : null}
      </div> : null}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 text-xs">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
