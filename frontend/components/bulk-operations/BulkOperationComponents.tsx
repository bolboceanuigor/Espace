'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers3, XCircle } from 'lucide-react';
import { Badge, Button, Card, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui';
import { bulkOperationsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusVariant: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'neutral',
  PREVIEWED: 'warning',
  CONFIRMED: 'warning',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  PARTIAL: 'warning',
  FAILED: 'error',
  CANCELLED: 'neutral',
  VALID: 'success',
  WARNING: 'warning',
  SKIPPED: 'neutral',
  APPLIED: 'success',
};

const actionLabels: Record<string, string> = {
  APARTMENTS_SET_STATUS: 'Setează status',
  APARTMENTS_ARCHIVE: 'Arhivează',
  RESIDENTS_SET_STATUS: 'Setează status',
  RESIDENTS_ARCHIVE: 'Arhivează',
  METERS_SET_STATUS: 'Setează status',
  METERS_ARCHIVE: 'Arhivează',
  REQUESTS_SET_STATUS: 'Setează status',
  REQUESTS_ARCHIVE_CLOSED: 'Arhivează închise',
  ANNOUNCEMENTS_ARCHIVE: 'Arhivează',
  ANNOUNCEMENTS_MARK_PINNED: 'Fixează',
  ANNOUNCEMENTS_MARK_UNPINNED: 'Scoate fixarea',
  DATA_QUALITY_MARK_RESOLVED: 'Marchează rezolvat',
  DATA_QUALITY_MARK_IGNORED: 'Ignoră',
};

export function BulkOperationStatusBadge({ status }: { status?: string }) {
  return <Badge variant={statusVariant[status || ''] || 'neutral'}>{status || '—'}</Badge>;
}

export function BulkSelectionToolbar({
  entityType,
  selectedIds,
  onClear,
  onDone,
  actions,
}: {
  entityType: string;
  selectedIds: string[];
  onClear: () => void;
  onDone?: () => void;
  actions: { operationType: string; label?: string; payload?: Record<string, any>; requiresReason?: boolean }[];
}) {
  const localizedPath = useLocalizedPath();
  const [action, setAction] = useState(actions[0]?.operationType || '');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!selectedIds.length) return null;
  const config = actions.find((item) => item.operationType === action) || actions[0];
  const needsReason = Boolean(config?.requiresReason || action.includes('ARCHIVE') || action.includes('IGNORED'));
  const needsStatus = action.includes('SET_STATUS');

  async function generatePreview() {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const payload = { ...(config?.payload || {}) };
      if (needsReason) payload.reason = reason;
      if (needsStatus) payload.status = status;
      const res = await bulkOperationsApi.preview({ entityType, operationType: action, selectedIds, payload });
      setPreview(res.data);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera preview-ul operațiunii.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview?.bulkOperation?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await bulkOperationsApi.confirm(preview.bulkOperation.id);
      setPreview(res.data);
      onDone?.();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut aplica operațiunea.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold text-emerald-950">{selectedIds.length} selectate</p>
          <p className="text-xs text-emerald-800">Acțiunile bulk au preview obligatoriu și nu șterg date definitiv.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
          <select className="select min-w-[220px]" value={action} onChange={(event) => { setAction(event.target.value); setPreview(null); }}>
            {actions.map((item) => <option key={item.operationType} value={item.operationType}>{item.label || actionLabels[item.operationType] || item.operationType}</option>)}
          </select>
          {needsStatus ? <input className="input min-w-[180px]" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="Status Prisma exact" /> : null}
          {needsReason ? <input className="input min-w-[220px]" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motiv obligatoriu" /> : null}
          <Button variant="secondary" onClick={generatePreview} isLoading={busy} disabled={!action || (needsReason && !reason.trim()) || (needsStatus && !status.trim())}>Preview</Button>
          <Button variant="ghost" onClick={onClear}>Curăță</Button>
        </div>
      </div>
      {error ? <div className="mt-3 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">{error}</div> : null}
      {preview ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Total" value={preview.bulkOperation?.totalItems} />
            <MiniStat label="Valide" value={preview.bulkOperation?.validItems} />
            <MiniStat label="Warning" value={preview.bulkOperation?.warningItems} />
            <MiniStat label="Sărite" value={preview.bulkOperation?.skippedItems} />
          </div>
          <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200">
            {(preview.items || []).slice(0, 20).map((item: any) => (
              <div key={item.id || item.entityId} className="grid gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 md:grid-cols-[1fr_auto_1.6fr]">
                <span className="font-semibold">{item.entityDisplayName || item.entityId}</span>
                <BulkOperationStatusBadge status={item.status} />
                <span className="text-xs text-slate-500">{[...(item.warnings || []), ...(item.errors || [])].join(' · ') || 'OK'}</span>
              </div>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-slate-700">
            <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            Confirm că am verificat preview-ul și aplic doar itemele valide/warning.
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={confirm} isLoading={busy} disabled={!confirmed || preview.bulkOperation?.status !== 'PREVIEWED'}>Aplică operațiunea</Button>
            {preview.bulkOperation?.id ? <Link className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold" href={localizedPath(`/admin/bulk-operations/${preview.bulkOperation.id}`)}>Deschide detalii</Link> : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-xl font-bold text-slate-950">{value ?? 0}</p></div>;
}

export function BulkOperationItemsTable({ items }: { items: any[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {items.length ? items.map((item) => (
        <div key={item.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_auto_1fr]">
          <span className="font-semibold">{item.entityDisplayName || item.entityId}</span>
          <BulkOperationStatusBadge status={item.status} />
          <span className="text-xs text-slate-500">{item.errorMessage || [...(item.warnings || []), ...(item.errors || [])].join(' · ') || 'Fără observații'}</span>
        </div>
      )) : <div className="p-8 text-center text-sm text-slate-500">Nu există iteme.</div>}
    </div>
  );
}

export function BulkSafetyPanel() {
  return (
    <Card className="border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
        <div>
          <h3 className="font-bold text-amber-950">Operațiuni blocate explicit</h3>
          <p className="mt-1 text-sm text-amber-800">Nu există bulk delete, bulk mark paid, bulk cancel/void facturi, bulk cancel plăți sau aprobare automată de indici. Orice aplicare cere preview și confirmare.</p>
        </div>
      </div>
    </Card>
  );
}
