'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Home,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Users,
  Gauge,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

// Mock data for apartments
const apartments = [
  {
    id: '1',
    number: '45',
    staircase: 2,
    floor: 6,
    area: 72.4,
    rooms: 3,
    owner: { name: 'Popescu Ion', phone: '+373 69 123 456', email: 'ion.popescu@email.md' },
    residents: 3,
    debt: 1240,
    lastPayment: 'Martie 2026',
    meters: { updated: 2, missing: 1 },
    status: 'DEBTOR',
  },
  {
    id: '2',
    number: '12',
    staircase: 1,
    floor: 2,
    area: 58.2,
    rooms: 2,
    owner: { name: 'Ionescu Maria', phone: '+373 69 234 567', email: 'maria.ionescu@email.md' },
    residents: 2,
    debt: 0,
    lastPayment: 'Aprilie 2026',
    meters: { updated: 3, missing: 0 },
    status: 'ACTIVE',
  },
  {
    id: '3',
    number: '89',
    staircase: 3,
    floor: 9,
    area: 92.8,
    rooms: 4,
    owner: { name: 'Rusu Andrei', phone: '+373 69 345 678', email: 'andrei.rusu@email.md' },
    residents: 4,
    debt: 2450,
    lastPayment: 'Februarie 2026',
    meters: { updated: 1, missing: 2 },
    status: 'DEBTOR',
  },
  {
    id: '4',
    number: '23',
    staircase: 1,
    floor: 4,
    area: 45.6,
    rooms: 1,
    owner: { name: 'Codrean Elena', phone: '+373 69 456 789', email: 'elena.codrean@email.md' },
    residents: 1,
    debt: 0,
    lastPayment: 'Aprilie 2026',
    meters: { updated: 2, missing: 0 },
    status: 'ACTIVE',
  },
  {
    id: '5',
    number: '67',
    staircase: 2,
    floor: 8,
    area: 68.0,
    rooms: 3,
    owner: { name: 'Moraru Victor', phone: '+373 69 567 890', email: 'victor.moraru@email.md' },
    residents: 0,
    debt: 0,
    lastPayment: null,
    meters: { updated: 0, missing: 3 },
    status: 'UNOCCUPIED',
  },
  {
    id: '6',
    number: '34',
    staircase: 2,
    floor: 5,
    area: 55.0,
    rooms: 2,
    owner: { name: 'Ciobanu Ana', phone: '+373 69 678 901', email: 'ana.ciobanu@email.md' },
    residents: 2,
    debt: 320,
    lastPayment: 'Aprilie 2026',
    meters: { updated: 3, missing: 0 },
    status: 'ACTIVE',
  },
];

const staircaseOptions = [
  { value: 'all', label: 'Toate scarile' },
  { value: '1', label: 'Scara 1' },
  { value: '2', label: 'Scara 2' },
  { value: '3', label: 'Scara 3' },
  { value: '4', label: 'Scara 4' },
];

const statusOptions = [
  { value: 'all', label: 'Toate' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DEBTOR', label: 'Cu datorii' },
  { value: 'UNOCCUPIED', label: 'Nelocuite' },
  { value: 'PROBLEM', label: 'Cu probleme' },
];

export default function AdminApartmentsPage() {
  const [search, setSearch] = useState('');
  const [staircaseFilter, setStaircaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredApartments = apartments.filter((apartment) => {
    const matchesSearch =
      apartment.number.toLowerCase().includes(search.toLowerCase()) ||
      apartment.owner.name.toLowerCase().includes(search.toLowerCase()) ||
      apartment.owner.phone.includes(search);
    const matchesStaircase = staircaseFilter === 'all' || String(apartment.staircase) === staircaseFilter;
    const matchesStatus = statusFilter === 'all' || apartment.status === statusFilter;
    return matchesSearch && matchesStaircase && matchesStatus;
  });

  const stats = {
    total: apartments.length,
    withDebt: apartments.filter((a) => a.debt > 0).length,
    noAccount: apartments.filter((a) => a.residents === 0).length,
    missingReadings: apartments.reduce((sum, a) => sum + a.meters.missing, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Apartamente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionarea apartamentelor, contoarelor si datoriilor.
          </p>
        </div>
        <Link
          href="/admin/apartments/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adauga apartament
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total apartamente" value={stats.total} icon={Home} />
        <SummaryCard label="Cu datorii" value={stats.withDebt} icon={CreditCard} variant="destructive" />
        <SummaryCard label="Fara cont creat" value={stats.noAccount} icon={Users} variant="warning" />
        <SummaryCard label="Citiri lipsa" value={stats.missingReadings} icon={Gauge} variant="warning" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cauta dupa apartament, proprietar sau telefon..."
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              showFilters
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtre
            {(staircaseFilter !== 'all' || statusFilter !== 'all') && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {(staircaseFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[150px]">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Scara</label>
                <select
                  value={staircaseFilter}
                  onChange={(e) => setStaircaseFilter(e.target.value)}
                  className="select"
                >
                  {staircaseOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[150px]">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              {(staircaseFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => { setStaircaseFilter('all'); setStatusFilter('all'); }}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  Reseteaza filtrele
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredApartments.map((apartment) => (
          <ApartmentCard key={apartment.id} apartment={apartment} />
        ))}
        {filteredApartments.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Home className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-foreground">Nu am gasit apartamente</p>
            <p className="mt-1 text-sm text-muted-foreground">Incearca sa modifici criteriile de cautare.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const variantStyles = {
    default: 'bg-card border-border',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
    destructive: 'bg-destructive/5 border-destructive/20',
  };

  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-premium ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${iconStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function ApartmentCard({ apartment }: { apartment: (typeof apartments)[0] }) {
  const statusStyles: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    DEBTOR: 'bg-destructive/10 text-destructive border-destructive/20',
    UNOCCUPIED: 'bg-muted text-muted-foreground border-border',
    PROBLEM: 'bg-warning/10 text-warning border-warning/20',
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Activ',
    DEBTOR: 'Datornic',
    UNOCCUPIED: 'Nelocuit',
    PROBLEM: 'Problema',
  };

  return (
    <Link
      href={`/admin/apartments/${apartment.id}`}
      className="block rounded-2xl border border-border bg-card p-5 shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Apt. {apartment.number}</h3>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusStyles[apartment.status]}`}>
              {statusLabels[apartment.status]}
            </span>
          </div>
          
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>Scara {apartment.staircase}</span>
            <span>Etaj {apartment.floor}</span>
            <span>{apartment.area} m2</span>
            <span>{apartment.rooms} camere</span>
          </div>

          <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{apartment.owner.name}</span>
              <span className="text-xs text-muted-foreground">- {apartment.residents} persoane</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-3 sm:flex-col sm:items-end">
          {apartment.debt > 0 ? (
            <div className="rounded-xl bg-destructive/10 px-3 py-2 text-right">
              <p className="text-[10px] font-medium uppercase text-destructive">Datorie</p>
              <p className="text-lg font-semibold text-destructive">
                {apartment.debt.toLocaleString('ro-RO')} MDL
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-success/10 px-3 py-2 text-right">
              <p className="text-[10px] font-medium uppercase text-success">Fara datorii</p>
              <p className="text-xs text-success">Ultima plata: {apartment.lastPayment || 'N/A'}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            {apartment.meters.updated > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" />
                {apartment.meters.updated} actualizate
              </span>
            )}
            {apartment.meters.missing > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-xs text-warning">
                <AlertCircle className="h-3 w-3" />
                {apartment.meters.missing} lipsa
              </span>
            )}
          </div>

          <ChevronRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
        </div>
      </div>
    </Link>
  );
}
