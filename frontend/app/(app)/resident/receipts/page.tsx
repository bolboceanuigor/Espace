'use client';

import { useEffect, useState } from 'react';
import { invoicesApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function ResidentReceiptsPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    invoicesApi.residentReceipts().then((res) => setRows(res.data || [])).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">My Receipts</h1>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
            <p className="font-medium text-foreground">{row.receiptNumber}</p>
            <p className="text-xs text-muted-foreground">
              #{row.apartment?.number} • {row.amount} • {new Date(row.paymentDate).toLocaleDateString()}
            </p>
            <button className="mt-2 rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => downloadBlob((await invoicesApi.residentReceiptPdf(row.id)).data, `receipt-${row.id}.pdf`)}>
              Download PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
