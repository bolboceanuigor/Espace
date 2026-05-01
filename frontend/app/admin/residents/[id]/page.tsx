'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { defaultLocale, isLocale } from '@/i18n';
import { fallbackCondoPeople, formatMdl } from '@/lib/condo-admin-fallback';

const tabs = ['Profil', 'Apartamente', 'Plăți / datorii', 'Mesaje', 'Cereri'] as const;
type Tab = (typeof tabs)[number];

export default function AdminResidentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const person = useMemo(() => fallbackCondoPeople.find((item) => item.id === params?.id) || fallbackCondoPeople[0], [params?.id]);
  const [activeTab, setActiveTab] = useState<Tab>('Profil');

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/residents`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la locatari
      </Link>

      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          {person.role} • {person.accountStatus}
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{person.fullName}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Profil locatar/proprietar conectat la apartamente, datorii, conversații și cereri.
        </p>
      </section>

      <div className="overflow-x-auto rounded-[1.35rem] border border-border/70 bg-white/90 p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-h-10 rounded-2xl px-4 text-sm font-semibold transition ${
                activeTab === tab ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Profil' ? (
        <Panel>
          <InfoGrid
            rows={[
              ['Nume complet', person.fullName],
              ['Telefon', person.phone],
              ['Email', person.email],
              ['Rol', person.role],
              ['Status cont', person.accountStatus],
            ]}
          />
        </Panel>
      ) : null}

      {activeTab === 'Apartamente' ? (
        <Panel>
          <div className="grid gap-3 md:grid-cols-2">
            {person.apartments.map((apartment) => (
              <div key={apartment} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="font-semibold text-foreground">Apartament {apartment}</p>
                <p className="mt-1 text-sm text-muted-foreground">Rol: {person.role}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeTab === 'Plăți / datorii' ? (
        <Panel>
          <InfoGrid
            rows={[
              ['Datorie totală apartamente asociate', formatMdl(person.debt)],
              ['Status', person.debt > 0 ? 'Există datorii' : 'Fără datorii'],
              ['Plăți recente', 'Se vor afișa după conectarea istoricului de plăți.'],
            ]}
          />
        </Panel>
      ) : null}

      {activeTab === 'Mesaje' ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Conversațiile cu acest locatar vor fi conectate la modulul Mesaje.</p>
          <Link href={`/${locale}/admin/chat`} className="mt-4 inline-flex min-h-10 items-center rounded-2xl border border-border/70 px-4 text-sm font-semibold hover:bg-muted/60">
            Deschide mesaje
          </Link>
        </Panel>
      ) : null}

      {activeTab === 'Cereri' ? (
        <Panel>
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Nu există cereri active conectate acestui profil în datele fallback.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[1.35rem] border border-border/70 bg-white/90 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">{children}</section>;
}

function InfoGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-semibold text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}
