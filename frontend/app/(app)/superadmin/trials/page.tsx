'use client';

import { useCallback, useEffect, useState } from 'react';
import { billingSaasApi } from '@/lib/api';

type UsageScore = 'LOW' | 'MEDIUM' | 'HIGH';

export default function SuperadminTrialsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extendDraft, setExtendDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billingSaasApi.superadminTrials();
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const scoreBadge = (score: UsageScore) => {
    if (score === 'HIGH') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    if (score === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Trial Conversion Workflow</h1>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Organizatie</th>
              <th className="px-3 py-2">Days left</th>
              <th className="px-3 py-2">Usage score</th>
              <th className="px-3 py-2">Activitate trial</th>
              <th className="px-3 py-2">Ultimul login admin</th>
              <th className="px-3 py-2">Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.subscriptionId}
                className={`border-b border-border/40 align-top ${row.endingSoon ? 'bg-red-50/50' : ''}`}
              >
                <td className="px-3 py-2 font-medium text-foreground">{row.organizationName}</td>
                <td className="px-3 py-2">
                  <span className={row.endingSoon ? 'font-semibold text-red-600' : ''}>
                    {row.daysLeft ?? '-'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-1 text-xs ${scoreBadge(row.usageScore)}`}>{row.usageScore}</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <p>Blocuri: {row.metrics?.buildingsCreated || 0}</p>
                  <p>Apartamente: {row.metrics?.apartmentsAdded || 0}</p>
                  <p>Invitatii rezidenti: {row.metrics?.residentsInvited || 0}</p>
                  <p>Facturi: {row.metrics?.invoicesGenerated || 0}</p>
                  <p>Plati: {row.metrics?.paymentsRecorded || 0}</p>
                  <p>Sesizari: {row.metrics?.issuesCreated || 0}</p>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {row.metrics?.lastAdminLogin ? new Date(row.metrics.lastAdminLogin).toLocaleString() : '-'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                      onClick={async () => {
                        await billingSaasApi.superadminConvertTrial(row.organizationId);
                        await load();
                      }}
                    >
                      Convert
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="input h-8 w-20"
                      placeholder="Zile"
                      value={extendDraft[row.organizationId] || ''}
                      onChange={(e) =>
                        setExtendDraft((prev) => ({ ...prev, [row.organizationId]: e.target.value }))
                      }
                    />
                    <button
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                      onClick={async () => {
                        const days = Number(extendDraft[row.organizationId] || 0);
                        if (!days) return;
                        await billingSaasApi.superadminExtendTrial(row.organizationId, days);
                        await load();
                      }}
                    >
                      Extend
                    </button>
                    <button
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                      onClick={async () => {
                        await billingSaasApi.superadminMarkTrialLost(row.organizationId);
                        await load();
                      }}
                    >
                      Mark lost
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Nu exista organizatii in trial.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Se incarca trial-urile...</p> : null}
    </div>
  );
}
