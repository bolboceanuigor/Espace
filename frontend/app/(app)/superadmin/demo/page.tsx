'use client';

import { useCallback, useEffect, useState } from 'react';
import { superadminApi } from '@/lib/api';

const RESET_CONFIRM_TEXT = 'RESET DEMO DATA';

export default function SuperadminDemoPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superadminApi.demoStatus();
      setStatus(res.data || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">Demo Data Management</h1>
        <button className="rounded-md border border-border/70 px-3 py-2 text-xs" onClick={() => load().catch(() => undefined)}>
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading demo status...</p> : null}

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Demo organizations</p>
        <div className="mt-2 space-y-2">
          {(status?.organizations || []).map((org: any) => (
            <div key={org.id} className="rounded-md border border-border/60 px-3 py-2 text-xs">
              <p className="font-medium text-foreground">{org.name}</p>
              <p className="text-muted-foreground">{org.id}</p>
            </div>
          ))}
          {!status?.organizations?.length ? <p className="text-xs text-muted-foreground">No demo organizations found.</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Current demo dataset status</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(status?.totals || {}).map(([key, value]) => (
            <div key={key} className="rounded-md border border-border/60 px-2 py-1">
              <p className="text-[11px] uppercase text-muted-foreground">{key}</p>
              <p className="text-sm font-semibold text-foreground">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Danger zone</p>
        <p className="mt-1 text-xs text-amber-700">
          This action resets only organizations marked as demo (`isDemo = true`). Real organizations are never touched.
        </p>
        <button className="mt-3 rounded-md bg-amber-600 px-3 py-2 text-xs text-white" onClick={() => setShowModal(true)}>
          Reset demo data
        </button>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-4">
            <p className="text-sm font-medium text-foreground">Confirm demo reset</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Type <span className="font-semibold">{RESET_CONFIRM_TEXT}</span> to continue.
            </p>
            <input
              className="input mt-3 w-full"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={RESET_CONFIRM_TEXT}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded-md border border-border/70 px-3 py-2 text-xs"
                onClick={() => {
                  setShowModal(false);
                  setConfirmText('');
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-destructive px-3 py-2 text-xs text-destructive-foreground disabled:opacity-50"
                disabled={submitting || confirmText.trim() !== RESET_CONFIRM_TEXT}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await superadminApi.resetDemoData(confirmText.trim());
                    setShowModal(false);
                    setConfirmText('');
                    await load();
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? 'Resetting...' : 'Confirm reset'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
