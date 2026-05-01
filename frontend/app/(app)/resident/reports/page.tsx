'use client';

import { useEffect, useState } from 'react';
import { reportsApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';

export default function ResidentReportsPage() {
  const [statement, setStatement] = useState<any>(null);

  const load = async () => {
    const res = await reportsApi.residentStatement();
    setStatement(res.data);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">My Statement</h1>
      {statement ? (
        <>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Apartment #{statement.apartment?.number} • {statement.apartment?.building} / {statement.apartment?.staircase}
            </p>
            <p className="mt-1 font-medium text-foreground">Current debt: {statement.currentDebt}</p>
            <button className="mt-3 rounded-md border border-border/70 px-3 py-2 text-sm" onClick={async () => downloadBlob((await reportsApi.residentStatementPdf({ apartmentId: statement.apartment?.id })).data, 'my-statement.pdf')}>
              Export PDF
            </button>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-medium text-foreground">Charges history</p>
            {(statement.chargesHistory || []).map((item: any) => (
              <div key={item.id} className="text-sm text-foreground">
                {item.month} • {item.amount} • {item.status}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-medium text-foreground">Payments history</p>
            {(statement.paymentsHistory || []).map((item: any) => (
              <div key={item.id} className="text-sm text-foreground">
                {item.month} • {item.amount} • {item.method}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
