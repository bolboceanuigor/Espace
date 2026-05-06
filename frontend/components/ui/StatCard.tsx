'use client';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

const toneClasses = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
} as const;

export default function StatCard({ label, value, description, icon, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {icon ? (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}
