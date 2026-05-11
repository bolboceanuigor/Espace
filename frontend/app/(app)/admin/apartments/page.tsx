'use client';

import { useState } from 'react';
import { Plus, Upload, MoreHorizontal, Phone, Mail, AlertCircle, Building2, Users, SquareM, Home } from 'lucide-react';
import {
  PageHeader,
  KpiCard,
  FilterBar,
  DataTable,
  StatusBadge,
  Button,
  EmptyState,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';

// Mock data
const apartments = [
  {
    id: '1',
    number: '24',
    staircase: '1',
    floor: 4,
    area: 67.4,
    rooms: 3,
    contactName: 'Ion Popescu',
    contactPhone: '+373 69 123 456',
    contactEmail: 'ion.popescu@email.md',
    status: 'OCCUPIED',
    hasIssues: false,
  },
  {
    id: '2',
    number: '15',
    staircase: '1',
    floor: 3,
    area: 52.8,
    rooms: 2,
    contactName: 'Maria Ionescu',
    contactPhone: '+373 68 234 567',
    contactEmail: 'maria.ionescu@email.md',
    status: 'OCCUPIED',
    hasIssues: false,
  },
  {
    id: '3',
    number: '12',
    staircase: '1',
    floor: 2,
    area: null,
    rooms: 2,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    status: 'OCCUPIED',
    hasIssues: true,
  },
  {
    id: '4',
    number: '7',
    staircase: '1',
    floor: 1,
    area: 45.2,
    rooms: 1,
    contactName: 'Andrei Rusu',
    contactPhone: null,
    contactEmail: 'andrei.rusu@email.md',
    status: 'OCCUPIED',
    hasIssues: true,
  },
  {
    id: '5',
    number: '3',
    staircase: '1',
    floor: 0,
    area: 78.5,
    rooms: 4,
    contactName: 'Elena Ciobanu',
    contactPhone: '+373 79 345 678',
    contactEmail: null,
    status: 'OCCUPIED',
    hasIssues: false,
  },
  {
    id: '6',
    number: '42',
    staircase: '2',
    floor: 5,
    area: 56.0,
    rooms: 2,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    status: 'VACANT',
    hasIssues: false,
  },
];

const kpis = {
  total: 48,
  withoutContact: 3,
  withoutArea: 1,
  occupied: 45,
};

type Apartment = (typeof apartments)[number];

export default function ApartmentsPage() {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const filteredApartments = apartments.filter((apt) => {
    const matchesSearch =
      !search ||
      apt.number.toLowerCase().includes(search.toLowerCase()) ||
      apt.contactName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !selectedStatus || apt.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<Apartment>[] = [
    {
      key: 'number',
      header: 'Apartament',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
            {item.number}
          </div>
          <div>
            <span className="font-medium text-foreground">Ap. {item.number}</span>
            {item.hasIssues && (
              <AlertCircle className="ml-1.5 inline-block size-3.5 text-amber-500" />
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'staircase',
      header: 'Scara',
      render: (item) => <span className="text-muted-foreground">Sc. {item.staircase}</span>,
    },
    {
      key: 'floor',
      header: 'Etaj',
      render: (item) => <span className="text-muted-foreground">{item.floor === 0 ? 'Parter' : `Et. ${item.floor}`}</span>,
    },
    {
      key: 'area',
      header: 'Suprafață',
      render: (item) =>
        item.area ? (
          <span>{item.area} m²</span>
        ) : (
          <span className="text-amber-600">Lipsește</span>
        ),
    },
    {
      key: 'contactName',
      header: 'Contact principal',
      render: (item) =>
        item.contactName ? (
          <div>
            <p className="font-medium text-foreground">{item.contactName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.contactPhone && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3" />
                  {item.contactPhone}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-amber-600">Nesetat</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <StatusBadge
          status={item.status === 'OCCUPIED' ? 'ACTIVE' : 'INACTIVE'}
          label={item.status === 'OCCUPIED' ? 'Ocupat' : 'Vacant'}
          size="sm"
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: () => (
        <button
          type="button"
          className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="size-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Apartamente"
        description="Gestionează apartamentele și proprietarii din asociație"
        variant="transparent"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <Upload className="size-4" />
              Importă CSV
            </Button>
            <Button size="sm">
              <Plus className="size-4" />
              Adaugă apartament
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total apartamente"
          value={kpis.total}
          icon={<Building2 className="size-5" />}
        />
        <KpiCard
          title="Fără contact principal"
          value={kpis.withoutContact}
          variant={kpis.withoutContact > 0 ? 'warning' : 'default'}
          icon={<Users className="size-5" />}
        />
        <KpiCard
          title="Fără suprafață"
          value={kpis.withoutArea}
          variant={kpis.withoutArea > 0 ? 'warning' : 'default'}
          icon={<SquareM className="size-5" />}
        />
        <KpiCard
          title="Ocupate"
          value={kpis.occupied}
          subtitle={`${Math.round((kpis.occupied / kpis.total) * 100)}% din total`}
          icon={<Home className="size-5" />}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Caută după număr sau proprietar..."
        filters={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedStatus(null)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                !selectedStatus
                  ? 'border-primary/30 bg-primary/5 text-foreground'
                  : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              Toate
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('OCCUPIED')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedStatus === 'OCCUPIED'
                  ? 'border-primary/30 bg-primary/5 text-foreground'
                  : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              Ocupate
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('VACANT')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedStatus === 'VACANT'
                  ? 'border-primary/30 bg-primary/5 text-foreground'
                  : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              Vacante
            </button>
          </div>
        }
      />

      {/* Data Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredApartments}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => console.log('View apartment', item.id)}
          emptyState={
            <EmptyState
              type="buildings"
              title="Nu există apartamente"
              description="Adaugă primul apartament pentru a începe gestionarea asociației."
              action={
                <Button size="sm">
                  <Plus className="size-4" />
                  Adaugă apartament
                </Button>
              }
            />
          }
        />
      </div>
    </div>
  );
}
