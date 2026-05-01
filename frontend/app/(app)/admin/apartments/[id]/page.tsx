'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Home,
  Users,
  Gauge,
  CreditCard,
  MessageSquare,
  FileText,
  Plus,
  Phone,
  Mail,
  Edit,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  MoreHorizontal,
} from 'lucide-react';

// Mock apartment data
const apartmentData = {
  id: '1',
  number: '45',
  staircase: 2,
  floor: 6,
  area: 72.4,
  rooms: 3,
  status: 'DEBTOR',
  debt: 1240,
  owner: {
    name: 'Popescu Ion',
    phone: '+373 69 123 456',
    email: 'ion.popescu@email.md',
    role: 'PROPRIETAR',
    accountStatus: 'CREATED',
  },
  residents: [
    { id: '1', name: 'Popescu Ion', phone: '+373 69 123 456', email: 'ion.popescu@email.md', role: 'Proprietar', accountStatus: 'CREATED' },
    { id: '2', name: 'Popescu Maria', phone: '+373 69 123 457', email: 'maria.popescu@email.md', role: 'Membru familie', accountStatus: 'CREATED' },
    { id: '3', name: 'Popescu Andrei', phone: '+373 69 123 458', email: null, role: 'Locatar', accountStatus: 'NO_ACCOUNT' },
  ],
  meters: [
    { id: '1', type: 'Apa rece', serial: 'AR-024531', lastReading: 124, unit: 'm3', status: 'UPDATED', lastUpdated: '28 Apr 2026' },
    { id: '2', type: 'Apa calda', serial: 'AC-018992', lastReading: 89, unit: 'm3', status: 'UPDATED', lastUpdated: '28 Apr 2026' },
    { id: '3', type: 'Gaz', serial: 'GZ-771209', lastReading: null, unit: 'm3', status: 'MISSING', lastUpdated: null },
  ],
  invoices: [
    { id: '1', month: 'Aprilie 2026', amount: 450, status: 'UNPAID', dueDate: '15 Mai 2026' },
    { id: '2', month: 'Martie 2026', amount: 420, status: 'UNPAID', dueDate: '15 Apr 2026' },
    { id: '3', month: 'Februarie 2026', amount: 370, status: 'OVERDUE', dueDate: '15 Mar 2026' },
    { id: '4', month: 'Ianuarie 2026', amount: 380, status: 'PAID', dueDate: '15 Feb 2026', paidDate: '12 Feb 2026' },
  ],
  requests: [
    { id: '1', title: 'Lift defect', category: 'LIFT', status: 'IN_PROGRESS', date: '28 Apr 2026', priority: 'URGENT' },
    { id: '2', title: 'Scurgere apa', category: 'APA', status: 'RESOLVED', date: '15 Mar 2026', priority: 'NORMAL' },
  ],
  notes: [
    { id: '1', text: 'Proprietarul a solicitat esalonare pentru datorie.', date: '25 Apr 2026', author: 'Admin' },
    { id: '2', text: 'Verificat contoare - totul in regula.', date: '20 Apr 2026', author: 'Admin' },
  ],
};

type Tab = 'general' | 'residents' | 'meters' | 'payments' | 'requests' | 'notes';

export default function ApartmentDetailPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showAddReadingModal, setShowAddReadingModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  const apartment = apartmentData;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'General', icon: Home },
    { id: 'residents', label: 'Locatari', icon: Users },
    { id: 'meters', label: 'Contoare', icon: Gauge },
    { id: 'payments', label: 'Plati / Datorii', icon: CreditCard },
    { id: 'requests', label: 'Cereri', icon: MessageSquare },
    { id: 'notes', label: 'Note interne', icon: FileText },
  ];

  const statusStyles: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    DEBTOR: 'bg-destructive/10 text-destructive border-destructive/20',
    UNOCCUPIED: 'bg-muted text-muted-foreground border-border',
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Activ',
    DEBTOR: 'Datornic',
    UNOCCUPIED: 'Nelocuit',
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        href="/admin/apartments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Inapoi la apartamente
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-primary/10 p-4 text-primary">
              <Home className="h-8 w-8" />
            </span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground">Apt. {apartment.number}</h1>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${statusStyles[apartment.status]}`}>
                  {statusLabels[apartment.status]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Scara {apartment.staircase}</span>
                <span>Etaj {apartment.floor}</span>
                <span>{apartment.area} m2</span>
                <span>{apartment.rooms} camere</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{apartment.owner.name}</span>
                <span className="text-sm text-muted-foreground">- Proprietar</span>
              </div>
            </div>
          </div>

          {/* Debt Summary & Quick Actions */}
          <div className="flex flex-col items-end gap-4">
            {apartment.debt > 0 && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-right">
                <p className="text-xs font-medium uppercase text-destructive">Datorie totala</p>
                <p className="text-2xl font-bold text-destructive">
                  {apartment.debt.toLocaleString('ro-RO')} MDL
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAddReadingModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <Gauge className="h-4 w-4" />
                Adauga citire
              </button>
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <CreditCard className="h-4 w-4" />
                Adauga plata
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                <Send className="h-4 w-4" />
                Trimite mesaj
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
                <Edit className="h-4 w-4" />
                Editeaza
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
        {activeTab === 'general' && <GeneralTab apartment={apartment} />}
        {activeTab === 'residents' && <ResidentsTab residents={apartment.residents} />}
        {activeTab === 'meters' && <MetersTab meters={apartment.meters} onAddReading={() => setShowAddReadingModal(true)} />}
        {activeTab === 'payments' && <PaymentsTab invoices={apartment.invoices} debt={apartment.debt} />}
        {activeTab === 'requests' && <RequestsTab requests={apartment.requests} />}
        {activeTab === 'notes' && <NotesTab notes={apartment.notes} />}
      </div>

      {/* Modals */}
      {showAddReadingModal && <AddReadingModal onClose={() => setShowAddReadingModal(false)} />}
      {showAddPaymentModal && <AddPaymentModal onClose={() => setShowAddPaymentModal(false)} />}
    </div>
  );
}

function GeneralTab({ apartment }: { apartment: typeof apartmentData }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Informatii generale</h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Numar apartament" value={apartment.number} />
        <InfoCard label="Scara" value={String(apartment.staircase)} />
        <InfoCard label="Etaj" value={String(apartment.floor)} />
        <InfoCard label="Suprafata" value={`${apartment.area} m2`} />
        <InfoCard label="Camere" value={String(apartment.rooms)} />
        <InfoCard label="Status" value={apartment.status === 'DEBTOR' ? 'Datornic' : apartment.status === 'ACTIVE' ? 'Activ' : 'Nelocuit'} />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ResidentsTab({ residents }: { residents: typeof apartmentData.residents }) {
  const accountStatusStyles: Record<string, string> = {
    CREATED: 'bg-success/10 text-success',
    INVITED: 'bg-primary/10 text-primary',
    NO_ACCOUNT: 'bg-muted text-muted-foreground',
  };

  const accountStatusLabels: Record<string, string> = {
    CREATED: 'Cont creat',
    INVITED: 'Invitat',
    NO_ACCOUNT: 'Fara cont',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Locatari ({residents.length})</h3>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Adauga locatar
        </button>
      </div>
      <div className="space-y-3">
        {residents.map((resident) => (
          <div key={resident.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{resident.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {resident.role}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {resident.phone}
                  </span>
                  {resident.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {resident.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-2 py-1 text-xs font-medium ${accountStatusStyles[resident.accountStatus]}`}>
                  {accountStatusLabels[resident.accountStatus]}
                </span>
                <button className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetersTab({ meters, onAddReading }: { meters: typeof apartmentData.meters; onAddReading: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Contoare ({meters.length})</h3>
        <button
          onClick={onAddReading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adauga citire
        </button>
      </div>
      <div className="space-y-3">
        {meters.map((meter) => (
          <div key={meter.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{meter.type}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {meter.serial}
                  </span>
                </div>
                {meter.lastReading !== null ? (
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {meter.lastReading} {meter.unit}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-warning">Lipsa citire</p>
                )}
                {meter.lastUpdated && (
                  <p className="mt-1 text-xs text-muted-foreground">Ultima actualizare: {meter.lastUpdated}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {meter.status === 'UPDATED' ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-xs font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Actualizat
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
                    <AlertCircle className="h-3 w-3" />
                    Lipsa citire
                  </span>
                )}
                <button className="rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
                  Adauga citire
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsTab({ invoices, debt }: { invoices: typeof apartmentData.invoices; debt: number }) {
  const statusStyles: Record<string, string> = {
    PAID: 'bg-success/10 text-success',
    UNPAID: 'bg-warning/10 text-warning',
    OVERDUE: 'bg-destructive/10 text-destructive',
  };

  const statusLabels: Record<string, string> = {
    PAID: 'Achitat',
    UNPAID: 'Neachitat',
    OVERDUE: 'Intarziat',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Plati si datorii</h3>
          {debt > 0 && (
            <p className="mt-1 text-sm text-destructive">
              Total datorie: <span className="font-semibold">{debt.toLocaleString('ro-RO')} MDL</span>
            </p>
          )}
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Inregistreaza plata
        </button>
      </div>

      <div className="space-y-3">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{invoice.month}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{invoice.amount} MDL</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scadent: {invoice.dueDate}
                  {invoice.paidDate && ` | Achitat: ${invoice.paidDate}`}
                </p>
              </div>
              <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${statusStyles[invoice.status]}`}>
                {statusLabels[invoice.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsTab({ requests }: { requests: typeof apartmentData.requests }) {
  const statusStyles: Record<string, string> = {
    NEW: 'bg-primary/10 text-primary',
    IN_PROGRESS: 'bg-warning/10 text-warning',
    RESOLVED: 'bg-success/10 text-success',
  };

  const statusLabels: Record<string, string> = {
    NEW: 'Noua',
    IN_PROGRESS: 'In lucru',
    RESOLVED: 'Rezolvata',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Cereri ({requests.length})</h3>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Creeaza cerere
        </button>
      </div>
      <div className="space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {request.priority === 'URGENT' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Urgent
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground">{request.title}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{request.date}</p>
              </div>
              <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${statusStyles[request.status]}`}>
                {statusLabels[request.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesTab({ notes }: { notes: typeof apartmentData.notes }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Note interne</h3>
          <p className="mt-1 text-xs text-muted-foreground">Aceste note nu sunt vizibile pentru locatari.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Adauga nota
        </button>
      </div>
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-foreground">{note.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {note.author} - {note.date}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddReadingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-premium-lg animate-modal-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Adauga citire contor</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form className="mt-5 space-y-4">
          <div>
            <label className="label">Contor</label>
            <select className="select">
              <option>Apa rece - AR-024531</option>
              <option>Apa calda - AC-018992</option>
              <option>Gaz - GZ-771209</option>
            </select>
          </div>
          <div>
            <label className="label">Valoare citire</label>
            <input type="number" className="input" placeholder="Ex: 125" />
          </div>
          <div>
            <label className="label">Data citire</label>
            <input type="date" className="input" defaultValue="2026-04-30" />
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              Anuleaza
            </button>
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
              Salveaza citire
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddPaymentModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-premium-lg animate-modal-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Inregistreaza plata</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form className="mt-5 space-y-4">
          <div>
            <label className="label">Suma (MDL)</label>
            <input type="number" className="input" placeholder="Ex: 450" />
          </div>
          <div>
            <label className="label">Data plata</label>
            <input type="date" className="input" defaultValue="2026-04-30" />
          </div>
          <div>
            <label className="label">Metoda de plata</label>
            <select className="select">
              <option>Numerar</option>
              <option>Transfer bancar</option>
              <option>Card</option>
            </select>
          </div>
          <div>
            <label className="label">Nota (optional)</label>
            <textarea className="input min-h-[80px]" placeholder="Note adiacente platii..." />
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              Anuleaza
            </button>
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90">
              Inregistreaza plata
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
