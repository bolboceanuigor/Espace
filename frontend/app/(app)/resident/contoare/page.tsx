'use client';

import { useState } from 'react';
import {
  Gauge,
  Droplets,
  Flame,
  Zap,
  CheckCircle2,
  AlertCircle,
  Send,
  Calendar,
} from 'lucide-react';

// Mock data
const meters = [
  {
    id: '1',
    type: 'Apa rece',
    icon: Droplets,
    serial: 'AR-024531',
    lastReading: 124,
    unit: 'm3',
    status: 'UPDATED',
    lastUpdated: '28 Apr 2026',
    deadline: '5 Mai 2026',
  },
  {
    id: '2',
    type: 'Apa calda',
    icon: Droplets,
    serial: 'AC-018992',
    lastReading: 89,
    unit: 'm3',
    status: 'UPDATED',
    lastUpdated: '28 Apr 2026',
    deadline: '5 Mai 2026',
  },
  {
    id: '3',
    type: 'Gaz',
    icon: Flame,
    serial: 'GZ-771209',
    lastReading: null,
    unit: 'm3',
    status: 'MISSING',
    lastUpdated: null,
    deadline: '5 Mai 2026',
  },
];

export default function ResidentMetersPage() {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<(typeof meters)[0] | null>(null);

  const missingCount = meters.filter((m) => m.status === 'MISSING').length;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
        <p className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          Contoare
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Citiri contoare
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Transmite citirile contoarelor luna aceasta.
        </p>
      </section>

      {/* Alert */}
      {missingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <span className="rounded-xl bg-warning/20 p-2 text-warning">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {missingCount} contor{missingCount > 1 ? 'e fara' : ' fara'} citire
            </p>
            <p className="text-xs text-muted-foreground">Termen: pana la 5 Mai 2026</p>
          </div>
        </div>
      )}

      {/* Meters List */}
      <section className="space-y-3">
        {meters.map((meter) => {
          const Icon = meter.icon;
          return (
            <div
              key={meter.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-premium"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">{meter.type}</p>
                    <p className="text-xs text-muted-foreground">Nr. {meter.serial}</p>
                  </div>
                </div>
                {meter.status === 'UPDATED' ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Transmis
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Lipsa
                  </span>
                )}
              </div>

              <div className="mt-4 rounded-xl bg-muted/50 p-3">
                {meter.lastReading !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">{meter.lastReading}</span>
                    <span className="text-sm text-muted-foreground">{meter.unit}</span>
                  </div>
                ) : (
                  <p className="text-sm text-warning">Nicio citire transmisa</p>
                )}
                {meter.lastUpdated && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ultima citire: {meter.lastUpdated}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedMeter(meter);
                  setShowSubmitModal(true);
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                Transmite citire
              </button>
            </div>
          );
        })}
      </section>

      {/* Submit Modal */}
      {showSubmitModal && selectedMeter && (
        <SubmitReadingModal
          meter={selectedMeter}
          onClose={() => {
            setShowSubmitModal(false);
            setSelectedMeter(null);
          }}
        />
      )}
    </div>
  );
}

function SubmitReadingModal({
  meter,
  onClose,
}: {
  meter: (typeof meters)[0];
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const Icon = meter.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-premium-lg animate-modal-in sm:mx-4 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Transmite citire</h2>
              <p className="text-xs text-muted-foreground">{meter.type} - {meter.serial}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {meter.lastReading !== null && (
          <div className="mt-4 rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Citire anterioara</p>
            <p className="text-lg font-semibold text-foreground">
              {meter.lastReading} {meter.unit}
            </p>
          </div>
        )}

        <form className="mt-5 space-y-4">
          <div>
            <label className="label">Valoare noua ({meter.unit})</label>
            <input
              type="number"
              className="input text-center text-2xl font-bold"
              placeholder={meter.lastReading ? String(meter.lastReading + 1) : '0'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {meter.lastReading !== null && value && Number(value) < meter.lastReading && (
              <p className="mt-1 text-xs text-destructive">
                Valoarea nu poate fi mai mica decat citirea anterioara.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Data transmiterii: {new Date().toLocaleDateString('ro-RO')}
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Anuleaza
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
            >
              Transmite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
