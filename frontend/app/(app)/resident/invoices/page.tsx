'use client';

import { useEffect, useState } from 'react';
import { invoicesApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import StatusBadge from '@/components/ui/StatusBadge';
import Button, { ButtonLink } from '@/components/ui/Button';

export default function ResidentInvoicesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoicesApi.residentList().then((res) => setRows(res.data || [])).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading invoices..." />;

  return (
    <div className="space-y-4">
      <MobilePageHeader title="My Invoices" subtitle="Track due amounts and download invoice PDFs." />
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">
              {row.invoiceNumber} • #{row.apartment?.number}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.month}/{row.year} • due {row.totalDue}
            </p>
            <div className="mt-2 flex gap-2">
              <StatusBadge status={row.status} />
              <ButtonLink href={`/resident/invoices/${row.id}`} size="sm" variant="outline">Details</ButtonLink>
              <Button size="sm" variant="secondary" onClick={async () => downloadBlob((await invoicesApi.residentPdf(row.id)).data, `invoice-${row.id}.pdf`)}>
                Download PDF
              </Button>
            </div>
          </div>
        ))}
        {!rows.length ? <EmptyState title="Nu există date încă" description="Facturile vor apărea după prima generare." /> : null}
      </div>
    </div>
  );
}
