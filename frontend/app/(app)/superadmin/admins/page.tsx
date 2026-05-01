'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShieldCheck, UsersRound } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';

export default function SuperadminAdminsPage() {
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Superadmin
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Administratori</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Modulul pentru gestionarea administratorilor platformei va fi conectat la backend-ul de utilizatori.
            </p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Placeholder minim
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
            <UsersRound className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">Administratori organizații</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Aici vor apărea administratorii asociați organizațiilor/blocurilor din platformă.
          </p>
          <Link href={`/${locale}/superadmin/organizations`} className="mt-4 inline-flex rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/60">
            Vezi organizații
          </Link>
        </div>

        <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">Acces platformă</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Conectarea completă trebuie să folosească rolurile și permisiunile existente din backend, fără expunere de date între organizații.
          </p>
        </div>
      </section>
    </div>
  );
}
