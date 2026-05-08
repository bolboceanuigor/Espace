'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { invitationsApi } from '@/lib/api';
import { getDashboardForRole, saveAuth } from '@/lib/auth';
import { defaultLocale, isLocale } from '@/i18n';

export default function AcceptInvitationTokenPage() {
  const router = useRouter();
  const params = useParams<{ token: string; locale?: string }>();
  const token = params?.token || '';
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [details, setDetails] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) return;
    setDetailsLoading(true);
    setError('');
    invitationsApi
      .getByToken(token)
      .then((res) => setDetails(res.data))
      .catch((err) => setError(invitationErrorMessage(err?.message)))
      .finally(() => setDetailsLoading(false));
  }, [token]);

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
    setLoading(true);
    try {
      const res = await invitationsApi.acceptByToken(token, password, confirmPassword);
      const payload = res.data || {};
      setSuccess('Contul a fost activat.');
      if (payload.accessToken && payload.user) {
        saveAuth(payload.accessToken, payload.user);
        router.replace(payload.redirectPath || getDashboardForRole(payload.user.role, locale));
        return;
      }
      router.replace(`/${locale}/login?activated=1`);
    } catch (err: any) {
      setError(invitationErrorMessage(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-lg items-center px-5 py-10">
      <div className="w-full rounded-[1.5rem] border border-border/60 bg-card p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Espace · A.P.C.</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Activează contul</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Setează parola pentru contul tău. După activare vei fi redirecționat în zona potrivită rolului tău.
        </p>

        {detailsLoading ? <p className="mt-4 rounded-xl bg-muted/35 px-3 py-2 text-sm text-muted-foreground">Se încarcă invitația...</p> : null}
        {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p> : null}
        {details ? (
          <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-foreground">
            <p><span className="font-semibold">Asociație:</span> {details.organization?.name || '-'}</p>
            <p><span className="font-semibold">Rol:</span> {roleLabel(details.role)}</p>
            <p><span className="font-semibold">Email:</span> {details.email}</p>
            {details.apartment ? (
              <p><span className="font-semibold">Apartament:</span> {details.apartment.building?.name || 'Bloc'} / {details.apartment.staircase?.name || 'Scara'} / Apt. {details.apartment.number}</p>
            ) : null}
            <p><span className="font-semibold">Expiră la:</span> {details.expiresAt ? new Intl.DateTimeFormat('ro-MD').format(new Date(details.expiresAt)) : '-'}</p>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="label">Parolă</span>
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
              placeholder="Cel puțin 8 caractere"
            />
          </label>
          <label className="block">
            <span className="label">Confirmă parola</span>
            <input
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input"
              placeholder="Repetă parola"
            />
          </label>
          <button
            type="button"
            disabled={loading || !token || !password || !confirmPassword}
            className="min-h-11 w-full rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            onClick={submit}
          >
            {loading ? 'Se activează...' : 'Activează contul'}
          </button>
        </div>
        <Link href={`/${locale}/login`} className="mt-4 inline-block text-sm font-medium text-foreground underline">
          Înapoi la autentificare
        </Link>
      </div>
    </main>
  );
}

function roleLabel(role?: string) {
  if (String(role || '').toUpperCase() === 'ADMIN') return 'Administrator';
  if (String(role || '').toUpperCase() === 'RESIDENT') return 'Locatar';
  return role || '-';
}

function invitationErrorMessage(message?: string) {
  const value = String(message || '');
  if (value.includes('expirat') || value.includes('expired')) return 'Invitația a expirat.';
  if (value.includes('Parolele nu coincid')) return 'Parolele nu coincid.';
  if (value.includes('cel puțin 8')) return 'Parola trebuie să aibă cel puțin 8 caractere.';
  if (value.includes('deja') || value.includes('already')) return 'Invitația a fost deja folosită.';
  return value || 'Invitația nu este validă.';
}
