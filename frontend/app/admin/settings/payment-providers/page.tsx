'use client';

import { useEffect, useMemo, useState } from 'react';
import { paymentsApi } from '@/lib/api';

type ProviderKey = 'MAIB' | 'PAYNET' | 'OPLATA' | 'MANUAL_BANK_TRANSFER' | 'CASH';
type ProviderRow = {
  provider: ProviderKey;
  isEnabled: boolean;
  isTestMode: boolean;
  config: {
    merchantId?: string;
    callbackUrl?: string;
    successUrl?: string;
    failUrl?: string;
    secretKeyMasked?: string;
  };
};

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  MAIB: 'MAIB',
  PAYNET: 'Paynet',
  OPLATA: 'Oplata',
  MANUAL_BANK_TRANSFER: 'Transfer bancar',
  CASH: 'Cash',
};

export default function AdminPaymentProvidersPage() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [savingProvider, setSavingProvider] = useState<ProviderKey | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    paymentsApi.adminProviderList().then((res) => setRows(res.data || [])).catch(() => setRows([]));
  }, []);

  const orderedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          ['MAIB', 'PAYNET', 'OPLATA', 'MANUAL_BANK_TRANSFER', 'CASH'].indexOf(a.provider) -
          ['MAIB', 'PAYNET', 'OPLATA', 'MANUAL_BANK_TRANSFER', 'CASH'].indexOf(b.provider),
      ),
    [rows],
  );

  const updateLocal = (provider: ProviderKey, updater: (row: ProviderRow) => ProviderRow) => {
    setRows((prev) => prev.map((row) => (row.provider === provider ? updater(row) : row)));
  };

  const saveProvider = async (provider: ProviderKey) => {
    const row = rows.find((r) => r.provider === provider);
    if (!row) return;
    setSavingProvider(provider);
    setMessage('');
    try {
      await paymentsApi.adminProviderUpdate(provider, {
        isEnabled: row.isEnabled,
        isTestMode: row.isTestMode,
        configJson: {
          merchantId: row.config?.merchantId || '',
          secretKey: row.config?.secretKeyMasked || '',
          callbackUrl: row.config?.callbackUrl || '',
          successUrl: row.config?.successUrl || '',
          failUrl: row.config?.failUrl || '',
        },
      });
      setMessage(`Configurarea pentru ${PROVIDER_LABELS[provider]} a fost salvata.`);
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-foreground">Payment providers</h1>
      <p className="text-sm text-muted-foreground">Configureaza providerii de plata activi pentru organizatia curenta.</p>
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      ) : null}
      <div className="space-y-3">
        {orderedRows.map((row) => (
          <div key={row.provider} className="rounded-xl border border-border/70 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{PROVIDER_LABELS[row.provider]}</h2>
              <button
                className="rounded-md border border-border/70 px-3 py-1 text-xs"
                onClick={() => saveProvider(row.provider)}
                disabled={savingProvider === row.provider}
              >
                {savingProvider === row.provider ? 'Saving...' : 'Save config'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.isEnabled}
                  onChange={(e) => updateLocal(row.provider, (current) => ({ ...current, isEnabled: e.target.checked }))}
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.isTestMode}
                  onChange={(e) => updateLocal(row.provider, (current) => ({ ...current, isTestMode: e.target.checked }))}
                />
                Test mode
              </label>
              <input
                className="input"
                placeholder="merchantId"
                value={row.config?.merchantId || ''}
                onChange={(e) =>
                  updateLocal(row.provider, (current) => ({
                    ...current,
                    config: { ...current.config, merchantId: e.target.value },
                  }))
                }
              />
              <input
                className="input"
                placeholder="secretKey"
                value={row.config?.secretKeyMasked || ''}
                onChange={(e) =>
                  updateLocal(row.provider, (current) => ({
                    ...current,
                    config: { ...current.config, secretKeyMasked: e.target.value },
                  }))
                }
              />
              <input
                className="input"
                placeholder="callbackUrl"
                value={row.config?.callbackUrl || ''}
                onChange={(e) =>
                  updateLocal(row.provider, (current) => ({
                    ...current,
                    config: { ...current.config, callbackUrl: e.target.value },
                  }))
                }
              />
              <input
                className="input"
                placeholder="successUrl"
                value={row.config?.successUrl || ''}
                onChange={(e) =>
                  updateLocal(row.provider, (current) => ({
                    ...current,
                    config: { ...current.config, successUrl: e.target.value },
                  }))
                }
              />
              <input
                className="input md:col-span-2"
                placeholder="failUrl"
                value={row.config?.failUrl || ''}
                onChange={(e) =>
                  updateLocal(row.provider, (current) => ({
                    ...current,
                    config: { ...current.config, failUrl: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

