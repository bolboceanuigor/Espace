'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminStructureApi, votesApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function AdminVoteNewPage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetType: 'ORGANIZATION' as 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE',
    buildingId: '',
    staircaseId: '',
    votingMethod: 'BY_APARTMENT' as 'BY_APARTMENT' | 'BY_AREA_M2',
    startsAt: '',
    endsAt: '',
    optionsText: 'DA\nNU\nABȚINERE',
  });

  useEffect(() => {
    Promise.all([adminStructureApi.listBuildings(), adminStructureApi.listApartments()])
      .then(([buildingsRes, apartmentsRes]) => {
        setBuildings(buildingsRes.data || []);
        const map = new Map<string, any>();
        for (const apartment of apartmentsRes.data || []) {
          if (apartment.staircase?.id && !map.has(apartment.staircase.id)) map.set(apartment.staircase.id, apartment.staircase);
        }
        setStaircases(Array.from(map.values()));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Creează sesiune de vot</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="input" placeholder="Titlu" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
          <select className="select" value={form.targetType} onChange={(event) => setForm((prev) => ({ ...prev, targetType: event.target.value as any }))}>
            <option value="ORGANIZATION">Toată asociația</option>
            <option value="BUILDING">Bloc</option>
            <option value="STAIRCASE">Scară</option>
          </select>
          {form.targetType === 'BUILDING' ? (
            <select className="select" value={form.buildingId} onChange={(event) => setForm((prev) => ({ ...prev, buildingId: event.target.value }))}>
              <option value="">Selectează blocul</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
          ) : null}
          {form.targetType === 'STAIRCASE' ? (
            <select className="select" value={form.staircaseId} onChange={(event) => setForm((prev) => ({ ...prev, staircaseId: event.target.value }))}>
              <option value="">Selectează scara</option>
              {staircases.map((staircase) => (
                <option key={staircase.id} value={staircase.id}>{staircase.name}</option>
              ))}
            </select>
          ) : null}
          <select className="select" value={form.votingMethod} onChange={(event) => setForm((prev) => ({ ...prev, votingMethod: event.target.value as any }))}>
            <option value="BY_APARTMENT">Un vot per apartament</option>
            <option value="BY_AREA_M2">Pondere după m²</option>
          </select>
          <input className="input" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))} />
          <input className="input" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))} />
        </div>
        <textarea className="input mt-2 min-h-[120px]" placeholder="Descriere" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
        <textarea className="input mt-2 min-h-[100px]" placeholder="Opțiuni, câte una pe linie" value={form.optionsText} onChange={(event) => setForm((prev) => ({ ...prev, optionsText: event.target.value }))} />
        <button
          className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          onClick={async () => {
            const created = await votesApi.adminCreate({
              title: form.title,
              description: form.description,
              targetType: form.targetType,
              buildingId: form.buildingId || undefined,
              staircaseId: form.staircaseId || undefined,
              votingMethod: form.votingMethod,
              startsAt: new Date(form.startsAt).toISOString(),
              endsAt: new Date(form.endsAt).toISOString(),
            });
            const labels = form.optionsText
              .split('\n')
              .map((label) => label.trim())
              .filter(Boolean);
            for (const label of labels) {
              await votesApi.adminAddOption(created.data.id, label);
            }
            router.push(localizedPath(`/admin/votes/${created.data.id}`));
          }}
        >
          Salvează sesiunea
        </button>
      </div>
    </div>
  );
}
