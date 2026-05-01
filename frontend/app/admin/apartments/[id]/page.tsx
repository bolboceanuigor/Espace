'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { CondoMeter, fallbackCondoApartments, formatMdl } from '@/lib/condo-admin-fallback';
import { defaultLocale, isLocale } from '@/i18n';

const tabs = ['General', 'Locatari', 'Contoare', 'Plăți / Datorii', 'Cereri', 'Note'] as const;
type Tab = (typeof tabs)[number];

export default function AdminApartmentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const apartment = useMemo(
    () => fallbackCondoApartments.find((item) => item.id === params?.id) || fallbackCondoApartments[0],
    [params?.id],
  );
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [meters, setMeters] = useState<CondoMeter[]>(apartment.meters);
  const [notes, setNotes] = useState(apartment.notes);

  const addReading = () => {
    setMeters((current) =>
      current.map((meter, index) =>
        index === 0
          ? {
              ...meter,
              lastReading: meter.lastReading || '0',
              readingDate: new Date().toLocaleDateString('ro-MD'),
              status: 'actualizat',
            }
          : meter,
      ),
    );
  };

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/apartments`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la apartamente
      </Link>

      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {apartment.building} • {apartment.staircase}
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Apartament {apartment.number}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Fișă administrativă pentru proprietari, locatari, contoare, datorii, cereri și note interne.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Datorie curentă</p>
            <p className={`mt-1 text-xl font-semibold ${apartment.debt > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatMdl(apartment.debt)}</p>
          </div>
        </div>
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

      {activeTab === 'General' ? (
        <Panel>
          <InfoGrid
            rows={[
              ['Număr apartament', apartment.number],
              ['Scară', apartment.staircase],
              ['Etaj', apartment.floor ?? '-'],
              ['Suprafață', apartment.areaM2 ? `${apartment.areaM2} m²` : '-'],
              ['Camere', apartment.rooms ?? '-'],
              ['Status', apartment.status],
            ]}
          />
        </Panel>
      ) : null}

      {activeTab === 'Locatari' ? (
        <Panel>
          <div className="grid gap-3 md:grid-cols-2">
            {[apartment.owner, ...apartment.residents].filter(Boolean).map((person: any) => (
              <div key={`${person.id}-${person.role}`} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="font-semibold text-foreground">{person.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{person.role} • {person.accountStatus}</p>
                <p className="mt-3 text-sm text-muted-foreground">{person.phone}</p>
                <p className="text-sm text-muted-foreground">{person.email}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeTab === 'Contoare' ? (
        <Panel>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={addReading} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
              <Plus className="h-4 w-4" />
              Adaugă citire
            </button>
          </div>
          <div className="grid gap-3">
            {meters.length ? meters.map((meter) => (
              <div key={meter.serial} className="grid gap-2 rounded-2xl border border-border/70 bg-background/70 p-4 md:grid-cols-5">
                <span className="font-semibold text-foreground">{meter.type}</span>
                <span className="text-muted-foreground">{meter.serial}</span>
                <span className="text-muted-foreground">{meter.lastReading}</span>
                <span className="text-muted-foreground">{meter.readingDate}</span>
                <span className={meter.status === 'actualizat' ? 'text-emerald-700' : 'text-amber-700'}>{meter.status}</span>
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nu există contoare conectate încă.</p>
            )}
          </div>
        </Panel>
      ) : null}

      {activeTab === 'Plăți / Datorii' ? (
        <Panel>
          <InfoGrid
            rows={[
              ['Total datorie', formatMdl(apartment.debt)],
              ['Status plată', apartment.paymentStatus],
              ['Ultima plată / lună achitată', apartment.lastPayment],
              ['Facturi neachitate', apartment.debt > 0 ? '1 factură estimată' : '0'],
            ]}
          />
        </Panel>
      ) : null}

      {activeTab === 'Cereri' ? (
        <Panel>
          <div className="space-y-3">
            {apartment.activeRequests.length ? apartment.activeRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                <span className="font-medium text-foreground">{request.title}</span>
                <span className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">{request.status}</span>
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nu există cereri active pentru acest apartament.</p>
            )}
          </div>
        </Panel>
      ) : null}

      {activeTab === 'Note' ? (
        <Panel>
          <label className="block text-sm font-medium text-foreground">Note interne administrator</label>
          <textarea
            className="mt-2 min-h-40 w-full rounded-2xl border border-border/70 bg-background p-3 text-sm outline-none focus:border-foreground/30"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">Notele sunt locale în acest moment și nu sunt afișate locatarilor.</p>
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
