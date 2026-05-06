'use client';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

const toneClasses = {
  neutral: 'bg-muted/60 text-foreground',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
} as const;

export default function StatCard({ label, value, description, icon, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {description ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {icon ? (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}
