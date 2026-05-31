'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Building2,
  CheckCircle2,
  FileText,
  Home,
  Gauge,
  Megaphone,
  Users,
  ListChecks,
  AlertTriangle,
  ClipboardList,
  ReceiptText,
} from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/ui';
import { invitationsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const icons: Record<string, ReactNode> = {
  confirmOrganizationInfo: <Building2 className="h-5 w-5" />,
  confirmStructure: <Building2 className="h-5 w-5" />,
  confirmApartments: <Home className="h-5 w-5" />,
  confirmResidents: <Users className="h-5 w-5" />,
  reviewDataQuality: <ListChecks className="h-5 w-5" />,
  createFirstMeterReadingPeriod: <Gauge className="h-5 w-5" />,
  createFirstBillingDraft: <ReceiptText className="h-5 w-5" />,
  confirmDocuments: <FileText className="h-5 w-5" />,
  welcomeAnnouncementCreated: <Megaphone className="h-5 w-5" />,
};

export function AdminFirstLoginPage() {
  const localizedPath = useLocalizedPath();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invitationsApi.getAdminFirstLogin();
      const payload = res.data;
      setData(payload);
      setNote(payload?.note || '');
      setChecked(
        Object.fromEntries((payload?.checklist || []).map((item: any) => [item.key, item.confirmed === true])),
      );
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Nu am putut încărca verificarea inițială.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const warnings = data?.warnings || [];
  const completedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );
  const totalCount = data?.checklist?.length || 0;

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await invitationsApi.updateAdminFirstLogin({ ...checked, note });
      setData(res.data);
      setSuccess('Progresul a fost salvat.');
    } catch (saveError: any) {
      setError(String(saveError?.message || 'Nu am putut salva progresul.'));
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    setCompleting(true);
    setError('');
    setSuccess('');
    try {
      await invitationsApi.updateAdminFirstLogin({ ...checked, note });
      const res = await invitationsApi.completeAdminFirstLogin();
      setSuccess(res.data?.nextRecommendedAction || 'Verificarea inițială a fost finalizată.');
      await load();
    } catch (completeError: any) {
      setError(String(completeError?.message || 'Nu am putut finaliza verificarea inițială.'));
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Card>Se încarcă verificarea inițială...</Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <PageHeader
        title={data?.organization?.name || 'First Login'}
        description="Bun venit în Espace. Verifică datele inițiale ale organizației înainte de lansare."
        rightSlot={
          <Link href={localizedPath('/admin')} className="inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
            Dashboard Admin
          </Link>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Progres verificare</p>
              <p className="text-2xl font-semibold text-foreground">{completedCount}/{totalCount}</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%` }} />
          </div>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <p>Blocuri: {data?.stats?.buildingsCount || 0}</p>
            <p>Apartamente: {data?.stats?.apartmentsCount || 0}</p>
            <p>Locatari: {data?.stats?.residentsCount || 0}</p>
            <p>Documente: {data?.stats?.documentsCount || 0}</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-semibold text-foreground">Puncte rămase</h2>
              {warnings.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {warnings.map((warning: any) => (
                    <Badge key={`${warning.key}-${warning.message}`} variant="warning">{warning.message}</Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Nu există probleme critice pentru verificarea inițială.</p>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.checklist || []).map((item: any) => (
          <Card key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted text-foreground">
                  {icons[item.key] || <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Badge variant={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
            </div>
            {item.missing?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.missing.map((message: string) => <Badge key={message} variant="warning">{message}</Badge>)}
              </div>
            ) : null}
            <label className="mt-4 flex min-h-10 items-center gap-2 rounded-2xl border border-border/70 bg-muted/25 px-3 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={checked[item.key] === true}
                onChange={(event) => setChecked({ ...checked, [item.key]: event.target.checked })}
              />
              Confirm verificarea
            </label>
            <Link href={item.actionUrl || localizedPath('/admin')} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground hover:bg-muted/60">
              {item.actionLabel || 'Verifică'}
            </Link>
          </Card>
        ))}
      </section>

      <Card>
        <label className="block">
          <span className="label">Notă pentru predare</span>
          <textarea
            className="min-h-[110px] w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Observații interne sau pași rămași"
          />
        </label>
        {warnings.length ? (
          <p className="mt-3 text-sm text-amber-700">Poți continua, dar aceste puncte rămân de completat.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={save} disabled={saving} className="min-h-10 rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground disabled:opacity-60">
            {saving ? 'Se salvează...' : 'Salvează progres'}
          </button>
          <button type="button" onClick={complete} disabled={completing} className="min-h-10 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
            {completing ? 'Se finalizează...' : 'Finalizează verificarea inițială'}
          </button>
        </div>
      </Card>
    </main>
  );
}

function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const classes = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800';
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${classes}`}>{children}</div>;
}

function statusLabel(status?: string) {
  if (status === 'complete') return 'Complet';
  if (status === 'warning') return 'Warning';
  return 'Lipsă';
}

function statusTone(status?: string): 'success' | 'warning' | 'neutral' {
  if (status === 'complete') return 'success';
  if (status === 'warning') return 'warning';
  return 'neutral';
}
