'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoicesApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import { useToast } from '@/components/ui/ToastProvider';
import StatusBadge from '@/components/ui/StatusBadge';
import Button, { ButtonLink } from '@/components/ui/Button';

export default function AdminInvoicesPage() {
  const { showToast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoicesApi.adminList({ month, year, page, limit: pageSize });
      setRows((res.data as any)?.data || []);
      setTotalPages((res.data as any)?.totalPages || 1);
    } catch {
      setError('Nu am putut încărca facturile.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [month, page, year]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Invoices" subtitle="Generate and manage monthly resident invoices." />
      {loading ? <LoadingState label="Se încarcă facturile..." /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
          <Button className="ml-2" size="sm" variant="secondary" onClick={() => load()}>
            Reîncearcă
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-border/70 bg-card p-4">
        <input className="input w-28" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        <input className="input w-32" type="number" min={2000} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <Button
          variant="secondary"
          isLoading={generating}
          disabled={generating}
          onClick={async () => {
            if (month < 1 || month > 12 || year < 2000 || year > 2100) {
              showToast('Perioada selectată este invalidă.', 'error');
              return;
            }
            try {
              setGenerating(true);
              await invoicesApi.generateMonthly({ month, year });
              await load();
              showToast('Facturile lunare au fost generate.');
            } catch {
              showToast('Nu am putut genera facturile pentru perioada selectată.', 'error');
            } finally {
              setGenerating(false);
            }
          }}
        >
          Generate monthly invoices
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Tip: generează facturile după ce finalizezi tarifele și indexurile pentru luna curentă.</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">
              #{row.apartment?.number} • {row.apartment?.building?.name}/{row.apartment?.staircase?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Prev debt: {row.previousDebt} • Charges: {row.currentCharges} • Payments: {row.paymentsAmount} • Due: {row.totalDue} • {row.status}
            </p>
            <div className="mt-2 flex gap-2">
              <StatusBadge status={row.status} />
              <ButtonLink href={`/admin/invoices/${row.id}`} size="sm" variant="outline">View</ButtonLink>
              <Button
                variant="secondary"
                size="sm"
                isLoading={updatingInvoiceId === row.id}
                disabled={updatingInvoiceId === row.id || row.status === 'PAID'}
                onClick={async () => {
                  try {
                    setUpdatingInvoiceId(row.id);
                    await invoicesApi.issue(row.id);
                    await load();
                    showToast('Factura a fost emisă.');
                  } catch {
                    showToast('Emiterea facturii a eșuat.', 'error');
                  } finally {
                    setUpdatingInvoiceId(null);
                  }
                }}
              >
                Issue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await downloadBlob((await invoicesApi.adminPdf(row.id)).data, `invoice-${row.id}.pdf`);
                  } catch {
                    showToast('PDF indisponibil momentan. Folosește pagina de detalii a facturii.', 'error');
                  }
                }}
              >
                Download PDF
              </Button>
            </div>
          </div>
        ))}
        {!rows.length ? <EmptyState title="Nu există date încă" description="Nu există facturi pentru luna selectată." /> : null}
      </div>
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
