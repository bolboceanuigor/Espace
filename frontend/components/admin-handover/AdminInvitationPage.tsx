'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { invitationsApi } from '@/lib/api';
import { saveAuth } from '@/lib/auth';

export function AdminInvitationPage({ token, locale = 'ro' }: { token: string; locale?: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) return;
    setDetailsLoading(true);
    setError('');
    invitationsApi
      .getPublicAdminInvitation(token)
      .then((res) => setDetails(res.data))
      .catch((err) => setError(invitationMessage(err?.message)))
      .finally(() => setDetailsLoading(false));
  }, [token]);

  const isPending = details?.status === 'PENDING';

  const submit = async () => {
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError('Parola trebuie să aibă cel puțin 8 caractere.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await invitationsApi.acceptPublicAdminInvitation(token, { password, confirmPassword });
      const payload = res.data || {};
      setSuccess('Invitația a fost acceptată.');
      if (payload.accessToken && payload.user) {
        saveAuth(payload.accessToken, payload.user);
        router.replace(payload.redirectPath || `/${locale}/admin/first-login`);
        return;
      }
      router.replace(`/${locale}/login?adminInvitationAccepted=1`);
    } catch (err: any) {
      setError(invitationMessage(err?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[1.5rem] border border-border/70 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.10)] lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="border-b border-border/70 bg-[#101513] p-6 text-white lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">Espace</p>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Invitație Admin</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
              Ai fost invitat să administrezi această organizație în Espace.
            </p>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-white/50">Organizație</p>
              <p className="mt-2 text-xl font-semibold">{details?.organization?.name || 'Se încarcă...'}</p>
            </div>
          </aside>

          <div className="p-6 sm:p-8">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Acceptă invitația</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Setează parola pentru contul de Admin. După acceptare vei intra în checklist-ul inițial al organizației.
              </p>

              {detailsLoading ? <Notice>Se verifică invitația...</Notice> : null}
              {error ? <Notice tone="error">{error}</Notice> : null}
              {success ? <Notice tone="success">{success}</Notice> : null}

              {details ? (
                <div className="mt-5 grid gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm sm:grid-cols-2">
                  <Info label="Admin" value={details.adminName || '-'} />
                  <Info label="Status" value={statusLabel(details.status)} />
                  <Info label="Email" value={details.emailMasked || '-'} />
                  <Info label="Telefon" value={details.phoneMasked || '-'} />
                  <Info label="Expiră la" value={details.expiresAt ? formatDate(details.expiresAt) : '-'} />
                  <Info label="Acceptată la" value={details.acceptedAt ? formatDate(details.acceptedAt) : '-'} />
                </div>
              ) : null}

              {!detailsLoading && !isPending ? (
                <Notice tone="error">{details?.message || 'Invitația nu poate fi folosită.'}</Notice>
              ) : null}

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="label">Parolă</span>
                  <input className="input" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={!isPending} />
                </label>
                <label className="block">
                  <span className="label">Confirmă parola</span>
                  <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={!isPending} />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!isPending || submitting || !password || !confirmPassword}
                  className="min-h-11 w-full rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Se acceptă...' : 'Acceptă invitația'}
                </button>
              </div>

              <Link href={`/${locale}/login`} className="mt-5 inline-block text-sm font-semibold text-foreground underline">
                Înapoi la autentificare
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'error' }) {
  const classes =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-border/70 bg-muted/40 text-muted-foreground';
  return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${classes}`}>{children}</div>;
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    PENDING: 'În așteptare',
    ACCEPTED: 'Acceptată',
    EXPIRED: 'Expirată',
    CANCELLED: 'Anulată',
  };
  return status ? labels[status] || status : '-';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function invitationMessage(message?: string) {
  if (!message) return 'Invitația nu poate fi verificată.';
  if (message.includes('expired') || message.includes('expirat')) return 'Invitația a expirat.';
  if (message.includes('accepted') || message.includes('folosită')) return 'Invitația a fost deja acceptată.';
  return message;
}
