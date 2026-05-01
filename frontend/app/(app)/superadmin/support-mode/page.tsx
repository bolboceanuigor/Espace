'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { superadminApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/ui/Button';

export default function SuperadminSupportModePage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    superadminApi
      .currentSupportSession()
      .then((res) => {
        if (!active) return;
        setSession(res.data || null);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <MobilePageHeader title="Support Mode" subtitle="Inspect and control active support sessions." />
      {loading ? <LoadingState label="Se încarcă sesiunea..." /> : null}
      {!loading && !session ? (
        <EmptyState
          title="Nu există sesiune activă"
          description="Pornește o sesiune support din pagina unei organizații."
        />
      ) : null}
      {session ? (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-sm text-foreground">
            Active organization: <strong>{session.organization?.name || '-'}</strong>
          </p>
          <p className="text-xs text-muted-foreground">Started at: {session.startedAt ? new Date(session.startedAt).toLocaleString() : '-'}</p>
          <Button
            className="mt-3"
            variant="danger"
            onClick={async () => {
              await superadminApi.endSupportSession(session.id);
              setSession(null);
            }}
          >
            End support session
          </Button>
        </div>
      ) : null}
      <Link href="/superadmin/organizations" className="text-sm text-primary hover:underline">
        Go to organizations
      </Link>
    </div>
  );
}
