'use client';

import { useEffect, useState } from 'react';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function SuperadminReportsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    reportsApi.superadminPlatform().then((res) => setData(res.data)).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Platform Reports</h1>
      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card p-3">Total orgs: {data.totalOrganizations}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Active: {data.activeOrganizations}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Trial: {data.trialOrganizations}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Past due: {data.pastDueOrganizations}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Suspended: {data.suspendedOrganizations}</div>
            <div className="rounded-xl border border-border/70 bg-card p-3">Apartments: {data.totalApartmentsOnPlatform}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm text-muted-foreground">Expected monthly revenue: {data.expectedMonthlyRevenue} {data.currency}</p>
            <p className="text-sm text-muted-foreground">Paid invoices: {data.paidInvoices}</p>
            <p className="text-sm text-muted-foreground">Unpaid invoices: {data.unpaidInvoices}</p>
            <button className="mt-3 rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.superadminPlatformXlsx()).data, 'platform-report.xlsx')}>
              Export Excel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
