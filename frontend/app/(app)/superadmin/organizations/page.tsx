'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { superadminApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import { useToast } from '@/components/ui/ToastProvider';

export default function SuperadminOrganizationsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superadminApi.listOrgs();
      setRows(res.data || []);
    } catch {
      setRows([]);
      setError('Nu am putut încărca organizațiile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.adminEmail, row.subscriptionStatus]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [query, rows]);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Organizații" subtitle="Administrare organizații active, beta și demo." />

      {loading ? <LoadingState label="Se încarcă organizațiile..." rows={4} /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}{' '}
          <button className="underline" onClick={() => load().catch(() => undefined)}>
            Reîncearcă
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Creează organizație</p>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="input flex-1"
            placeholder="Nume organizație"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={creating}
            onClick={async () => {
              if (!newName.trim()) {
                showToast('Numele organizației este obligatoriu.', 'error');
                return;
              }
              setCreating(true);
              try {
                await superadminApi.createOrg({ name: newName.trim() });
                setNewName('');
                await load();
                showToast('Organizația a fost creată.');
              } catch {
                showToast('Nu am putut crea organizația.', 'error');
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <input
          className="input"
          placeholder="Caută după nume, email admin, status"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filteredRows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  admin: {row.adminEmail || '-'} • subscription: {row.subscriptionStatus || '-'}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>apartamente active: {row.activeApartments ?? 0}</p>
                <p>cost lunar: {Number(row.monthlyCostMdl || 0).toFixed(2)} MDL</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="rounded border border-border/60 px-2 py-1 text-xs"
                disabled={updatingId === row.id}
                onClick={async () => {
                  setUpdatingId(row.id);
                  try {
                    await superadminApi.updateOrg(row.id, { isActive: !row.isActive });
                    await load();
                    showToast('Status organizație actualizat.');
                  } catch {
                    showToast('Nu am putut actualiza statusul.', 'error');
                  } finally {
                    setUpdatingId(null);
                  }
                }}
              >
                {row.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                className="rounded border border-border/60 px-2 py-1 text-xs"
                disabled={updatingId === row.id}
                onClick={async () => {
                  setUpdatingId(row.id);
                  try {
                    await superadminApi.updateOrg(row.id, { betaAccessEnabled: !row.betaAccessEnabled });
                    await load();
                    showToast('Beta access actualizat.');
                  } catch {
                    showToast('Nu am putut actualiza beta access.', 'error');
                  } finally {
                    setUpdatingId(null);
                  }
                }}
              >
                betaAccess: {row.betaAccessEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                className="rounded border border-border/60 px-2 py-1 text-xs"
                disabled={updatingId === row.id}
                onClick={async () => {
                  setUpdatingId(row.id);
                  try {
                    await superadminApi.updateOrg(row.id, { isDemo: !row.isDemo });
                    await load();
                    showToast('Demo flag actualizat.');
                  } catch {
                    showToast('Nu am putut actualiza demo flag.', 'error');
                  } finally {
                    setUpdatingId(null);
                  }
                }}
              >
                isDemo: {row.isDemo ? 'ON' : 'OFF'}
              </button>
              <Link href={`/superadmin/organizations/${row.id}/subscription`} className="rounded border border-border/60 px-2 py-1 text-xs text-primary">
                Open details
              </Link>
            </div>
          </div>
        ))}
        {!loading && !filteredRows.length ? (
          <EmptyState title="Nu există organizații" description="Creează prima organizație pentru a începe auditul superadmin." />
        ) : null}
      </div>
    </div>
  );
}
