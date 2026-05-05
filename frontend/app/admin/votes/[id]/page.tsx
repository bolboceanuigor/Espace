'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { votesApi } from '@/lib/api';

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

  if (!row) return <div className="text-sm text-muted-foreground">Loading vote...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{row.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {row.targetType} • {row.votingMethod} • {row.status}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminActivate(row.id); await load(); }}>Activate</button>
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminClose(row.id); await load(); }}>Close</button>
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminPublish(row.id); await load(); }}>Publish</button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Options</p>
        <div className="mt-2 space-y-1">
          {(row.options || []).map((option: any) => (
            <div key={option.id} className="text-sm text-foreground">{option.label}</div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="New option" value={newOption} onChange={(event) => setNewOption(event.target.value)} />
          <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={async () => { await votesApi.adminAddOption(row.id, newOption); setNewOption(''); await load(); }}>
            Add option
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Eligibility / turnout</p>
        <p className="mt-2 text-sm text-muted-foreground">Eligible apartments: {row.eligibleSummary?.totalEligibleApartments || 0}</p>
        <p className="text-sm text-muted-foreground">Eligible area m2: {row.eligibleSummary?.totalEligibleAreaM2 || 0}</p>
        <p className="text-sm text-muted-foreground">Votes cast: {row.results?.totalVotesCast || 0}</p>
        <p className="text-sm text-muted-foreground">Turnout: {row.results?.turnoutPercentage || 0}%</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Results by option</p>
        <div className="mt-2 space-y-1">
          {(row.results?.resultsByOption || []).map((item: any) => (
            <div key={item.voteOptionId} className="text-sm text-foreground">
              {item.label}: {item.votesCount} votes / weight {item.weightTotal}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Votes by apartment</p>
        <div className="mt-2 space-y-1">
          {(row.results?.votes || []).map((vote: any) => (
            <div key={vote.id} className="text-sm text-foreground">
              {vote.apartment?.building?.name} / {vote.apartment?.staircase?.name} / #{vote.apartment?.number} - {vote.option?.label} ({vote.weight})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
