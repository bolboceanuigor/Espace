'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { votesApi } from '@/lib/api';

export default function ResidentVoteDetailsPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);
  const [apartmentId, setApartmentId] = useState('');
  const [optionId, setOptionId] = useState('');

  const load = async () => {
    const res = await votesApi.residentGetOne(params.id);
    setRow(res.data);
    setApartmentId((res.data?.relevantApartments || []).find((item: any) => item.residentType === 'OWNER')?.apartmentId || '');
    setOptionId(res.data?.options?.[0]?.id || '');
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [params.id]);

  if (!row) return <div className="text-sm text-muted-foreground">Loading vote...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">{row.status} • {row.targetType} • {row.votingMethod}</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Options</p>
        <div className="mt-2 space-y-1">
          {(row.options || []).map((option: any) => (
            <label key={option.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="radio" name="vote-option" value={option.id} checked={optionId === option.id} onChange={(event) => setOptionId(event.target.value)} />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Select apartment (OWNER)</p>
        <select className="select mt-2" value={apartmentId} onChange={(event) => setApartmentId(event.target.value)}>
          <option value="">Select apartment</option>
          {(row.relevantApartments || [])
            .filter((item: any) => item.residentType === 'OWNER')
            .map((item: any) => (
              <option key={item.apartmentId} value={item.apartmentId}>
                #{item.number} (area {item.areaM2 || 0})
              </option>
            ))}
        </select>
        <button
          className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!row.canVoteNow || !apartmentId || !optionId}
          onClick={async () => {
            await votesApi.residentCast(row.id, { apartmentId, voteOptionId: optionId });
            await load();
          }}
        >
          Cast vote
        </button>
      </div>

      {row.status === 'PUBLISHED' && row.results ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-sm font-medium text-foreground">Published results</p>
          <p className="mt-1 text-sm text-muted-foreground">Turnout: {row.results.turnoutPercentage}%</p>
          <div className="mt-2 space-y-1">
            {(row.results.resultsByOption || []).map((item: any) => (
              <div key={item.voteOptionId} className="text-sm text-foreground">
                {item.label}: {item.votesCount} / weight {item.weightTotal}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
