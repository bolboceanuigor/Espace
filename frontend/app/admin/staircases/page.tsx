'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { adminStructureApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';
import { defaultLocale, isLocale } from '@/i18n';

export default function AdminStaircasesPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [rows, setRows] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ buildingId: '', name: '', floorsCount: 1 });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const buildingsRes = await adminStructureApi.listBuildings();
      const buildingRows = buildingsRes.data || [];
      setBuildings(buildingRows);
      setForm((prev) => ({ ...prev, buildingId: prev.buildingId || buildingRows[0]?.id || '' }));
      const staircasesRes = await adminStructureApi.listAllStaircases();
      setRows((staircasesRes.data || []).map((staircase: any) => ({
        id: staircase.id,
        name: staircase.name,
        floorsCount: staircase.floorsCount,
        buildingId: staircase.buildingId,
        buildingName: staircase.building?.name || buildingRows.find((item: any) => item.id === staircase.buildingId)?.name || 'Bloc',
        apartmentsCount: staircase._count?.apartments || 0,
      })));
    } catch {
      setRows([]);
      setBuildings([]);
      setError('Nu am putut încărca scările.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Scări" subtitle="Creează scările pentru blocurile asociației." />

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground">Adaugă scară</p>
          <p className="text-xs text-muted-foreground">Selectează blocul, denumește scara și indică numărul de etaje.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_0.7fr_auto]">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Bloc</span>
            <select className="select" value={form.buildingId} onChange={(e) => setForm((prev) => ({ ...prev, buildingId: e.target.value }))}>
              <option value="">Selectează blocul</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Scara / denumire</span>
            <input className="input" placeholder="Scara 1" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Număr etaje</span>
            <input className="input" type="number" min={1} value={form.floorsCount} onChange={(e) => setForm((prev) => ({ ...prev, floorsCount: Number(e.target.value) }))} />
          </label>
          <button
            className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={creating || !buildings.length}
            onClick={async () => {
              if (!form.buildingId) {
                showToast('Blocul este obligatoriu.', 'error');
                return;
              }
              if (!form.name.trim()) {
                showToast('Scara este obligatorie.', 'error');
                return;
              }
              if (!Number.isFinite(form.floorsCount) || form.floorsCount <= 0) {
                showToast('Numărul de etaje trebuie să fie pozitiv.', 'error');
                return;
              }
              setCreating(true);
              try {
                await adminStructureApi.createStaircase(form.buildingId, {
                  name: form.name.trim(),
                  floorsCount: form.floorsCount,
                });
                setForm((prev) => ({ ...prev, name: '', floorsCount: 1 }));
                await load();
                showToast('Scara a fost creată.');
              } catch (error: any) {
                showToast(String(error?.message || 'Nu am putut crea scara.'), 'error');
              } finally {
                setCreating(false);
              }
            }}
          >
            <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" /> {creating ? 'Se creează...' : 'Adaugă scară'}</span>
          </button>
        </div>
      </div>

      {loading ? <LoadingState label="Se încarcă scările..." /> : null}
      {error ? <EmptyState title="Eroare la încărcare" description={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState
          title="Nu există scări încă."
          description="Creează prima scară pentru blocul asociației."
          actionLabel="Adaugă bloc"
          onAction={() => {
            router.push(`/${locale}/admin/buildings`);
          }}
        />
      ) : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            <p className="font-medium text-foreground">
              {row.name} · {row.buildingName}
            </p>
            <p className="text-xs text-muted-foreground">Etaje: {row.floorsCount || 0} · Apartamente: {row.apartmentsCount || 0}</p>
            <Link href={`/${locale}/admin/buildings/${row.buildingId}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              Detalii bloc
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
