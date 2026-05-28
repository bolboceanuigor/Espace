'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Layers3, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/ui';
import { bulkOperationsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';
import { BulkOperationItemsTable, BulkOperationStatusBadge, BulkSafetyPanel } from './BulkOperationComponents';

export function BulkOperationsHistoryPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await bulkOperationsApi.list();
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca operațiunile bulk.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const completed = items.filter((item) => item.status === 'COMPLETED').length;
  const partial = items.filter((item) => item.status === 'PARTIAL').length;
  const failed = items.filter((item) => item.status === 'FAILED').length;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Operațiuni bulk"
        description="Istoricul acțiunilor aplicate în masă asupra datelor asociației."
        rightSlot={<Button variant="secondary" onClick={load} isLoading={loading}><RefreshCw className="h-4 w-4" />Actualizează</Button>}
      />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total operațiuni" value={items.length} icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Finalizate" value={completed} tone="success" />
        <StatCard label="Parțiale" value={partial} tone="warning" />
        <StatCard label="Eșuate" value={failed} tone="danger" />
      </section>
      <BulkSafetyPanel />
      <Card className="overflow-hidden p-0">
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Entitate</th>
                  <th className="px-4 py-3">Acțiune</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Aplicate</th>
                  <th className="px-4 py-3">Sărite</th>
                  <th className="px-4 py-3">Eșuate</th>
                  <th className="px-4 py-3">Creat de</th>
                  <th className="px-4 py-3">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3">{item.entityType}</td>
                    <td className="px-4 py-3 font-semibold">{item.operationType}</td>
                    <td className="px-4 py-3"><BulkOperationStatusBadge status={item.status} /></td>
                    <td className="px-4 py-3">{item.totalItems}</td>
                    <td className="px-4 py-3">{item.appliedItems}</td>
                    <td className="px-4 py-3">{item.skippedItems}</td>
                    <td className="px-4 py-3">{item.failedItems}</td>
                    <td className="px-4 py-3">{item.createdBy?.fullName || item.createdBy?.email || '—'}</td>
                    <td className="px-4 py-3"><Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" href={localizedPath(`/admin/bulk-operations/${item.id}`)}>Deschide</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <h2 className="text-lg font-bold text-slate-950">Nu există operațiuni bulk</h2>
            <p className="mt-1 text-sm text-slate-500">Operațiunile vor apărea aici după ce sunt generate din listele Admin.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export function BulkOperationDetailPage({ id, view = 'details' }: { id: string; view?: 'details' | 'preview' | 'result' }) {
  const [data, setData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const localizedPath = useLocalizedPath();

  const load = useCallback(async () => {
    setError('');
    try {
      const [operationRes, resultRes] = await Promise.all([bulkOperationsApi.get(id), bulkOperationsApi.result(id).catch(() => null)]);
      setData(operationRes.data);
      setResult(resultRes?.data || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca operațiunea bulk.'));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await bulkOperationsApi.confirm(id);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut confirma operațiunea.'));
    } finally {
      setBusy(false);
    }
  }

  const operation = data?.bulkOperation || data;
  const items = result?.items || data?.items || [];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={view === 'result' ? 'Rezultat operațiune bulk' : view === 'preview' ? 'Preview operațiune bulk' : 'Detalii operațiune bulk'}
        description="Verifică sumarul, itemele procesate și statusul per entitate."
        rightSlot={<Link className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold" href={localizedPath('/admin/bulk-operations')}>Înapoi la istoric</Link>}
      />
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {operation ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Status" value={<BulkOperationStatusBadge status={operation.status} />} />
            <StatCard label="Total" value={operation.totalItems || 0} />
            <StatCard label="Valide" value={operation.validItems || 0} />
            <StatCard label="Aplicate" value={operation.appliedItems || 0} tone="success" />
            <StatCard label="Sărite" value={operation.skippedItems || 0} tone="warning" />
            <StatCard label="Eșuate" value={operation.failedItems || 0} tone="danger" />
          </section>
          <Card>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Entitate" value={operation.entityType} />
              <Info label="Acțiune" value={operation.operationType} />
              <Info label="Creat la" value={formatDate(operation.createdAt)} />
              <Info label="Finalizat la" value={formatDate(operation.completedAt)} />
            </div>
            {operation.status === 'PREVIEWED' ? <Button className="mt-4" onClick={confirm} isLoading={busy}>Confirmă și aplică</Button> : null}
          </Card>
          <BulkOperationItemsTable items={items} />
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value || '—'}</p></div>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
