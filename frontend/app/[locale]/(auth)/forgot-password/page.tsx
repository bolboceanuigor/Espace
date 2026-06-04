'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/auth-api';
import { useToast } from '@/components/ui/ToastProvider';

export default function ForgotPasswordPage({ params }: { params: { locale: string } }) {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-5">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-5">
        <h1 className="text-lg font-semibold text-foreground">{tAuth('forgot')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tAuth('forgotBody')}</p>
        <div className="mt-3 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={tAuth('email')}
          />
          <button
            type="button"
            disabled={loading || !email}
            className="w-full rounded-xl border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-muted/60 disabled:opacity-50"
            onClick={async () => {
              setLoading(true);
              try {
                await authApi.forgotPassword({ email, locale: params.locale });
                setMessage(tAuth('ifAccountExists'));
              } catch (err: any) {
                const generic = err?.message || tCommon('error');
                setMessage(generic);
                showToast(generic, 'error');
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? tCommon('loading') : tAuth('sendResetLink')}
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-foreground underline"
        >
          {tAuth('backToLogin')}
        </Link>
      </div>
    </main>
  );
}
