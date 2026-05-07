'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Home, ShieldCheck, UserRound } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import { clearDemoRole, demoRolePath, getDemoRole, type DemoRole } from '@/lib/demo-auth';

type DemoContext = {
  eyebrow: string;
  title: string;
  description: string;
  button: string;
  icon: React.ReactNode;
  stats: Array<{ label: string; value: string }>;
};

const roleLabels: Record<DemoRole, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrator',
  RESIDENT: 'Locatar',
};

const contexts: Record<DemoRole, DemoContext> = {
  SUPERADMIN: {
    eyebrow: 'Platformă Espace',
    title: 'Ai ales demo-ul pentru Superadmin',
    description: 'Vezi cum arată controlul platformei: asociații, administratori, abonamente și suport.',
    button: 'Intră în Superadmin',
    icon: <ShieldCheck className="h-5 w-5" />,
    stats: [
      { label: 'Context', value: 'Platformă Espace' },
      { label: 'Asociații', value: '18 asociații' },
      { label: 'Locatari conectați', value: '2,480 locatari' },
    ],
  },
  ADMIN: {
    eyebrow: 'A.P.C. A0123-0940',
    title: 'Ai ales demo-ul pentru Administrator',
    description: 'Explorează administrarea zilnică pentru apartamente, locatari, contoare, plăți și cereri.',
    button: 'Intră în administrare',
    icon: <Building2 className="h-5 w-5" />,
    stats: [
      { label: 'Asociație', value: 'A.P.C. A0123-0940' },
      { label: 'Apartamente', value: '142 apartamente' },
      { label: 'Scări', value: '4 scări' },
      { label: 'Datorii totale', value: '86,450 MDL' },
    ],
  },
  RESIDENT: {
    eyebrow: 'Apartament conectat, Scara 2',
    title: 'Ai ales demo-ul pentru Locatar',
    description: 'Intră într-o experiență simplă pentru facturi, citiri, anunțuri, cereri și mesaje.',
    button: 'Intră ca locatar',
    icon: <UserRound className="h-5 w-5" />,
    stats: [
      { label: 'Apartament', value: 'Conectat prin cont' },
      { label: 'Scara', value: 'Scara 2' },
      { label: 'Sold curent', value: '1,240 MDL' },
      { label: 'Ultimul anunț', value: 'Lucrări programate la lift' },
    ],
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const [role, setRole] = useState<DemoRole | null>(null);
  const [storageChecked, setStorageChecked] = useState(false);

  useEffect(() => {
    setRole(getDemoRole());
    setStorageChecked(true);
  }, []);

  const context = useMemo(() => (role ? contexts[role] : null), [role]);
  const selectedRoleLabel = role ? roleLabels[role] : '';

  const changeRole = () => {
    clearDemoRole();
    router.replace(`/${locale}/login`);
  };

  const enterDemo = () => {
    if (!role) return;
    router.replace(demoRolePath(role, locale));
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-border/70 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
          <div className="border-b border-border/70 px-5 py-4 sm:px-8">
            <Link href={`/${locale}`} className="inline-flex items-center gap-3 text-sm font-semibold text-foreground">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">E</span>
              Espace
            </Link>
          </div>

          {storageChecked && context ? (
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-foreground p-6 text-background sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-background/85">
                  {context.icon}
                  {context.eyebrow}
                </div>
                <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Bun venit în demo-ul Espace
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-background/75">
                  Confirmă contextul de lucru și intră în platformă. Datele sunt mock, păstrate doar în frontend.
                </p>
                <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-background/50">Rol selectat</p>
                  <p className="mt-2 text-xl font-semibold">{selectedRoleLabel}</p>
                </div>
              </div>

              <div className="p-5 sm:p-8">
                <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-foreground shadow-sm">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Context demo</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{context.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{context.description}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {context.stats.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-border/70 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                        <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <button
                    type="button"
                    onClick={enterDemo}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    {context.button}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={changeRole}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    Schimbă rolul demo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <div className="mx-auto max-w-xl rounded-[1.5rem] border border-border/70 bg-muted/30 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-foreground shadow-sm">
                  <Home className="h-5 w-5" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">Alege un rol demo</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Nu am găsit un rol selectat. Poți intra din nou în pagina de login și alege Superadmin, Administrator sau Locatar.
                </p>
                <button
                  type="button"
                  onClick={changeRole}
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Mergi la login
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
