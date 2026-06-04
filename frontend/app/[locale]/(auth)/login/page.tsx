'use client';

import { FormEvent, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import { saveRealSession } from '@/lib/auth';
import { clearDemoRole, demoRolePath, setDemoRole, type DemoRole } from '@/lib/demo-auth';
import { getApiBaseUrl } from '@/lib/runtime-config';

const ENABLE_DEMO_LOGIN = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true';

const demoRoles: Array<{
  role: DemoRole;
  icon: ReactNode;
}> = [
  {
    role: 'SUPERADMIN',
    icon: <ShieldCheck className="size-5" />,
  },
  {
    role: 'ADMIN',
    icon: <Building2 className="size-5" />,
  },
  {
    role: 'RESIDENT',
    icon: <UserRound className="size-5" />,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const tAuth = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const apiBaseUrl = getApiBaseUrl();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const rolePath = (role?: string) => {
    const normalized = String(role || '').toUpperCase();
    if (normalized === 'SUPERADMIN' || normalized === 'SUPER_ADMIN') return `/${locale}/superadmin`;
    if (normalized === 'RESIDENT') return `/${locale}/resident`;
    return `/${locale}/admin`;
  };

  const enterAs = (role: DemoRole) => {
    setDemoRole(role);
    router.replace(demoRolePath(role, locale));
  };

  const submitRealLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError(tAuth('credentialsRequired'));
      return;
    }
    if (!apiBaseUrl) {
      setError(tAuth('apiUnavailable'));
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error?.message || payload?.message;
        if (message === 'Nu există cont cu acest email.') throw new Error(tAuth('emailNotFound'));
        if (message === 'Parola nu este corectă.') throw new Error(tAuth('invalidPassword'));
        if (response.status === 400) throw new Error(tAuth('credentialsRequired'));
        if (response.status === 404 || response.status === 401) throw new Error(message ? tErrors('INVALID_CREDENTIALS') : tAuth('invalidPassword'));
        throw new Error(tAuth('unexpectedLoginError'));
      }

      const accessToken = payload?.accessToken || payload?.data?.accessToken;
      const user = payload?.user || payload?.data?.user;
      if (!accessToken || !user) {
        throw new Error(tAuth('unexpectedLoginError'));
      }
      clearDemoRole();
      saveRealSession(accessToken, user);
      const destination = rolePath(user.role);
      router.replace(destination);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : '';
      if (
        message === tAuth('emailNotFound') ||
        message === tAuth('invalidPassword') ||
        message === tAuth('credentialsRequired') ||
        message === tErrors('INVALID_CREDENTIALS')
      ) {
        setError(message);
      } else if (!apiBaseUrl || message.includes('fetch')) {
        setError(tAuth('apiUnavailable'));
      } else {
        setError(tAuth('unexpectedLoginError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F8F6] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_28px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            {/* Left Panel - Branding */}
            <div className="bg-[#0F172A] p-6 text-white md:p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-xl font-bold text-[#145C55]">E</div>
              <h1 className="mt-8 text-3xl font-semibold tracking-tight md:text-4xl">Espace SaaS</h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-background/75">
                {tAuth('loginBrandBody')}
              </p>
              <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-6 text-white/75">
                {tAuth('loginBrandDetails')}
              </div>
            </div>

            {/* Right Panel - Form */}
            <div className="p-5 md:p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-[#145C55]">{tAuth('loginEyebrow')}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{tAuth('loginHeading')}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {tAuth('loginBody')}
                </p>
              </div>

              <form onSubmit={submitRealLogin} className="space-y-4">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">{tAuth('email')}</span>
                  <span className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15"
                      placeholder={tAuth('emailPlaceholder')}
                    />
                  </span>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">{tAuth('password')}</span>
                  <span className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-[#145C55]/40 focus:ring-2 focus:ring-[#145C55]/15"
                      placeholder={tAuth('passwordPlaceholder')}
                    />
                  </span>
                </label>

                {error ? (
                  <p className="rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-sm font-medium text-critical">{error}</p>
                ) : null}
                {!apiBaseUrl ? (
                  <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
                    {tAuth('apiUnavailable')}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#145C55] px-4 text-sm font-semibold text-white shadow-button transition hover:bg-[#104A45] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? tAuth('authenticating') : tAuth('submitLogin')}
                </button>
              </form>

              {ENABLE_DEMO_LOGIN ? (
                <>
                  <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tAuth('demo.title')}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <details className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground">
                      {tAuth('demo.title')}
                      <span className="ml-2 font-normal text-muted-foreground">{tAuth('demo.summary')}</span>
                    </summary>
                    <div className="mt-4 grid gap-2">
                      {demoRoles.map((item) => (
                        <button
                          key={item.role}
                          type="button"
                          onClick={() => enterAs(item.role)}
                          className="group flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-accent/40 hover:bg-accent/5"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground">{tAuth(`demo.roles.${item.role}.button`)}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{tAuth(`demo.roles.${item.role}.description`)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                </>
              ) : null}

              <div className="mt-6 flex flex-col gap-2 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <Link href={`/${locale}`} className="font-semibold text-accent underline underline-offset-4 hover:text-accent/80">
                  {tAuth('backToPresentation')}
                </Link>
                <Link href={`/${locale}/cere-acces`} className="font-semibold text-[#145C55] underline underline-offset-4 hover:text-[#104A45]">
                  {tAuth('requestAccess')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
