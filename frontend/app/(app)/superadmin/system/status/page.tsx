'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Database, Mail, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { Card, PageHeader, StatCard } from '@/components/ui';
import { systemMonitoringApi } from '@/lib/api';

type SystemStatus = {
  checkedAt: string;
  apiStatus: 'online' | 'offline';
  databaseStatus: 'connected' | 'unavailable';
  service: string;
  counts: {
    organizations: number;
    users: number;
    apartments: number;
  };
  email: {
    configured: boolean;
    provider: 'resend' | 'smtp' | null;
    from?: string;
  };
};

export default function SuperadminSystemStatusPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, database, email] = await Promise.all([
        systemMonitoringApi.health(),
        systemMonitoringApi.healthDb(),
        systemMonitoringApi.emailStatus().catch(() => ({ data: { configured: false, provider: null, from: undefined } })),
      ]);
      const healthData = health.data || {};
      const dbData = database.data || {};
      const emailData = email.data || {};
      setData({
        checkedAt: new Date().toISOString(),
        apiStatus: healthData.status === 'ok' || healthData.ok === true ? 'online' : 'offline',
        databaseStatus: dbData.status === 'ok' && dbData.database === 'connected' ? 'connected' : 'unavailable',
        service: healthData.service || 'espace-api',
        counts: {
          organizations: Number(dbData.counts?.organizations ?? 0),
          users: Number(dbData.counts?.users ?? 0),
          apartments: Number(dbData.counts?.apartments ?? 0),
        },
        email: {
          configured: Boolean(emailData.configured),
          provider: emailData.provider || null,
          from: emailData.from,
        },
      });
    } catch {
      setError('Nu am putut încărca statusul sistemului.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const stats = useMemo(() => [
    {
      label: 'API',
      value: data?.apiStatus === 'online' ? 'Online' : loading ? '...' : 'Offline',
      description: data?.service || 'espace-api',
      icon: <Server className="h-5 w-5" />,
      tone: data?.apiStatus === 'online' ? 'success' as const : 'warning' as const,
    },
    {
      label: 'Baza de date',
      value: data?.databaseStatus === 'connected' ? 'Conectată' : loading ? '...' : 'Indisponibilă',
      description: 'Supabase PostgreSQL',
      icon: <Database className="h-5 w-5" />,
      tone: data?.databaseStatus === 'connected' ? 'success' as const : 'warning' as const,
    },
    {
      label: 'Email',
      value: data?.email.configured ? 'Configurat' : loading ? '...' : 'Neconfigurat',
      description: data?.email.provider ? `${data.email.provider}${data.email.from ? ` · ${data.email.from}` : ''}` : 'Invitațiile se trimit manual',
      icon: <Mail className="h-5 w-5" />,
      tone: data?.email.configured ? 'success' as const : 'warning' as const,
    },
    {
      label: 'Asociații',
      value: String(data?.counts.organizations ?? 0),
      description: 'Înregistrate în platformă',
      icon: <ShieldCheck className="h-5 w-5" />,
    },
    {
      label: 'Utilizatori',
      value: String(data?.counts.users ?? 0),
      description: 'Conturi create',
      icon: <Activity className="h-5 w-5" />,
    },
    {
      label: 'Apartamente',
      value: String(data?.counts.apartments ?? 0),
      description: 'Unități rezidențiale',
      icon: <Server className="h-5 w-5" />,
    },
  ], [data, loading]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Status sistem"
        description="Verificare rapidă pentru API, baza de date și volumul principal de date din platforma Espace."
        rightSlot={
          <button
            type="button"
            onClick={() => load().catch(() => undefined)}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Reîmprospătează
          </button>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </section>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Control operațional</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Verificare simplă pentru disponibilitatea platformei și conexiunea la baza de date.
            </p>
          </div>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {data?.checkedAt ? `Ultima verificare: ${new Date(data.checkedAt).toLocaleString('ro-RO')}` : loading ? 'Se verifică...' : 'Neverificat'}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Mini label="API" value={data?.apiStatus === 'online' ? 'Răspunde corect' : 'Necesită verificare'} />
          <Mini label="Baza de date" value={data?.databaseStatus === 'connected' ? 'Conexiune activă' : 'Conexiune indisponibilă'} />
          <Mini label="Email" value={data?.email.configured ? `Configurat${data.email.provider ? ` (${data.email.provider})` : ''}` : 'Neconfigurat pentru trimitere automată'} />
          <Mini label="Securitate" value="Fără secrete expuse în răspuns" />
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
