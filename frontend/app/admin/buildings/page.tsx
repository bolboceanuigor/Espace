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
  const [form, setForm] = useState({ name: '', address: '', staircasesCount: 1, apartmentsCount: 0 });

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
      <MobilePageHeader title="Blocuri" subtitle="Configurează primul bloc al asociației și structura lui." />

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground">Adaugă bloc</p>
          <p className="text-xs text-muted-foreground">Blocul este conectat automat la A.P.C. administratorului autentificat.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Nume bloc</span>
            <input className="input" placeholder="Bloc principal" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Adresă</span>
            <input className="input" placeholder="str. Alba Iulia 75" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Număr scări</span>
            <input className="input" type="number" min={0} value={form.staircasesCount} onChange={(e) => setForm((p) => ({ ...p, staircasesCount: Number(e.target.value) }))} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Număr apartamente estimat</span>
            <input className="input" type="number" min={0} value={form.apartmentsCount} onChange={(e) => setForm((p) => ({ ...p, apartmentsCount: Number(e.target.value) }))} />
          </label>
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
                staircasesCount: form.staircasesCount,
                apartmentsCount: form.apartmentsCount,
              });
              setForm({ name: '', address: '', staircasesCount: 1, apartmentsCount: 0 });
              await load();
              showToast('Blocul a fost creat.');
            } catch {
              showToast('Nu am putut crea blocul.', 'error');
            } finally {
              setCreating(false);
            }
          }}
        >
          <Plus className="h-4 w-4" /> {creating ? 'Se creează...' : 'Adaugă bloc'}
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
        <EmptyState title="Nu există blocuri încă" description="Adaugă primul bloc pentru a continua configurarea asociației." />
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
              Scări: {building._count?.staircases ?? building.staircasesCount ?? 0} · Apartamente: {building._count?.apartments ?? building.apartmentsCount ?? 0}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link className="text-sm text-primary" href={`/${locale}/admin/buildings/${building.id}`}>
                Detalii
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
