'use client';

type DataQualityScoreProps = {
  score: number;
  criticalCount?: number;
  label?: string;
  description?: string;
};

function tone(score: number, criticalCount = 0) {
  if (criticalCount > 0 || score < 70) return {
    ring: 'stroke-critical',
    bg: 'bg-critical/10 text-critical border-critical/20',
    label: 'Probleme importante',
  };
  if (score < 90) return {
    ring: 'stroke-warning',
    bg: 'bg-warning/10 text-warning border-warning/20',
    label: 'Necesită atenție',
  };
  return {
    ring: 'stroke-success',
    bg: 'bg-success/10 text-success border-success/20',
    label: 'Bun',
  };
}

export default function DataQualityScore({ score, criticalCount = 0, label, description }: DataQualityScoreProps) {
  const clamped = Math.max(0, Math.min(100, Number(score || 0)));
  const currentTone = tone(clamped, criticalCount);
  const circumference = 2 * Math.PI * 42;
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90 h-full w-full">
          <circle cx="50" cy="50" r="42" className="stroke-muted" strokeWidth="10" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="42"
            className={currentTone.ring}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tracking-tight text-foreground">{clamped}</span>
          <span className="text-[11px] font-semibold text-muted-foreground">/100</span>
        </div>
      </div>
      <div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${currentTone.bg}`}>
          {label || currentTone.label}
        </span>
        {description ? <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
