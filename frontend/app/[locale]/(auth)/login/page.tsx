'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale, isLocale } from '@/i18n';
import { ApiClientError, authApi } from '@/lib/api';
import { featureFlags } from '@/lib/featureFlags';
import { useToast } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { roleHomePath } from '@/lib/role-routing';
import { getApiBaseUrl } from '@/lib/runtime-config';

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const { login, loading, isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState('');
  const [resending, setResending] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [initialEmail, setInitialEmail] = useState('');
  const googleAuthBase = getApiBaseUrl();
  const googleAuthUrl = `${googleAuthBase}/api/auth/google?locale=${locale}`;
  const destination = `/${locale}${roleHomePath(user?.role)}`;

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(destination);
    }
  }, [loading, isAuthenticated, destination, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    setVerifyStatus(search.get('verify'));
    setInitialEmail(search.get('email') || '');
    if (search.get('expired') === '1') {
      setError('Sesiunea a expirat. Te rugăm să te autentifici din nou.');
    }
  }, []);

  useEffect(() => {
    if (verifyStatus === 'sent') {
      setInfo(tAuth('checkEmailBody'));
      if (initialEmail) setEmail(initialEmail);
    } else if (verifyStatus === 'ok') {
      setInfo(tAuth('emailVerified'));
    }
  }, [verifyStatus, initialEmail, tAuth]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setEmailNotVerified(false);
    const nextFieldErrors = {
      email: email.trim() ? undefined : 'Emailul este obligatoriu.',
      password: password ? undefined : 'Parola este obligatorie.',
    };
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.email || nextFieldErrors.password) {
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const cachedUser = getUser();
      const nextDestination = `/${locale}${roleHomePath(cachedUser?.role)}`;
      router.replace(nextDestination);
    } catch (err: unknown) {
      const apiErr =
        err instanceof ApiClientError
          ? err
          : (err as { status?: number; code?: string; message?: string } | null);
      const code = apiErr?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError(tErrors('EMAIL_NOT_VERIFIED'));
        setEmailNotVerified(true);
      } else if (code === 'WRONG_PASSWORD' || code === 'INVALID_CREDENTIALS') {
        setError('Parola nu este corectă.');
        showToast('Parola nu este corectă.', 'error');
      } else if (code === 'ACCOUNT_NOT_FOUND') {
        setError('Nu există cont cu acest email.');
        showToast('Nu există cont cu acest email.', 'error');
      } else if (code === 'API_URL_MISSING') {
        const message = 'Autentificarea va funcționa după conectarea backend-ului. Momentan frontend-ul este publicat ca interfață de prezentare.';
        setError(message);
        showToast(message, 'error');
      } else if (code === 'NETWORK_ERROR') {
        const message = 'API-ul nu răspunde momentan. Verifică după ce backend-ul este publicat la domeniul API.';
        setError(message);
        showToast(message, 'error');
      } else {
        const message = 'A apărut o eroare. Încearcă din nou.';
        setError(message);
        showToast(message, 'error');
      }
      if (process.env.NODE_ENV !== 'production') console.error('[login:error]', apiErr);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-muted-foreground">
        Se verifică sesiunea...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div>
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-lg font-semibold text-white">E</div>
          </div>
          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-foreground">{tAuth('titleLogin')}</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">{tAuth('subtitleLogin')}</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {info ? <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div> : null}
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {submitting ? <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">Se verifică datele...</div> : null}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">{tAuth('email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              onBlur={() => setFieldErrors((current) => ({ ...current, email: email.trim() ? undefined : 'Emailul este obligatoriu.' }))}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className="mt-1 block w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
            />
            {fieldErrors.email ? <p id="email-error" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">{tAuth('password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              onBlur={() => setFieldErrors((current) => ({ ...current, password: password ? undefined : 'Parola este obligatorie.' }))}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className="mt-1 block w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
            />
            {fieldErrors.password ? <p id="password-error" className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Se autentifică...' : 'Autentificare'}
          </button>
          {featureFlags.googleAuth ? (
            <a
              href={googleAuthUrl}
              className="flex w-full justify-center rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/60"
            >
              Continue with Google
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed justify-center rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-medium text-muted-foreground"
              title="Google auth will be enabled later"
            >
              {tAuth('googleDisabled')}
            </button>
          )}
          {emailNotVerified ? (
            <button
              type="button"
              disabled={resending || !email}
              onClick={async () => {
                setResending(true);
                try {
                  await authApi.resendVerification({ email, locale });
                  setInfo(tAuth('checkEmailBody'));
                  setError('');
                } catch (err: any) {
                  const message = err?.message || tCommon('error');
                  setError(message);
                  showToast(message, 'error');
                } finally {
                  setResending(false);
                }
              }}
              className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-sm text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? tCommon('loading') : tAuth('resend')}
            </button>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            {tAuth('newHere')}{' '}
            <Link href={`/${locale}/register`} className="font-medium text-foreground underline underline-offset-2">
              {tAuth('titleRegister')}
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link href={`/${locale}/forgot-password`} className="font-medium text-foreground underline underline-offset-2">
              {tAuth('forgotPassword')}
            </Link>
          </p>
          {process.env.NODE_ENV !== 'production' ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground">
              <p className="font-medium">Dev accounts</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1">
                  <span className="truncate">SUPERADMIN: bolboceanuigor@gmail.com / SuperAdmin123!</span>
                  <button
                    type="button"
                    className="rounded-md border border-border/60 px-2 py-1"
                    onClick={async () => navigator.clipboard.writeText('bolboceanuigor@gmail.com / SuperAdmin123!')}
                  >
                    Copy
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1">
                  <span className="truncate">MANAGER: manager.test@example.com / Manager123!</span>
                  <button
                    type="button"
                    className="rounded-md border border-border/60 px-2 py-1"
                    onClick={async () => navigator.clipboard.writeText('manager.test@example.com / Manager123!')}
                  >
                    Copy
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1">
                  <span className="truncate">TENANT: tenant.test@example.com / Tenant123!</span>
                  <button
                    type="button"
                    className="rounded-md border border-border/60 px-2 py-1"
                    onClick={async () => navigator.clipboard.writeText('tenant.test@example.com / Tenant123!')}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
