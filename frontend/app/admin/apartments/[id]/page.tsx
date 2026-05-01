'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Droplets,
  FileText,
  Gauge,
  MessageCircle,
  Plus,
  StickyNote,
  Users,
} from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard, Tabs } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { defaultLocale, isLocale } from '@/i18n';

type ApartmentStatus = 'Activ' | 'Datornic' | 'Nelocuit' | 'Problemă';
type MeterStatus = 'actualizat' | 'lipsă citire' | 'suspect';
type PaymentStatus = 'Achitat' | 'Neachitat' | 'Întârziat';
type RequestStatus = 'nouă' | 'în lucru' | 'rezolvată';

type Resident = {
  id: string;
  name: string;
  role: 'proprietar' | 'locatar' | 'chiriaș' | 'membru familie' | 'reprezentant';
  phone: string;
  email: string;
  accountStatus: 'cont creat' | 'invitat' | 'fără cont';
};

type Meter = {
  id: string;
  type: string;
  serial: string;
  lastReading: string;
  readingDate: string;
  status: MeterStatus;
};

type Invoice = {
  id: string;
  month: string;
  description: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
};

type Apartment = {
  id: string;
  number: string;
  staircase: string;
  floor: number;
  areaM2: number;
  rooms: number;
  status: ApartmentStatus;
  owner: Resident;
  residents: Resident[];
  debt: number;
  lastPayment: string;
  meters: Meter[];
  invoices: Invoice[];
  requests: Array<{ id: string; title: string; status: RequestStatus; date: string }>;
  notes: string;
};

const apartments: Apartment[] = [
  {
    id: 'apt-45',
    number: '45',
    staircase: 'Scara 2',
    floor: 6,
    areaM2: 72.4,
    rooms: 3,
    status: 'Datornic',
    debt: 1240,
    lastPayment: 'Martie 2026',
    owner: {
      id: 'res-popescu-ion',
      name: 'Popescu Ion',
      role: 'proprietar',
      phone: '+373 69 111 222',
      email: 'ion.popescu@example.com',
      accountStatus: 'cont creat',
    },
    residents: [
      {
        id: 'res-popescu-ana',
        name: 'Popescu Ana',
        role: 'membru familie',
        phone: '+373 69 111 223',
        email: 'ana.popescu@example.com',
        accountStatus: 'cont creat',
      },
      {
        id: 'res-popescu-mihai',
        name: 'Popescu Mihai',
        role: 'locatar',
        phone: '+373 69 111 224',
        email: 'mihai.popescu@example.com',
        accountStatus: 'fără cont',
      },
    ],
    meters: [
      { id: 'm1', type: 'Apă rece', serial: 'AR-2045-11', lastReading: '128.4 m³', readingDate: '25 Apr 2026', status: 'actualizat' },
      { id: 'm2', type: 'Apă caldă', serial: 'AC-2045-09', lastReading: '76.1 m³', readingDate: '25 Apr 2026', status: 'actualizat' },
      { id: 'm3', type: 'Gaz', serial: 'GZ-8712-45', lastReading: '392.0 m³', readingDate: '12 Mar 2026', status: 'lipsă citire' },
    ],
    invoices: [
      { id: 'inv-2026-04', month: 'Aprilie 2026', description: 'Întreținere bloc și servicii comunale', amount: 1240, dueDate: '10 Mai 2026', status: 'Neachitat' },
      { id: 'inv-2026-03', month: 'Martie 2026', description: 'Întreținere bloc și fond reparații', amount: 1160, dueDate: '10 Apr 2026', status: 'Achitat' },
      { id: 'inv-2026-02', month: 'Februarie 2026', description: 'Servicii comunale', amount: 980, dueDate: '10 Mar 2026', status: 'Achitat' },
    ],
    requests: [
      { id: 'req-1', title: 'Infiltrație la balcon după ploaie', status: 'în lucru', date: '28 Apr 2026' },
      { id: 'req-2', title: 'Verificare presiune apă caldă', status: 'nouă', date: '30 Apr 2026' },
    ],
    notes: 'Contact preferat prin telefon după ora 18:00. De verificat citirea la contorul de gaz la următoarea vizită.',
  },
];

const tabs = [
  { key: 'general', label: 'General' },
  { key: 'residents', label: 'Locatari' },
  { key: 'meters', label: 'Contoare' },
  { key: 'payments', label: 'Plăți / Datorii' },
  { key: 'requests', label: 'Cereri' },
  { key: 'notes', label: 'Note interne' },
];

const statusVariant: Record<ApartmentStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  Activ: 'success',
  Datornic: 'error',
  Nelocuit: 'neutral',
  Problemă: 'warning',
};

const paymentVariant: Record<PaymentStatus, 'success' | 'warning' | 'error'> = {
  Achitat: 'success',
  Neachitat: 'warning',
  Întârziat: 'error',
};

const meterVariant: Record<MeterStatus, 'success' | 'warning' | 'error'> = {
  actualizat: 'success',
  'lipsă citire': 'warning',
  suspect: 'error',
};

export default function AdminApartmentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const apartment = useMemo(() => apartments.find((item) => item.id === params?.id) || apartments[0], [params?.id]);
  const [activeTab, setActiveTab] = useState('general');
  const [meters, setMeters] = useState(apartment.meters);
  const [notes, setNotes] = useState(apartment.notes);

  const missingReadings = meters.filter((meter) => meter.status === 'lipsă citire').length;
  const residents = [apartment.owner, ...apartment.residents];

  const addReading = () => {
    setMeters((current) =>
      current.map((meter) =>
        meter.status === 'lipsă citire'
          ? {
              ...meter,
              lastReading: meter.lastReading === '-' ? '0 m³' : meter.lastReading,
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

      <PageHeader
        title={`Apt. ${apartment.number}`}
        description={`${apartment.staircase} · Etaj ${apartment.floor} · ${apartment.areaM2} m² · ${apartment.rooms} camere`}
        rightSlot={<Badge variant={statusVariant[apartment.status]}>{apartment.status}</Badge>}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Datorie curentă" value={formatMdl(apartment.debt)} description={`Ultima plată: ${apartment.lastPayment}`} icon={<Banknote className="h-5 w-5" />} tone="danger" />
        <StatCard label="Locatari conectați" value={`${residents.length}`} description="Proprietar și persoane asociate" icon={<Users className="h-5 w-5" />} tone="success" />
        <StatCard label="Contoare" value={`${meters.length}`} description={`${missingReadings} citiri lipsă`} icon={<Gauge className="h-5 w-5" />} tone={missingReadings ? 'warning' : 'success'} />
        <StatCard label="Cereri active" value={`${apartment.requests.length}`} description="Pentru acest apartament" icon={<FileText className="h-5 w-5" />} tone="warning" />
      </section>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button onClick={addReading} variant="primary"><Plus className="h-4 w-4" /> Adaugă citire</Button>
          <ButtonLink href="/admin/payments" variant="secondary"><Banknote className="h-4 w-4" /> Adaugă plată</ButtonLink>
          <ButtonLink href="/admin/chat" variant="secondary"><MessageCircle className="h-4 w-4" /> Trimite mesaj</ButtonLink>
          <ButtonLink href="/admin/issues" variant="secondary"><FileText className="h-4 w-4" /> Creează cerere</ButtonLink>
        </div>
      </Card>

      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} ariaLabel="Secțiuni apartament" />

      {activeTab === 'general' ? (
        <Card>
          <SectionTitle icon={<HomeIcon />} title="Date generale" description="Informațiile principale ale unității locative." />
          <InfoGrid
            rows={[
              ['Număr apartament', `Apt. ${apartment.number}`],
              ['Scară', apartment.staircase],
              ['Etaj', apartment.floor],
              ['Suprafață', `${apartment.areaM2} m²`],
              ['Camere', apartment.rooms],
              ['Status', <Badge key="status" variant={statusVariant[apartment.status]}>{apartment.status}</Badge>],
            ]}
          />
        </Card>
      ) : null}

      {activeTab === 'residents' ? (
        <Card>
          <SectionTitle icon={<Users className="h-5 w-5" />} title="Locatari" description="Persoanele conectate la apartament." />
          <div className="grid gap-3 md:grid-cols-2">
            {residents.map((person) => (
              <div key={person.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{person.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{person.role}</p>
                  </div>
                  <Badge variant={person.accountStatus === 'cont creat' ? 'success' : person.accountStatus === 'invitat' ? 'warning' : 'neutral'}>
                    {person.accountStatus}
                  </Badge>
                </div>
                <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                  <p>{person.phone}</p>
                  <p>{person.email}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'meters' ? (
        <Card>
          <SectionTitle icon={<Droplets className="h-5 w-5" />} title="Contoare" description="Citiri și starea contoarelor pentru apartament." />
          <div className="space-y-3">
            {meters.map((meter) => (
              <div key={meter.id} className="grid gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-center">
                <Info label="Tip" value={meter.type} />
                <Info label="Serie" value={meter.serial} />
                <Info label="Ultima citire" value={meter.lastReading} />
                <Info label="Data citirii" value={meter.readingDate} />
                <Badge variant={meterVariant[meter.status]}>{meter.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'payments' ? (
        <Card>
          <SectionTitle icon={<Banknote className="h-5 w-5" />} title="Plăți / Datorii" description="Facturi, datorii și istoric de plată." />
          <div className="grid gap-3 md:grid-cols-3">
            <InfoTile label="Total datorie" value={formatMdl(apartment.debt)} danger={apartment.debt > 0} />
            <InfoTile label="Ultima lună achitată" value={apartment.lastPayment} />
            <InfoTile label="Facturi neachitate" value={`${apartment.invoices.filter((invoice) => invoice.status !== 'Achitat').length}`} danger />
          </div>
          <div className="mt-4 space-y-3">
            {apartment.invoices.map((invoice) => (
              <div key={invoice.id} className="grid gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 md:grid-cols-[1fr_1.4fr_0.8fr_0.8fr_auto] md:items-center">
                <Info label="Lună" value={invoice.month} />
                <Info label="Descriere" value={invoice.description} />
                <Info label="Sumă" value={formatMdl(invoice.amount)} />
                <Info label="Scadență" value={invoice.dueDate} />
                <Badge variant={paymentVariant[invoice.status]}>{invoice.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'requests' ? (
        <Card>
          <SectionTitle icon={<FileText className="h-5 w-5" />} title="Cereri" description="Solicitările asociate acestui apartament." />
          <div className="space-y-3">
            {apartment.requests.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{request.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{request.date}</p>
                </div>
                <Badge variant={request.status === 'rezolvată' ? 'success' : request.status === 'în lucru' ? 'warning' : 'default'}>
                  {request.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {activeTab === 'notes' ? (
        <Card>
          <SectionTitle icon={<StickyNote className="h-5 w-5" />} title="Note interne" description="Vizibile doar pentru administrator." />
          <textarea
            className="min-h-40 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm text-foreground outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">Date locale temporare. Salvarea în backend va fi conectată ulterior.</p>
        </Card>
      ) : null}
    </div>
  );
}

function HomeIcon() {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">45</span>;
}

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <InfoTile key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function InfoTile({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={`mt-1 text-sm font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
