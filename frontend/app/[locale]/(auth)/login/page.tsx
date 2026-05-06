'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Building2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import { saveRealSession } from '@/lib/auth';
import { clearDemoRole, demoOnboardingPath, setDemoRole, type DemoRole } from '@/lib/demo-auth';
import { getApiBaseUrl } from '@/lib/runtime-config';

const demoRoles: Array<{
  role: DemoRole;
  title: string;
  description: string;
  button: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'SUPERADMIN',
    title: 'Superadmin',
    description: 'Gestionează asociații, administratori și configurarea platformei.',
    button: 'Acces demo temporar: Superadmin',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    role: 'ADMIN',
    title: 'Administrator APC',
    description: 'Administrează apartamente, locatari, contoare, plăți și cereri.',
    button: 'Acces demo temporar: Administrator',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    role: 'RESIDENT',
    title: 'Locatar',
    description: 'Vezi facturi, transmite citiri, urmărește cereri și mesaje.',
    button: 'Acces demo temporar: Locatar',
    icon: <UserRound className="h-5 w-5" />,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
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
    router.replace(demoOnboardingPath(locale));
  };

  const submitRealLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError('Emailul și parola sunt obligatorii.');
      return;
    }
    if (!apiBaseUrl) {
      setError('API-ul nu este disponibil temporar. Poți folosi accesul demo temporar.');
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
        if (message === 'Nu există cont cu acest email.') throw new Error(message);
        if (message === 'Parola nu este corectă.') throw new Error(message);
        if (response.status === 400) throw new Error('Emailul și parola sunt obligatorii.');
        if (response.status === 404 || response.status === 401) throw new Error(message || 'Parola nu este corectă.');
        throw new Error('A apărut o eroare. Încearcă din nou.');
      }

      const accessToken = payload?.accessToken || payload?.data?.accessToken;
      const user = payload?.user || payload?.data?.user;
      if (!accessToken || !user) {
        throw new Error('A apărut o eroare. Încearcă din nou.');
      }
      clearDemoRole();
      saveRealSession(accessToken, user);
      router.replace(rolePath(user.role));
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : '';
      if (message === 'Nu există cont cu acest email.' || message === 'Parola nu este corectă.' || message === 'Emailul și parola sunt obligatorii.') {
        setError(message);
      } else if (!apiBaseUrl || message.includes('fetch')) {
        setError('API-ul nu este disponibil temporar. Poți folosi accesul demo temporar.');
      } else {
        setError('A apărut o eroare. Încearcă din nou.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-border/70 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-foreground p-6 text-background md:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-semibold text-foreground">E</div>
              <h1 className="mt-8 text-3xl font-semibold tracking-tight md:text-4xl">Espace</h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-background/75">
                Intră în platforma pentru condominii, APC și HOA din Moldova și România.
              </p>
              <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-background/80">
                Autentificarea reală folosește backend-ul Espace. Accesul demo temporar rămâne disponibil doar ca fallback.
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-muted-foreground">Intră în platformă</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Autentificare</h2>
              </div>

              <form onSubmit={submitRealLogin} className="space-y-3">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">Email</span>
                  <span className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className="h-12 w-full rounded-2xl border border-border/70 bg-white pl-10 pr-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-foreground/10"
                      placeholder="email@espace.md"
                    />
                  </span>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-foreground">Parolă</span>
                  <span className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      className="h-12 w-full rounded-2xl border border-border/70 bg-white pl-10 pr-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-foreground/10"
                      placeholder="Parola contului"
                    />
                  </span>
                </label>

                {error ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
                ) : null}
                {!apiBaseUrl ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    API-ul nu este disponibil temporar. Poți folosi accesul demo temporar.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Se autentifică...' : 'Autentificare'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border/70" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acces demo temporar</span>
                <span className="h-px flex-1 bg-border/70" />
              </div>

              <div className="grid gap-3">
                {demoRoles.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => enterAs(item.role)}
                    className="group flex min-h-20 items-center gap-4 rounded-[1.35rem] border border-dashed border-border/80 bg-muted/25 p-4 text-left transition hover:border-foreground/20 hover:bg-white"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground group-hover:bg-foreground group-hover:text-background">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{item.button}</span>
                      <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-2 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <Link href={`/${locale}`} className="font-semibold text-foreground underline underline-offset-4">
                  Înapoi la prezentare
                </Link>
                <span>Login real ca flux principal. Demo doar ca fallback.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
