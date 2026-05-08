'use client';

import { useEffect, useState } from 'react';
import {
  PrintActions,
  PrintableDocumentShell,
  PrintInfoGrid,
  PrintSection,
} from '@/components/print/PrintableDocument';
import { reportsApi } from '@/lib/api';
import { formatDatePrint, formatMdlPrint, loadAdminApcOrganization, toApcOrganizationInfo, type ApcOrganizationInfo } from '@/lib/print-documents';

export default function AdminDebtsReportPrintPage() {
  const [report, setReport] = useState<any>({ summary: {}, rows: [] });
  const [organization, setOrganization] = useState<ApcOrganizationInfo>(toApcOrganizationInfo());
  const [params, setParams] = useState<Record<string, string | number | boolean | undefined>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const minDebt = searchParams.get('minDebt');
    setParams({
      buildingId: searchParams.get('buildingId') || undefined,
      staircaseId: searchParams.get('staircaseId') || undefined,
      search: searchParams.get('search') || undefined,
      onlyOverdue: searchParams.get('onlyOverdue') === 'true' || undefined,
      minDebt: minDebt ? Number(minDebt) : undefined,
    });
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([reportsApi.adminDebts(params), loadAdminApcOrganization()])
      .then(([reportRes, organizationInfo]) => {
        if (!active) return;
        setReport(reportRes.data || { summary: {}, rows: [] });
        setOrganization(organizationInfo);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [params]);

  const rows = report.rows || [];
  const summary = report.summary || {};

  return (
    <PrintableDocumentShell organization={organization} title="Raport datorii" subtitle={`Generat la ${formatDatePrint(new Date())}`}>
      <PrintActions printLabel="Printează raport" backHref="/admin/reports/debts" />

      {state === 'loading' ? <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">Se încarcă documentul...</p> : null}
      {state === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">Nu am putut încărca documentul.</p> : null}

      {state === 'ready' ? (
        <>
          <PrintSection title="Rezumat">
            <PrintInfoGrid
              rows={[
                ['Datorie totală', formatMdlPrint(summary.totalDebt)],
                ['Total facturat', formatMdlPrint(summary.totalInvoiced)],
                ['Total achitat', formatMdlPrint(summary.totalPaid)],
                ['Apartamente cu datorii', summary.apartmentsWithDebt ?? 0],
              ]}
            />
          </PrintSection>

          <PrintSection title="Apartamente cu datorii">
            {rows.length ? (
              <table className="print-table w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Apartament</th>
                    <th className="py-2 pr-2">Scara</th>
                    <th className="py-2 pr-2">Locatar / Proprietar</th>
                    <th className="py-2 pr-2 text-right">Total facturat</th>
                    <th className="py-2 pr-2 text-right">Total achitat</th>
                    <th className="py-2 pr-2 text-right">Datorie</th>
                    <th className="py-2 text-right">Întârziate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.apartmentId} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-semibold text-slate-950">Apt. {row.apartmentNumber}</td>
                      <td className="py-2 pr-2">{row.staircase || '-'}</td>
                      <td className="py-2 pr-2">{row.ownerResident || '-'}</td>
                      <td className="py-2 pr-2 text-right">{formatMdlPrint(row.totalInvoiced)}</td>
                      <td className="py-2 pr-2 text-right">{formatMdlPrint(row.totalPaid)}</td>
                      <td className="py-2 pr-2 text-right font-semibold">{formatMdlPrint(row.totalDebt)}</td>
                      <td className="py-2 text-right">{row.overdueInvoicesCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Nu există datorii înregistrate.</p>
            )}
          </PrintSection>
        </>
      ) : null}
    </PrintableDocumentShell>
  );
}
