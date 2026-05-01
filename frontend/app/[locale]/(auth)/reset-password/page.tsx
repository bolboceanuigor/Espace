'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { useToast } from '@/components/ui';

export default function ResetPasswordPage({ params }: { params: { locale: string } }) {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-5">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-5">
        <h1 className="text-lg font-semibold text-foreground">{tAuth('reset')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tAuth('resetBody')}</p>
        <div className="mt-3 space-y-2">
          <input
            type="password"
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={tAuth('newPassword')}
          />
          <input
            type="password"
            minLength={10}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={tAuth('confirmPassword')}
          />
          <button
            type="button"
            disabled={loading || !password || !confirmPassword || !token}
            className="w-full rounded-xl border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-muted/60 disabled:opacity-50"
            onClick={async () => {
              setConfirmError('');
              if (password !== confirmPassword) {
                setConfirmError(tErrors('validation'));
                return;
              }
              setLoading(true);
              try {
                await authApi.resetPassword({ token, newPassword: password });
                setMessage(tAuth('passwordUpdated'));
              } catch (err: any) {
                const code = err?.code || err?.response?.data?.error?.code;
                if (code === 'TOKEN_EXPIRED') {
                  setMessage(tErrors('TOKEN_EXPIRED'));
                } else if (code === 'INVALID_TOKEN') {
                  setMessage(tErrors('INVALID_TOKEN'));
                } else {
                  const generic = err?.message || tCommon('error');
                  setMessage(generic);
                  showToast(generic, 'error');
                }
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? tCommon('loading') : tAuth('submitReset')}
          </button>
          {confirmError ? <p className="text-xs text-red-600">{confirmError}</p> : null}
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
