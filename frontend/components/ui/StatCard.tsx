'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  trend?: { value: number; label?: string };
  className?: string;
};

const toneConfig = {
  neutral: {
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    accentLine: 'bg-primary/30',
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accentLine: 'bg-emerald-400',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    accentLine: 'bg-amber-400',
  },
  danger: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    accentLine: 'bg-rose-400',
  },
} as const;

export default function StatCard({ label, value, description, icon, tone = 'neutral', trend, className = '' }: StatCardProps) {
  const config = toneConfig[tone];
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border/75 bg-card shadow-card transition-all duration-200 hover:border-primary/20 hover:shadow-card-hover ${className}`}>
      {/* Accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${config.accentLine} opacity-0 group-hover:opacity-100 transition-opacity`} />
      
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
              {trend && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {trend.value >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            )}
          </div>
          {icon && (
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${config.iconBg} ${config.iconColor}`}>
              {icon}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
