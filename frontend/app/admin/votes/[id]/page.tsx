'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { votesApi } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Activă',
  CLOSED: 'Închisă',
  PUBLISHED: 'Publicată',
};

const TARGET_LABEL: Record<string, string> = {
  ORGANIZATION: 'Toată asociația',
  BUILDING: 'Bloc',
  STAIRCASE: 'Scară',
};

const VOTING_METHOD_LABEL: Record<string, string> = {
  BY_APARTMENT: 'Un vot per apartament',
  BY_AREA_M2: 'Pondere după m²',
};

export default function AdminVoteDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);
  const [newOption, setNewOption] = useState('');

  const load = useCallback(async () => {
    const res = await votesApi.adminGetOne(params.id);
    setRow(res.data);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!row) return <div className="text-sm text-muted-foreground">Se încarcă votul...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {TARGET_LABEL[row.targetType] || row.targetType} • {VOTING_METHOD_LABEL[row.votingMethod] || row.votingMethod} • {STATUS_LABEL[row.status] || row.status}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminActivate(row.id); await load(); }}>Activează</button>
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminClose(row.id); await load(); }}>Închide</button>
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminPublish(row.id); await load(); }}>Publică</button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Opțiuni</p>
        <div className="mt-2 space-y-1">
          {(row.options || []).map((option: any) => (
            <div key={option.id} className="text-sm text-foreground">{option.label}</div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="Opțiune nouă" value={newOption} onChange={(event) => setNewOption(event.target.value)} />
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminAddOption(row.id, newOption.trim()); setNewOption(''); await load(); }}>
            Adaugă opțiune
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Eligibilitate și participare</p>
        <p className="mt-2 text-sm text-muted-foreground">Apartamente eligibile: {row.eligibleSummary?.totalEligibleApartments || 0}</p>
        <p className="text-sm text-muted-foreground">Suprafață eligibilă m²: {row.eligibleSummary?.totalEligibleAreaM2 || 0}</p>
        <p className="text-sm text-muted-foreground">Voturi exprimate: {row.results?.totalVotesCast || 0}</p>
        <p className="text-sm text-muted-foreground">Participare: {row.results?.turnoutPercentage || 0}%</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Rezultate pe opțiuni</p>
        <div className="mt-2 space-y-1">
          {(row.results?.resultsByOption || []).map((item: any) => (
            <div key={item.voteOptionId} className="text-sm text-foreground">
              {item.label}: {item.votesCount} voturi / pondere {item.weightTotal}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Voturi pe apartament</p>
        <div className="mt-2 space-y-1">
          {(row.results?.votes || []).map((vote: any) => (
            <div key={vote.id} className="text-sm text-foreground">
              {vote.apartment?.building?.name} / {vote.apartment?.staircase?.name} / #{vote.apartment?.number} - {vote.option?.label} (pondere {vote.weight})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
