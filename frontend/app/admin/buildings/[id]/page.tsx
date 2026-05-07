'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminStructureApi, apartmentsApi, billingSaasApi } from '@/lib/api';
import { isWriteBlockedBySubscription } from '@/lib/subscription-access';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';

export default function AdminBuildingDetailsPage() {
  const { showToast } = useToast();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [building, setBuilding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('');
  const [savingStaircase, setSavingStaircase] = useState(false);
  const [savingApartment, setSavingApartment] = useState(false);
  const [editingStaircaseId, setEditingStaircaseId] = useState<string | null>(null);
  const [editStaircaseForm, setEditStaircaseForm] = useState({ name: '', floorsCount: 1 });
  const [staircaseForm, setStaircaseForm] = useState({ name: '', floorsCount: 1 });
  const [apartmentForm, setApartmentForm] = useState({
    staircaseId: '',
    number: '',
    floor: 1,
    areaM2: 40,
    rooms: 1,
    status: 'ACTIVE' as 'ACTIVE' | 'EMPTY' | 'DEBTOR' | 'PROBLEM',
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminStructureApi.getBuilding(id);
      setBuilding(res.data);
    } catch {
      setError('Nu am putut încărca detaliile blocului.');
      setBuilding(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    billingSaasApi
      .getAdminSubscription()
      .then((res) => setSubscriptionStatus(String(res.data?.status || '').toUpperCase()))
      .catch(() => setSubscriptionStatus(''));
  }, [load]);
  const writeBlocked = isWriteBlockedBySubscription(subscriptionStatus);

  const staircases = useMemo(() => building?.staircases || [], [building]);
  const apartments = useMemo(() => building?.apartments || [], [building]);

  if (loading) return <LoadingState label="Se încarcă blocul..." rows={5} />;
  if (error) {
    return (
      <div className="space-y-4">
        <MobilePageHeader title="Detalii bloc" subtitle="Administrează scările și apartamentele acestui bloc." />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}{' '}
          <button className="underline" onClick={() => load().catch(() => undefined)}>
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }
  if (!building) {
    return (
      <div className="space-y-4">
        <MobilePageHeader title="Detalii bloc" subtitle="Administrează scările și apartamentele acestui bloc." />
        <EmptyState title="Blocul nu a fost găsit" description="Revino la lista de blocuri și încearcă din nou." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MobilePageHeader title={building.name} subtitle={building.address || 'Administrează scările și apartamentele acestui bloc.'} />

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Adaugă scară</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input className="input" placeholder="Scara 1" value={staircaseForm.name} onChange={(e) => setStaircaseForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="input" type="number" min={1} aria-label="Număr etaje" value={staircaseForm.floorsCount} onChange={(e) => setStaircaseForm((p) => ({ ...p, floorsCount: Number(e.target.value) }))} />
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={writeBlocked || savingStaircase}
            onClick={async () => {
              if (writeBlocked) return;
              if (!staircaseForm.name.trim()) {
                showToast('Numele scării este obligatoriu.', 'error');
                return;
              }
              setSavingStaircase(true);
              try {
                await adminStructureApi.createStaircase(building.id, {
                  name: staircaseForm.name.trim(),
                  floorsCount: staircaseForm.floorsCount,
                });
                setStaircaseForm({ name: '', floorsCount: 1 });
                await load();
                showToast('Scara a fost creată.');
              } catch {
                showToast('Nu am putut adăuga scara.', 'error');
              } finally {
                setSavingStaircase(false);
              }
            }}
          >
            {savingStaircase ? 'Se creează...' : 'Adaugă scară'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Adaugă apartament</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <select className="select" value={apartmentForm.staircaseId} onChange={(e) => setApartmentForm((p) => ({ ...p, staircaseId: e.target.value }))}>
            <option value="">Selectează scara</option>
            {staircases.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input className="input" placeholder="Număr" value={apartmentForm.number} onChange={(e) => setApartmentForm((p) => ({ ...p, number: e.target.value }))} />
          <input className="input" type="number" placeholder="Etaj" value={apartmentForm.floor} onChange={(e) => setApartmentForm((p) => ({ ...p, floor: Number(e.target.value) }))} />
          <input className="input" type="number" placeholder="Suprafață m²" value={apartmentForm.areaM2} onChange={(e) => setApartmentForm((p) => ({ ...p, areaM2: Number(e.target.value) }))} />
          <input className="input" type="number" placeholder="Camere" value={apartmentForm.rooms} onChange={(e) => setApartmentForm((p) => ({ ...p, rooms: Number(e.target.value) }))} />
          <select className="select" value={apartmentForm.status} onChange={(e) => setApartmentForm((p) => ({ ...p, status: e.target.value as any }))}>
            <option value="ACTIVE">Activ</option>
            <option value="EMPTY">Gol</option>
            <option value="DEBTOR">Cu datorii</option>
            <option value="PROBLEM">Problemă</option>
          </select>
        </div>
        <button
          className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={writeBlocked || savingApartment}
          onClick={async () => {
            if (writeBlocked) return;
            if (!apartmentForm.staircaseId || !apartmentForm.number.trim()) {
              showToast('Selectează scara și completează numărul apartamentului.', 'error');
              return;
            }
            setSavingApartment(true);
            try {
              await apartmentsApi.create({
                organizationId: building.organizationId,
                buildingId: building.id,
                staircaseId: apartmentForm.staircaseId,
                number: apartmentForm.number.trim(),
                floor: apartmentForm.floor,
                areaM2: apartmentForm.areaM2,
                rooms: apartmentForm.rooms,
                status: apartmentForm.status,
              });
              setApartmentForm({ staircaseId: '', number: '', floor: 1, areaM2: 40, rooms: 1, status: 'ACTIVE' });
              await load();
              showToast('Apartamentul a fost creat.');
            } catch {
              showToast('Nu am putut adăuga apartamentul.', 'error');
            } finally {
              setSavingApartment(false);
            }
          }}
        >
          {savingApartment ? 'Se creează...' : 'Adaugă apartament'}
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Scări</p>
        {!staircases.length ? (
          <p className="text-sm text-muted-foreground">Nu există scări încă.</p>
        ) : (
          <div className="space-y-2">
            {staircases.map((staircase: any) => (
            <div key={staircase.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              {editingStaircaseId === staircase.id ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <input
                    className="input max-w-44"
                    value={editStaircaseForm.name}
                    onChange={(e) => setEditStaircaseForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className="input max-w-24"
                    type="number"
                    min={1}
                    value={editStaircaseForm.floorsCount}
                    onChange={(e) => setEditStaircaseForm((p) => ({ ...p, floorsCount: Number(e.target.value) }))}
                  />
                  <button
                    className="rounded border border-border/70 px-2 py-1 text-xs"
                    onClick={async () => {
                      if (!editStaircaseForm.name.trim()) {
                        showToast('Numele scării este obligatoriu.', 'error');
                        return;
                      }
                      await adminStructureApi.updateStaircase(staircase.id, {
                        name: editStaircaseForm.name.trim(),
                        floorsCount: editStaircaseForm.floorsCount,
                      });
                      setEditingStaircaseId(null);
                      await load();
                      showToast('Scara a fost actualizată.');
                    }}
                  >
                    Salvează
                  </button>
                  <button className="rounded border border-border/70 px-2 py-1 text-xs" onClick={() => setEditingStaircaseId(null)}>
                    Anulează
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-foreground">{staircase.name} ({staircase.floorsCount} etaje)</span>
                  <div className="flex items-center gap-3">
                    <button
                      className="text-sm text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={writeBlocked}
                      onClick={() => {
                        setEditingStaircaseId(staircase.id);
                        setEditStaircaseForm({ name: staircase.name, floorsCount: staircase.floorsCount });
                      }}
                    >
                      Editează
                    </button>
                  </div>
                </>
              )}
            </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Apartamente</p>
        {!apartments.length ? (
          <p className="text-sm text-muted-foreground">Nu există apartamente încă.</p>
        ) : (
          <div className="space-y-2">
            {apartments.map((apartment: any) => (
            <div key={apartment.id} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                Apt. {apartment.number} · {apartment.staircase?.name} · Etaj {apartment.floor}
              </p>
              <p className="text-xs text-muted-foreground">
                {apartment.areaM2} m² · {apartment.status} · Locatari: {apartment.apartmentResidents?.length || apartment.residents?.length || 0}
              </p>
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
