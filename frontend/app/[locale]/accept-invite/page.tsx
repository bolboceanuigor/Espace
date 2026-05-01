'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { invitationsApi } from '@/lib/api';
import { useToast } from '@/components/ui';

export default function AcceptInvitePage({ params }: { params: { locale: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tTeam = useTranslations('team');
  const { showToast } = useToast();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-5">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">{tTeam('acceptInviteTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tTeam('acceptInviteBody')}</p>
        {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 space-y-3">
          <input
            type="password"
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={tTeam('password')}
          />
          <input
            type="password"
            minLength={10}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={tTeam('confirmPassword')}
          />
          <button
            type="button"
            disabled={loading || !token || !password || !confirmPassword}
            className="w-full rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            onClick={async () => {
              setConfirmError('');
              if (password !== confirmPassword) {
                setConfirmError(tErrors('validation'));
                return;
              }
              setLoading(true);
              setError('');
              try {
                await invitationsApi.accept({ token, password });
                router.replace(`/${params.locale}/calendar`);
              } catch (err: any) {
                const code = err?.code || err?.response?.data?.error?.code;
                if (code === 'INVITE_EXPIRED') setError(tErrors('INVITE_EXPIRED'));
                else if (code === 'INVITE_ALREADY_USED') setError(tErrors('INVITE_ALREADY_USED'));
                else if (code === 'INVITE_INVALID') setError(tErrors('INVITE_INVALID'));
                else if (code === 'WEAK_PASSWORD') setError(tErrors('WEAK_PASSWORD'));
                else {
                  const generic = err?.message || tCommon('error');
                  setError(generic);
                  showToast(generic, 'error');
                }
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? tCommon('loading') : tTeam('acceptInviteSubmit')}
          </button>
          {confirmError ? <p className="text-xs text-red-600">{confirmError}</p> : null}
        </div>
        <Link href="/login" className="mt-4 inline-block text-sm text-foreground underline">
          {tTeam('backToLogin')}
        </Link>
      </div>
    </main>
  );
}
