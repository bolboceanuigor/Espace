'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { invoicesApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function AdminInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);

  const load = async () => {
    const res = await invoicesApi.adminGetOne(params.id);
    setRow(res.data);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [params.id]);

  if (!row) return <div className="text-sm text-muted-foreground">Loading invoice...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.invoiceNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Apartment #{row.apartment?.number} • {row.month}/{row.year} • Status: {row.status}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          previousDebt={row.previousDebt}, currentCharges={row.currentCharges}, paymentsAmount={row.paymentsAmount}, totalDue={row.totalDue}
        </p>
        <div className="mt-3 flex gap-2">
          <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => { await invoicesApi.issue(row.id); await load(); }}>
            Issue
          </button>
          <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => { await invoicesApi.regenerate(row.id); await load(); }}>
            Regenerate
          </button>
          <button className="rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await invoicesApi.adminPdf(row.id)).data, `invoice-${row.id}.pdf`)}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
