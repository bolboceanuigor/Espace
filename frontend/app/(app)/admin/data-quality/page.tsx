'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Building2,
  Users,
  Gauge,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  Button,
  FilterBar,
  KpiCard,
  ProgressScore,
} from '@/components/ui';

// Mock data - data quality issues
const dataQualityIssues = [
  {
    id: '1',
    type: 'CRITICAL',
    category: 'apartments',
    title: 'Lipsește suprafața utilă',
    description: 'Apartamentul nu are suprafața utilă setată, necesară pentru calculul cheltuielilor comune.',
    entityId: '12',
    entityName: 'Ap. 12',
    link: '/ro/admin/apartments/12',
  },
  {
    id: '2',
    type: 'WARNING',
    category: 'apartments',
    title: 'Contact principal lipsă',
    description: 'Apartamentul nu are un contact principal setat pentru comunicări.',
    entityId: '7',
    entityName: 'Ap. 7',
    link: '/ro/admin/apartments/7',
  },
  {
    id: '3',
    type: 'WARNING',
    category: 'apartments',
    title: 'Contact principal lipsă',
    description: 'Apartamentul nu are un contact principal setat pentru comunicări.',
    entityId: '42',
    entityName: 'Ap. 42',
    link: '/ro/admin/apartments/42',
  },
  {
    id: '4',
    type: 'WARNING',
    category: 'meters',
    title: 'Index lipsă luna curentă',
    description: 'Contorul de apă rece nu are index introdus pentru luna curentă.',
    entityId: '24-apa-rece',
    entityName: 'Ap. 24 - Apă rece',
    link: '/ro/admin/meters/24-apa-rece',
  },
  {
    id: '5',
    type: 'INFO',
    category: 'residents',
    title: 'Email neconfirmat',
    description: 'Locatarul nu și-a confirmat adresa de email.',
    entityId: '15',
    entityName: 'Maria Ionescu',
    link: '/ro/admin/residents/15',
  },
  {
    id: '6',
    type: 'INFO',
    category: 'residents',
    title: 'Telefon nesetat',
    description: 'Locatarul nu are număr de telefon asociat.',
    entityId: '3',
    entityName: 'Elena Ciobanu',
    link: '/ro/admin/residents/3',
  },
];

const qualitySummary = {
  overall: 94,
  apartments: { score: 98, total: 48, issues: 1 },
  residents: { score: 92, total: 127, issues: 10 },
  meters: { score: 88, total: 96, issues: 12 },
};

const categoryFilters = [
  { key: 'all', label: 'Toate', count: dataQualityIssues.length },
  { key: 'apartments', label: 'Apartamente', count: 3 },
  { key: 'residents', label: 'Locatari', count: 2 },
  { key: 'meters', label: 'Contoare', count: 1 },
];

const severityFilters = [
  { key: 'all', label: 'Toate' },
  { key: 'CRITICAL', label: 'Critice', variant: 'error' as const },
  { key: 'WARNING', label: 'Avertismente', variant: 'warning' as const },
  { key: 'INFO', label: 'Info', variant: 'info' as const },
];

export default function DataQualityPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  const filteredIssues = dataQualityIssues.filter((issue) => {
    const matchesSearch =
      !search ||
      issue.title.toLowerCase().includes(search.toLowerCase()) ||
      issue.entityName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || issue.category === selectedCategory;
    const matchesSeverity = selectedSeverity === 'all' || issue.type === selectedSeverity;
    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const criticalCount = dataQualityIssues.filter((i) => i.type === 'CRITICAL').length;
  const warningCount = dataQualityIssues.filter((i) => i.type === 'WARNING').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Calitatea datelor"
        description="Verifică și rezolvă problemele de calitate a datelor pentru o facturare corectă."
        variant="transparent"
        actions={
          <Button variant="secondary" size="sm">
            <RefreshCw className="size-4" />
            Reverifică
          </Button>
        }
      />

      {/* Quality Score Overview */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Overall Score */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card flex items-center gap-5 lg:col-span-1">
          <ProgressScore
            value={qualitySummary.overall}
            size="lg"
          />
          <div>
            <h3 className="font-semibold text-foreground">Scor general</h3>
            <p className="text-sm text-muted-foreground">
              {criticalCount > 0 ? `${criticalCount} probleme critice` : 'Date de calitate bună'}
            </p>
          </div>
        </div>

        {/* Category Scores */}
        <KpiCard
          title="Apartamente"
          value={`${qualitySummary.apartments.score}%`}
          subtitle={`${qualitySummary.apartments.issues} probleme`}
          variant={qualitySummary.apartments.score >= 95 ? 'accent' : 'warning'}
          icon={<Building2 className="size-5" />}
        />
        <KpiCard
          title="Locatari"
          value={`${qualitySummary.residents.score}%`}
          subtitle={`${qualitySummary.residents.issues} probleme`}
          variant={qualitySummary.residents.score >= 95 ? 'accent' : 'warning'}
          icon={<Users className="size-5" />}
        />
        <KpiCard
          title="Contoare"
          value={`${qualitySummary.meters.score}%`}
          subtitle={`${qualitySummary.meters.issues} probleme`}
          variant={qualitySummary.meters.score >= 95 ? 'accent' : 'warning'}
          icon={<Gauge className="size-5" />}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Caută probleme..."
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {categoryFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSelectedCategory(filter.key)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === filter.key
                    ? 'border-primary/30 bg-primary/5 text-foreground'
                    : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {filter.label}
                {filter.count !== undefined && (
                  <span className="ml-1.5 text-xs text-muted-foreground">({filter.count})</span>
                )}
              </button>
            ))}
            <span className="mx-1 text-muted-foreground">|</span>
            {severityFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSelectedSeverity(filter.key)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedSeverity === filter.key
                    ? 'border-primary/30 bg-primary/5 text-foreground'
                    : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-start gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-card transition-colors hover:border-border"
            >
              {/* Severity icon */}
              <div
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  issue.type === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-600'
                    : issue.type === 'WARNING'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-sky-100 text-sky-600'
                }`}
              >
                {issue.type === 'CRITICAL' ? (
                  <AlertCircle className="size-5" />
                ) : issue.type === 'WARNING' ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <CheckCircle2 className="size-5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{issue.title}</h3>
                      <StatusBadge status={issue.type} size="sm" />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{issue.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Afectează: <span className="font-medium text-foreground">{issue.entityName}</span>
                    </p>
                  </div>
                  <Link
                    href={issue.link}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Rezolvă
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center shadow-card">
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <h3 className="mt-4 font-semibold text-foreground">Nicio problemă găsită</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || selectedCategory !== 'all' || selectedSeverity !== 'all'
                ? 'Nu există probleme care să corespundă filtrelor selectate.'
                : 'Toate datele sunt complete și valide.'}
            </p>
          </div>
        )}
      </div>

      {/* Critical issues banner */}
      {criticalCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0">
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-lg">
            <AlertCircle className="size-5 text-rose-600" />
            <div>
              <p className="text-sm font-medium text-rose-900">
                {criticalCount} probleme critice necesită atenție
              </p>
              <p className="text-xs text-rose-700">Rezolvă-le înainte de facturare</p>
            </div>
            <Button size="sm" className="ml-2 bg-rose-600 hover:bg-rose-700">
              Vezi toate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
