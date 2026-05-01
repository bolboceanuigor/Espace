'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadsApi } from '@/lib/api';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'DEMO', 'NOTE'] as const;

export default function SuperadminLeadDetailsPage() {
  const params = useParams<{ id: string; locale?: string }>();
  const router = useRouter();
  const leadId = params?.id;
  const locale = typeof params?.locale === 'string' ? params.locale : 'ro';

  const [lead, setLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityType, setActivityType] = useState<(typeof ACTIVITY_TYPES)[number]>('NOTE');
  const [activityContent, setActivityContent] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await leadsApi.superadminGet(leadId);
      setLead(res.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    load().catch(() => setLoading(false));
  }, [leadId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading lead...</div>;
  if (!lead) return <div className="text-sm text-destructive">Lead not found.</div>;

  return (
    <div className="space-y-4">
      <button onClick={() => router.push(`/${locale}/superadmin/leads`)} className="text-sm text-primary hover:underline">
        Back to leads
      </button>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
        <p className="text-sm text-muted-foreground">{lead.associationName || '-'}</p>
        <p className="text-sm">{lead.phone} · {lead.email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {lead.city || '-'} · {lead.source} · {lead.status}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{lead.notes || 'No notes yet.'}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <button className="rounded-md border border-border px-3 py-2 text-xs" onClick={async () => { await leadsApi.superadminUpdate(leadId, { status: 'DEMO_SCHEDULED' }); await load(); }}>
          Schedule demo
        </button>
        <button className="rounded-md border border-border px-3 py-2 text-xs" onClick={async () => { await leadsApi.superadminUpdate(leadId, { status: 'TRIAL_STARTED' }); await load(); }}>
          Start trial
        </button>
        <button className="rounded-md border border-border px-3 py-2 text-xs" onClick={async () => { await leadsApi.superadminConvertToOrganization(leadId); await load(); }}>
          Convert to organization
        </button>
        <button className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive" onClick={async () => { await leadsApi.superadminUpdate(leadId, { status: 'LOST' }); await load(); }}>
          Mark lost
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add activity</h2>
        <div className="flex gap-2">
          <select value={activityType} onChange={(e) => setActivityType(e.target.value as any)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input value={activityContent} onChange={(e) => setActivityContent(e.target.value)} className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm" placeholder="Activity details..." />
          <button
            className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground"
            onClick={async () => {
              if (!activityContent.trim()) return;
              await leadsApi.superadminAddActivity(leadId, { type: activityType, content: activityContent.trim() });
              setActivityContent('');
              await load();
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Activity timeline</h2>
        <div className="space-y-2">
          {(lead.activities || []).map((activity: any) => (
            <div key={activity.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">
                {activity.type} · {new Date(activity.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 text-sm">{activity.content}</p>
              <p className="text-xs text-muted-foreground">
                by {activity.createdByUser?.firstName || activity.createdByUser?.email || 'User'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

