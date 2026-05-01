'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';
import { adminStructureApi, billingSaasApi } from '@/lib/api';
import { isWriteBlockedBySubscription } from '@/lib/subscription-access';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';
import { defaultLocale, isLocale } from '@/i18n';

export default function AdminBuildingsPage() {
  const { showToast } = useToast();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', cadastralNumber: '', totalFloors: 1 });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminStructureApi.listBuildings();
      setItems(res.data || []);
    } catch {
      setError('Nu am putut încărca lista de blocuri.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    billingSaasApi
      .getAdminSubscription()
      .then((res) => setSubscriptionStatus(String(res.data?.status || '').toUpperCase()))
      .catch(() => setSubscriptionStatus(''));
  }, []);
  const writeBlocked = isWriteBlockedBySubscription(subscriptionStatus);

  return (
    <div className="space-y-4">
      <MobilePageHeader title="Buildings" subtitle="Manage buildings and access structure details." />

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Add Building</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <input className="input" placeholder="Cadastral number" value={form.cadastralNumber} onChange={(e) => setForm((p) => ({ ...p, cadastralNumber: e.target.value }))} />
          <input className="input" type="number" min={1} placeholder="Total floors" value={form.totalFloors} onChange={(e) => setForm((p) => ({ ...p, totalFloors: Number(e.target.value) }))} />
        </div>
        <button
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={writeBlocked || creating}
          onClick={async () => {
            if (writeBlocked) return;
            if (!form.name.trim() || !form.address.trim()) {
              showToast('Numele și adresa sunt obligatorii.', 'error');
              return;
            }
            setCreating(true);
            try {
              await adminStructureApi.createBuilding({
                name: form.name.trim(),
                address: form.address.trim(),
                cadastralNumber: form.cadastralNumber || undefined,
                totalFloors: form.totalFloors,
              });
              setForm({ name: '', address: '', cadastralNumber: '', totalFloors: 1 });
              await load();
              showToast('Blocul a fost creat cu succes.');
            } catch {
              showToast('Nu am putut crea blocul.', 'error');
            } finally {
              setCreating(false);
            }
          }}
        >
          <Plus className="h-4 w-4" /> {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}{' '}
          <button className="underline" onClick={() => load().catch(() => undefined)}>
            Reîncearcă
          </button>
        </div>
      ) : null}
      {loading ? <LoadingState label="Se încarcă blocurile..." rows={4} /> : null}
      {!loading && !error && !items.length ? (
        <EmptyState title="Nu ai blocuri încă" description="Adaugă primul bloc pentru a continua configurarea structurii." />
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(items || []).map((building) => (
          <div key={building.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">{building.name}</p>
                <p className="text-sm text-muted-foreground">{building.address}</p>
              </div>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Staircases: {building._count?.staircases || 0} - Apartments: {building._count?.apartments || 0}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link className="text-sm text-primary" href={`/${locale}/admin/buildings/${building.id}`}>
                Open details
              </Link>
              <button
                className="text-sm text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={writeBlocked || deletingId === building.id}
                onClick={async () => {
                  if (writeBlocked) return;
                  if (!window.confirm('Ești sigur că vrei să ștergi acest bloc?')) return;
                  setDeletingId(building.id);
                  try {
                    await adminStructureApi.deleteBuilding(building.id);
                    await load();
                    showToast('Blocul a fost șters.');
                  } catch {
                    showToast('Nu am putut șterge blocul.', 'error');
                  } finally {
                    setDeletingId(null);
                  }
                }}
              >
                {deletingId === building.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
