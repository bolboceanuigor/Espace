'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  AlertTriangle,
  FileText,
  Gauge,
  Calculator,
  Send,
  Lock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  Button,
  ProgressBar,
  KpiCard,
} from '@/components/ui';
import { Stepper } from '@/components/ui/Timeline';

// Billing workflow steps
const billingSteps = [
  { id: 'data-quality', label: 'Calitatea datelor' },
  { id: 'meter-readings', label: 'Indexuri contoare' },
  { id: 'tariffs', label: 'Verificare tarife' },
  { id: 'calculate', label: 'Calculare facturi' },
  { id: 'review', label: 'Revizuire' },
  { id: 'publish', label: 'Publicare' },
];

// Mock data
const billingPeriod = {
  month: 'Mai',
  year: 2025,
  status: 'IN_PROGRESS',
  currentStep: 2,
};

const dataQualitySummary = {
  total: 48,
  valid: 45,
  warnings: 2,
  errors: 1,
  percentage: 94,
};

const meterReadingsSummary = {
  total: 96,
  submitted: 84,
  missing: 12,
  percentage: 88,
};

const workflowSteps = [
  {
    id: 'data-quality',
    title: 'Verificare calitate date',
    description: 'Verifică dacă toate apartamentele au datele necesare pentru facturare.',
    icon: CheckCircle2,
    status: 'completed' as const,
    stats: {
      value: `${dataQualitySummary.valid}/${dataQualitySummary.total}`,
      label: 'apartamente valide',
    },
    action: { label: 'Vezi probleme', href: '/ro/admin/data-quality' },
  },
  {
    id: 'meter-readings',
    title: 'Indexuri contoare',
    description: 'Verifică și completează indexurile pentru luna curentă.',
    icon: Gauge,
    status: 'completed' as const,
    stats: {
      value: `${meterReadingsSummary.submitted}/${meterReadingsSummary.total}`,
      label: 'indexuri introduse',
    },
    action: { label: 'Vezi indexuri', href: '/ro/admin/meters/readings' },
  },
  {
    id: 'tariffs',
    title: 'Verificare tarife',
    description: 'Verifică și actualizează tarifele pentru luna curentă.',
    icon: Calculator,
    status: 'current' as const,
    stats: {
      value: '12',
      label: 'tarife active',
    },
    action: { label: 'Verifică tarife', href: '/ro/admin/tariffs' },
  },
  {
    id: 'calculate',
    title: 'Calculare facturi',
    description: 'Generează facturile pe baza consumurilor și tarifelor.',
    icon: FileText,
    status: 'upcoming' as const,
    stats: {
      value: '0/48',
      label: 'facturi generate',
    },
    action: { label: 'Generează', href: '#', disabled: true },
  },
  {
    id: 'review',
    title: 'Revizuire și aprobare',
    description: 'Verifică facturile generate înainte de publicare.',
    icon: CheckCircle2,
    status: 'upcoming' as const,
    stats: {
      value: '—',
      label: 'în așteptare',
    },
    action: { label: 'Revizuiește', href: '#', disabled: true },
  },
  {
    id: 'publish',
    title: 'Publicare și notificare',
    description: 'Publică facturile și trimite notificări locatarilor.',
    icon: Send,
    status: 'upcoming' as const,
    stats: {
      value: '—',
      label: 'în așteptare',
    },
    action: { label: 'Publică', href: '#', disabled: true },
  },
];

export default function BillingPage() {
  const [isCalculating, setIsCalculating] = useState(false);

  const overallProgress = (billingPeriod.currentStep / billingSteps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`Facturare ${billingPeriod.month} ${billingPeriod.year}`}
        description="Urmează pașii pentru a genera și publica facturile lunare."
        variant="transparent"
        badge={<StatusBadge status={billingPeriod.status} />}
        actions={
          <Button disabled={isCalculating}>
            {isCalculating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Se calculează...
              </>
            ) : (
              <>
                Continuă la următorul pas
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        }
      />

      {/* Progress Overview */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Progres general</h2>
            <p className="text-xs text-muted-foreground">
              Pas {billingPeriod.currentStep} din {billingSteps.length}
            </p>
          </div>
          <span className="text-lg font-semibold text-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <ProgressBar value={overallProgress} size="lg" variant="default" />
        
        {/* Stepper */}
        <div className="mt-6 hidden lg:block">
          <Stepper
            steps={billingSteps}
            currentStep={billingPeriod.currentStep}
          />
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Calitatea datelor"
          value={`${dataQualitySummary.percentage}%`}
          subtitle={`${dataQualitySummary.errors} erori, ${dataQualitySummary.warnings} avertismente`}
          variant={dataQualitySummary.errors > 0 ? 'warning' : 'accent'}
        />
        <KpiCard
          title="Indexuri introduse"
          value={`${meterReadingsSummary.percentage}%`}
          subtitle={`${meterReadingsSummary.missing} lipsă`}
          variant={meterReadingsSummary.missing > 0 ? 'warning' : 'accent'}
        />
        <KpiCard
          title="Apartamente"
          value={dataQualitySummary.total}
          subtitle="Total pentru facturare"
        />
        <KpiCard
          title="Tarife active"
          value={12}
          subtitle="Verificate"
        />
      </div>

      {/* Workflow Steps */}
      <div className="space-y-4">
        {workflowSteps.map((step, index) => {
          const Icon = step.icon;
          const isLocked = step.status === 'upcoming';
          
          return (
            <div
              key={step.id}
              className={`rounded-xl border bg-card p-5 transition-colors ${
                step.status === 'current'
                  ? 'border-primary/30 bg-primary/[0.02] shadow-card'
                  : 'border-border/60 shadow-card'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Step indicator */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    step.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-600'
                      : step.status === 'current'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="size-5" />
                  ) : isLocked ? (
                    <Lock className="size-4" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`font-semibold ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {index + 1}. {step.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {step.stats.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.stats.label}</p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="mt-3 flex items-center gap-3">
                    {step.status === 'completed' && (
                      <StatusBadge status="COMPLETED" size="sm" />
                    )}
                    {step.status === 'current' && (
                      <StatusBadge status="IN_PROGRESS" size="sm" />
                    )}
                    <Link
                      href={step.action.href}
                      className={`inline-flex items-center gap-1 text-sm ${
                        step.action.disabled
                          ? 'text-muted-foreground cursor-not-allowed'
                          : 'text-primary hover:underline'
                      }`}
                      onClick={(e) => step.action.disabled && e.preventDefault()}
                    >
                      {step.action.label}
                      <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warning banner */}
      {dataQualitySummary.errors > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <h4 className="font-medium text-amber-900">Probleme de calitate a datelor</h4>
            <p className="mt-0.5 text-sm text-amber-700">
              Există {dataQualitySummary.errors} erori care trebuie rezolvate înainte de a continua facturarea.
            </p>
            <Link href="/ro/admin/data-quality" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900">
              Vezi și rezolvă problemele <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
