'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { invitationsApi } from '@/lib/api';

export default function AcceptInvitationTokenPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token || '';
  const [details, setDetails] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    invitationsApi
      .getByToken(token)
      .then((res) => setDetails(res.data))
      .catch((err) => setError(err?.message || 'Invitation invalid'));
  }, [token]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-5">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Accept invitation</h1>
        {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {details ? (
          <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-foreground">
            <p>Organization: {details.organization?.name}</p>
            <p>Role: {details.role}</p>
            <p>Email: {details.email}</p>
            <p>Apartment: {details.apartment ? `${details.apartment.building?.name} / ${details.apartment.staircase?.name} / #${details.apartment.number}` : '-'}</p>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          <input
            type="password"
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder="Create password"
          />
          <button
            type="button"
            disabled={loading || !token || !password}
            className="w-full rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            onClick={async () => {
              setLoading(true);
              setError('');
              try {
                await invitationsApi.acceptByToken(token, password);
                router.replace('/ro/resident');
              } catch (err: any) {
                setError(err?.message || 'Failed to accept invitation');
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Loading...' : 'Accept invitation'}
          </button>
        </div>
        <Link href="/login" className="mt-4 inline-block text-sm text-foreground underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}
