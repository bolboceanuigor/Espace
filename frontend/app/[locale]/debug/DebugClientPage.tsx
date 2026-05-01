'use client';

import { useMemo, useState } from 'react';

type DebugResult = {
  endpoint: '/api/health' | '/api/me';
  status: number;
  data: unknown;
  at: string;
};

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BASE_API_URL = RAW_API_URL.replace(/\/+$/, '');

async function requestJson(path: '/api/health' | '/api/me') {
  const response = await fetch(`${BASE_API_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = { message: 'Non-JSON response' };
  }

  return { status: response.status, data };
}

export function DebugClientPage() {
  const [loading, setLoading] = useState<'health' | 'me' | null>(null);
  const [lastResult, setLastResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const hasApiUrl = useMemo(() => Boolean(BASE_API_URL), []);

  const runCheck = async (endpoint: '/api/health' | '/api/me', key: 'health' | 'me') => {
    setLoading(key);
    setError(null);
    setErrorCode(null);

    try {
      const result = await requestJson(endpoint);
      setLastResult({
        endpoint,
        status: result.status,
        data: result.data,
        at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const maybeCode = (err as { code?: string } | null)?.code;
      const maybeMessage = (err as { message?: string } | null)?.message;
      setErrorCode(maybeCode || null);
      setError(maybeMessage || (err instanceof Error ? err.message : 'Request failed'));
      setLastResult(null);
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h1 className="text-xl font-semibold tracking-tight">Debug</h1>
        <p className="mt-2 text-sm text-muted-foreground">Quick connectivity check for backend health and auth cookie session.</p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">NEXT_PUBLIC_API_URL:</span>{' '}
          <code className="rounded bg-muted/30 px-1 py-0.5 text-xs">{RAW_API_URL || '(missing)'}</code>
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runCheck('/api/health', 'health')}
            disabled={loading !== null || !hasApiUrl}
            className="rounded-xl border border-border/60 px-3 py-2 text-sm transition duration-150 ease-out hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === 'health' ? 'Pinging health...' : 'Ping health'}
          </button>

          <button
            type="button"
            onClick={() => runCheck('/api/me', 'me')}
            disabled={loading !== null || !hasApiUrl}
            className="rounded-xl border border-border/60 px-3 py-2 text-sm transition duration-150 ease-out hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === 'me' ? 'Checking /api/me...' : 'Me'}
          </button>
        </div>

        {!hasApiUrl ? (
          <p className="mt-4 text-sm text-destructive">Missing NEXT_PUBLIC_API_URL in frontend env.</p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
            <p className="text-destructive">{error}</p>
            {errorCode ? <p className="mt-1 text-xs text-muted-foreground">code: {errorCode}</p> : null}
            {error.toLowerCase().includes('failed to fetch') ? (
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                <li>backend not running</li>
                <li>wrong API url</li>
                <li>CORS misconfigured</li>
                <li>port mismatch</li>
              </ol>
            ) : null}
          </div>
        ) : null}

        {lastResult ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Endpoint:</span> {lastResult.endpoint}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> {lastResult.status}
            </p>
            <p>
              <span className="text-muted-foreground">Time:</span> {lastResult.at}
            </p>
            <pre className="overflow-auto rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              {JSON.stringify(lastResult.data, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </main>
  );
}
