'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { defaultLocale, isLocale } from '@/i18n';
import { authApi } from '@/lib/api';
import { roleHomePath } from '@/lib/role-routing';

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const { register, loading, isAuthenticated, user } = useAuth();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [debugError, setDebugError] = useState<{
    status?: number;
    code?: string;
    message?: string;
  } | null>(null);

  const destination = `/${locale}${roleHomePath(user?.role)}`;

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(destination);
    }
  }, [loading, isAuthenticated, destination, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setDebugError(null);
    setSubmitting(true);
    try {
      await register({
        orgName: orgName.trim(),
        email: email.trim(),
        password,
        locale,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setSuccess(tAuth('checkEmailTitle'));
    } catch (err: any) {
      const code = err?.code || err?.response?.data?.error?.code;
      if (process.env.NODE_ENV !== 'production') {
        setDebugError({
          status: err?.status || err?.response?.status,
          code: code || 'UNKNOWN',
          message: err?.message || 'Request failed',
        });
      }
      if (code === 'INVALID_CREDENTIALS') {
        setError(tErrors('INVALID_CREDENTIALS'));
      } else {
        setError(err?.message || tCommon('error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{tCommon('loading')}</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div>
          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-lg font-semibold text-white">E</div>
          </div>
          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-foreground">{tAuth('titleRegister')}</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">{tAuth('subtitleRegister')}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {process.env.NODE_ENV !== 'production' && debugError ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground">
              <p>status: {debugError.status ?? '-'}</p>
              <p>code: {debugError.code ?? '-'}</p>
              <p>message: {debugError.message ?? '-'}</p>
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <p className="font-medium">{success}</p>
              <p className="mt-1 text-xs">{tAuth('checkEmailBody')}</p>
            </div>
          ) : null}
          <input
            type="text"
            required
            placeholder={tAuth('orgName')}
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="email"
            required
            placeholder={tAuth('email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="password"
            minLength={10}
            required
            placeholder={tAuth('password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="text"
            placeholder={tAuth('firstName')}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="text"
            placeholder={tAuth('lastName')}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? tCommon('loading') : tAuth('submitRegister')}
          </button>
          {success ? (
            <button
              type="button"
              disabled={resending}
              className="w-full rounded-xl border border-border/60 px-4 py-2.5 text-sm text-foreground hover:bg-muted/60 disabled:opacity-50"
              onClick={async () => {
                setResending(true);
                try {
                  await authApi.resendVerification({ email: email.trim(), locale });
                  setSuccess(tAuth('checkEmailTitle'));
                } catch (err: any) {
                  const code = err?.code || err?.response?.data?.error?.code;
                  if (code === 'EMAIL_NOT_VERIFIED') setError(tErrors('EMAIL_NOT_VERIFIED'));
                  else if (code === 'INVALID_TOKEN') setError(tErrors('INVALID_TOKEN'));
                  else if (code === 'TOKEN_EXPIRED') setError(tErrors('TOKEN_EXPIRED'));
                  else setError(err?.message || tCommon('error'));
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending ? tCommon('loading') : tAuth('resend')}
            </button>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            {tAuth('alreadyHaveAccount')}{' '}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
              {tAuth('backToLogin')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
