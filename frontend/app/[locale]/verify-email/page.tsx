'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/auth-api';

export default function VerifyEmailPage({ params }: { params: { locale: string } }) {
  const router = useRouter();
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailFromQuery = searchParams.get('email') || '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState(tCommon('loading'));
  const [resendEmail, setResendEmail] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [debugError, setDebugError] = useState<{
    status?: number;
    code?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    let timeout: number | undefined;
    if (!token) {
      setStatus('error');
      setMessage(tErrors('INVALID_TOKEN'));
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('ok');
        setMessage(tAuth('emailVerified'));
        timeout = window.setTimeout(() => {
          router.replace('/login?verify=ok');
        }, 2000);
      })
      .catch((err: any) => {
        if (process.env.NODE_ENV !== 'production') {
          setDebugError({
            status: err?.status || err?.response?.status,
            code: err?.code || err?.response?.data?.error?.code || 'UNKNOWN',
            message: err?.message || 'Request failed',
          });
        }
        setStatus('error');
        const code = err?.code || err?.response?.data?.error?.code;
        if (code === 'TOKEN_EXPIRED') {
          setMessage(tErrors('TOKEN_EXPIRED'));
        } else {
          setMessage(tErrors('INVALID_TOKEN'));
        }
      });
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [params.locale, router, tAuth, tCommon, tErrors, token]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-5">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">{tAuth('verifyEmail')}</h1>
        <p className={`mt-2 text-sm ${status === 'ok' ? 'text-green-700' : status === 'error' ? 'text-red-700' : 'text-muted-foreground'}`}>
          {message}
        </p>
        {status === 'loading' ? <div className="mt-4 h-1 w-full animate-pulse rounded bg-muted" /> : null}
        {status === 'error' ? (
          <div className="mt-4 space-y-2">
            {process.env.NODE_ENV !== 'production' && debugError ? (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground">
                <p>status: {debugError.status ?? '-'}</p>
                <p>code: {debugError.code ?? '-'}</p>
                <p>message: {debugError.message ?? '-'}</p>
              </div>
            ) : null}
            <input
              type="email"
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
              placeholder={tAuth('email')}
            />
            <button
              type="button"
              disabled={resending || !resendEmail}
              className="w-full rounded-xl border border-border/60 px-3 py-2 text-sm text-foreground transition hover:bg-muted/60 disabled:opacity-50"
              onClick={async () => {
                setResending(true);
                try {
                  await authApi.resendVerification({ email: resendEmail, locale: params.locale });
                  setMessage(tAuth('checkEmailBody'));
                } catch (err: any) {
                  setMessage(err?.message || tCommon('error'));
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending ? tCommon('loading') : tAuth('resend')}
            </button>
          </div>
        ) : null}
        <Link
          href={`/login${status === 'ok' ? '?verify=ok' : ''}`}
          className="mt-4 inline-block text-sm text-foreground underline"
        >
          {tAuth('backToLogin')}
        </Link>
      </div>
    </main>
  );
}
