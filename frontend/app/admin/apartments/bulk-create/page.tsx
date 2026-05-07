'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Layers3, PlusCircle } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import { adminStructureApi, apartmentsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const emptyForm = {
  buildingId: '',
  staircaseId: '',
  fromNumber: '1',
  toNumber: '30',
  floorStart: '1',
  apartmentsPerFloor: '4',
  defaultAreaM2: '55',
  defaultRooms: '2',
  status: 'ACTIVE' as 'ACTIVE' | 'EMPTY' | 'DEBTOR' | 'PROBLEM',
};

type BulkSummary = {
  createdCount: number;
  skippedCount: number;
  errors: Array<{ number: string; message: string }>;
  message?: string;
};

export default function AdminApartmentsBulkCreatePage() {
  const localizedPath = useLocalizedPath();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<BulkSummary | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([adminStructureApi.listBuildings(), adminStructureApi.listAllStaircases()])
      .then(([buildingsRes, staircasesRes]) => {
        if (!active) return;
        const buildingRows = buildingsRes.data || [];
        const staircaseRows = staircasesRes.data || [];
        const firstBuildingId = buildingRows[0]?.id || '';
        const firstStaircaseId = staircaseRows.find((item) => item.buildingId === firstBuildingId)?.id || staircaseRows[0]?.id || '';
        setBuildings(buildingRows);
        setStaircases(staircaseRows);
        setForm((current) => ({ ...current, buildingId: firstBuildingId, staircaseId: firstStaircaseId }));
      })
      .catch(() => {
        if (active) setError('Nu am putut încărca blocurile și scările.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const staircaseOptions = useMemo(
    () => staircases.filter((item) => !form.buildingId || item.buildingId === form.buildingId),
    [form.buildingId, staircases],
  );

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setSummary(null);
    setError('');
    if (key === 'buildingId') {
      const nextStaircaseId = staircases.find((item) => item.buildingId === value)?.id || '';
      setForm((current) => ({ ...current, buildingId: value, staircaseId: nextStaircaseId }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }) as typeof emptyForm);
  };

  const submit = async () => {
    setError('');
    setSummary(null);
    if (!form.buildingId || !form.staircaseId) {
      setError('Alege blocul și scara.');
      return;
    }
    if (!form.fromNumber || !form.toNumber || !form.defaultAreaM2) {
      setError('Completează intervalul și suprafața implicită.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apartmentsApi.bulkCreate({
        buildingId: form.buildingId,
        staircaseId: form.staircaseId,
        fromNumber: Number(form.fromNumber),
        toNumber: Number(form.toNumber),
        floorStart: Number(form.floorStart || 1),
        apartmentsPerFloor: Number(form.apartmentsPerFloor || 1),
        defaultAreaM2: Number(String(form.defaultAreaM2).replace(',', '.')),
        defaultRooms: Number(form.defaultRooms || 1),
        status: form.status,
      });
      setSummary(res.data);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut crea apartamentele.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Adaugă apartamente în masă"
        description="Creează rapid apartamente pentru o scară, cu etaje calculate automat."
        rightSlot={
          <Link href={localizedPath('/admin/apartments')} className="rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold hover:bg-muted/60">
            Înapoi la apartamente
          </Link>
        }
      />

      {loading ? (
        <Card className="p-4">
          <LoadingState label="Se încarcă datele..." rows={3} />
        </Card>
      ) : (
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label">Bloc</span>
              <select className="select" value={form.buildingId} onChange={(event) => updateForm('buildingId', event.target.value)}>
                <option value="">Alege blocul</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>{building.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Scara</span>
              <select className="select" value={form.staircaseId} onChange={(event) => updateForm('staircaseId', event.target.value)}>
                <option value="">Alege scara</option>
                {staircaseOptions.map((staircase) => (
                  <option key={staircase.id} value={staircase.id}>{staircase.name}</option>
                ))}
              </select>
            </label>

            <Field label="De la apartamentul nr." value={form.fromNumber} onChange={(value) => updateForm('fromNumber', value)} />
            <Field label="Până la apartamentul nr." value={form.toNumber} onChange={(value) => updateForm('toNumber', value)} />
            <Field label="Etaj de start" value={form.floorStart} onChange={(value) => updateForm('floorStart', value)} />
            <Field label="Apartamente pe etaj" value={form.apartmentsPerFloor} onChange={(value) => updateForm('apartmentsPerFloor', value)} />
            <Field label="Suprafață implicită m²" value={form.defaultAreaM2} onChange={(value) => updateForm('defaultAreaM2', value)} />
            <Field label="Camere implicit" value={form.defaultRooms} onChange={(value) => updateForm('defaultRooms', value)} />

            <label className="block md:col-span-2">
              <span className="label">Status</span>
              <select className="select" value={form.status} onChange={(event) => updateForm('status', event.target.value as typeof form.status)}>
                <option value="ACTIVE">Activ</option>
                <option value="EMPTY">Nelocuit</option>
                <option value="DEBTOR">Datornic</option>
                <option value="PROBLEM">Problemă</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Layers3 className="mt-0.5 h-4 w-4" />
              <p>
                Sistemul omite automat apartamentele existente în aceeași scară și nu creează duplicate.
              </p>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusCircle className="h-4 w-4" />
              {submitting ? 'Se creează...' : 'Creează apartamente'}
            </button>
          </div>
        </Card>
      )}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {summary ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-emerald-700">Apartamentele au fost create.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryItem label="Create" value={summary.createdCount} />
            <SummaryItem label="Omise" value={summary.skippedCount} />
            <SummaryItem label="Erori" value={summary.errors?.length || 0} />
          </div>
          {summary.errors?.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Apartamente cu erori</p>
              <div className="mt-2 space-y-1">
                {summary.errors.slice(0, 8).map((item) => (
                  <p key={item.number}>Apt. {item.number}: {item.message}</p>
                ))}
              </div>
            </div>
          ) : null}
          <Link href={localizedPath('/admin/apartments')} className="mt-4 inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            Vezi lista apartamentelor
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
