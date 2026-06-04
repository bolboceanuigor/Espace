'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldAlert } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { clearAuth, getToken, getUser } from '@/lib/auth';

const SHOW_DEV_RESET_LINK = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SHOW_DEV_RESET_LINK === 'true';

function unwrap<T = any>(response: any): T {
  return (response?.data ?? response) as T;
}

function authShell(children: React.ReactNode) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center justify-center">{children}</div>
    </main>
  );
}

function statusCopy(status?: string | null, warningCode?: string | null) {
  if (warningCode === 'NO_RESIDENT_LINK' || status === 'NO_RESIDENT_LINK') {
    return {
      title: 'Cont neasociat unui locatar',
      text: 'Contul tău există, dar nu este încă legat de un locatar dintr-o asociație.',
    };
  }
  if (status === 'SUSPENDED') {
    return {
      title: 'Acces suspendat',
      text: 'Accesul tău la portal este suspendat. Contactează administratorul asociației.',
    };
  }
  if (status === 'REVOKED') {
    return {
      title: 'Acces revocat',
      text: 'Accesul tău la portal a fost revocat. Contactează administratorul asociației.',
    };
  }
  if (warningCode === 'RESIDENT_APARTMENT_LINK_MISSING') {
    return {
      title: 'Cont fără apartament legat',
      text: 'Contul tău este activ, dar nu este legat de niciun apartament.',
    };
  }
  return {
    title: 'Accesul la portal nu este activ',
    text: 'Contul tău trebuie activat de administrator sau printr-o invitație validă.',
  };
}

export function ForgotPasswordPageContent({ locale = 'ro' }: { locale?: string }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devResetLink, setDevResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setDevResetLink('');
    try {
      const response = await authApi.forgotPassword({ email: email.trim().toLowerCase(), locale });
      const payload = unwrap<any>(response);
      setMessage(payload?.message || 'Dacă există un cont cu acest email, instrucțiunile de resetare vor fi pregătite.');
      if (payload?.devResetLink) setDevResetLink(payload.devResetLink);
    } catch {
      setMessage('Dacă există un cont cu acest email, instrucțiunile de resetare vor fi pregătite.');
    } finally {
      setLoading(false);
    }
  }

  return authShell(
    <section className="w-full rounded-[1.5rem] border border-border/70 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Am uitat parola</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Introdu emailul contului. Trimiterea emailurilor va fi disponibilă ulterior; pentru resetare poți contacta administratorul asociației.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-2xl border border-border/70 bg-white px-4 text-sm outline-none transition focus:ring-2 focus:ring-foreground/10"
            placeholder="email@espace.md"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
        >
          {loading ? 'Se pregătește...' : 'Pregătește resetarea'}
        </button>
      </form>
      {message ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p> : null}
      {SHOW_DEV_RESET_LINK && devResetLink ? (
        <p className="mt-3 break-all rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Link intern de dezvoltare: <Link className="font-semibold underline" href={devResetLink}>{devResetLink}</Link>
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      <Link href={`/${locale}/login`} className="mt-5 inline-flex items-center text-sm font-semibold text-foreground underline underline-offset-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la login
      </Link>
    </section>,
  );
}

export function ResetPasswordPageContent({ token, locale = 'ro' }: { token: string; locale?: string }) {
  const router = useRouter();
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setValidating(true);
    authApi
      .validateResetToken(token)
      .then((response) => {
        const payload = unwrap<any>(response);
        if (active) setValid(Boolean(payload?.valid));
      })
      .catch(() => active && setValid(false))
      .finally(() => active && setValidating(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) {
      setError('Parola trebuie să aibă cel puțin 8 caractere.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }
    setSaving(true);
    try {
      await authApi.resetPasswordWithToken(token, { password, confirmPassword });
      setMessage('Parola a fost schimbată. Te poți autentifica.');
      setTimeout(() => router.replace(`/${locale}/login?passwordReset=1`), 900);
    } catch (err: any) {
      setError(err?.message || 'Linkul de resetare nu este valid sau a expirat.');
    } finally {
      setSaving(false);
    }
  }

  return authShell(
    <section className="w-full rounded-[1.5rem] border border-border/70 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
          <LockKeyhole className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Resetare parolă</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Alege o parolă nouă pentru contul tău Espace.</p>
        </div>
      </div>
      {validating ? <div className="mt-6 h-24 animate-pulse rounded-2xl bg-muted/50" /> : null}
      {!validating && !valid ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" /> Link invalid</div>
          <p className="mt-2">Linkul de resetare nu este valid sau a expirat.</p>
        </div>
      ) : null}
      {!validating && valid ? (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm outline-none transition focus:ring-2 focus:ring-foreground/10"
            placeholder="Parolă nouă"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm outline-none transition focus:ring-2 focus:ring-foreground/10"
            placeholder="Confirmă parola"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
          >
            {saving ? 'Se salvează...' : 'Schimbă parola'}
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {message ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      <Link href={`/${locale}/login`} className="mt-5 inline-flex items-center text-sm font-semibold text-foreground underline underline-offset-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la login
      </Link>
    </section>,
  );
}

export function AccountStatusPageContent({ locale = 'ro' }: { locale?: string }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const token = getToken();
    setUser(getUser());
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .accountStatus()
      .then((response) => active && setPayload(unwrap<any>(response)))
      .catch(() => active && setPayload(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const status = payload?.residentContext?.portalAccessStatus;
  const copy = statusCopy(status, payload?.warning?.code);

  return authShell(
    <section className="w-full rounded-[1.5rem] border border-border/70 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{loading ? 'Se verifică statusul contului' : copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{loading ? 'Verificăm accesul la portal.' : copy.text}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 rounded-2xl border border-border/70 p-4 text-sm">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="font-semibold text-foreground">{payload?.user?.email || user?.email || '—'}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Rol</span><span className="font-semibold text-foreground">{payload?.user?.role || user?.role || '—'}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status acces</span><span className="font-semibold text-foreground">{status || '—'}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Apartamente legate</span><span className="font-semibold text-foreground">{payload?.residentContext?.apartmentsCount ?? '—'}</span></div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/${locale}/login`} onClick={() => clearAuth()} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
          Înapoi la login
        </Link>
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/70 px-4 text-sm font-semibold text-foreground">
          Contactează administratorul
        </button>
      </div>
    </section>,
  );
}

export function SessionExpiredPageContent({ locale = 'ro' }: { locale?: string }) {
  return authShell(
    <section className="w-full rounded-[1.5rem] border border-border/70 bg-white p-6 text-center shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
        <KeyRound className="h-5 w-5" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Sesiunea a expirat</h1>
      <p className="mt-2 text-sm text-muted-foreground">Autentifică-te din nou pentru a continua.</p>
      <Link href={`/${locale}/login?expired=1`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
        <CheckCircle2 className="mr-2 h-4 w-4" /> Autentificare
      </Link>
    </section>,
  );
}
