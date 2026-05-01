'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { invoicesApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function ResidentInvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);

  useEffect(() => {
    invoicesApi.residentGetOne(params.id).then((res) => setRow(res.data)).catch(() => undefined);
  }, [params.id]);

  if (!row) return <div className="text-sm text-muted-foreground">Loading invoice...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.invoiceNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Apartment #{row.apartment?.number} • {row.month}/{row.year}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          previousDebt={row.previousDebt}, currentCharges={row.currentCharges}, payments={row.paymentsAmount}, totalDue={row.totalDue}
        </p>
        <button className="mt-3 rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await invoicesApi.residentPdf(row.id)).data, `invoice-${row.id}.pdf`)}>
          Download PDF
        </button>
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Charges breakdown</p>
        {(row.charges || []).map((c: any) => (
          <div key={c.id} className="text-sm text-muted-foreground">{c.tariffName}: {c.amount}</div>
        ))}
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Payments breakdown</p>
        {(row.payments || []).map((p: any) => (
          <div key={p.id} className="text-sm text-muted-foreground">{p.createdAt}: {p.amount} ({p.method})</div>
        ))}
      </div>
    </div>
  );
}
