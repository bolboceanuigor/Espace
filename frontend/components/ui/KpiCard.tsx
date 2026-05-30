'use client';

import { forwardRef, type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
    direction?: 'up' | 'down';
  };
  variant?: 'default' | 'accent' | 'warning' | 'error';
  size?: 'sm' | 'default' | 'lg';
}

const variantStyles = {
  default: 'bg-card border-border/75',
  accent: 'bg-emerald-50/55 border-emerald-200/75',
  warning: 'bg-amber-50/60 border-amber-200/75',
  error: 'bg-rose-50/60 border-rose-200/75',
} as const;

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  accent: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-rose-100 text-rose-600',
} as const;

const sizeStyles = {
  sm: {
    card: 'p-4',
    title: 'text-xs',
    value: 'text-xl',
    icon: 'size-8',
  },
  default: {
    card: 'p-5',
    title: 'text-xs',
    value: 'text-2xl',
    icon: 'size-10',
  },
  lg: {
    card: 'p-6',
    title: 'text-sm',
    value: 'text-3xl',
    icon: 'size-12',
  },
} as const;

const KpiCard = forwardRef<HTMLDivElement, KpiCardProps>(function KpiCard(
  { title, value, subtitle, icon, trend, variant = 'default', size = 'default', className = '', ...props },
  ref
) {
  const styles = sizeStyles[size];
  const trendDirection = trend?.direction || (trend && trend.value >= 0 ? 'up' : 'down');
  const trendIsPositive = trendDirection === 'up';

  return (
    <div
      ref={ref}
      className={`rounded-2xl border shadow-card transition-all duration-200 hover:border-foreground/10 hover:shadow-card-hover ${variantStyles[variant]} ${styles.card} ${className}`.trim()}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`font-semibold uppercase tracking-[0.08em] text-muted-foreground ${styles.title}`}>{title}</p>
          <p className={`font-semibold text-foreground tracking-tight mt-1 ${styles.value}`}>
            {typeof value === 'number' ? value.toLocaleString('ro-MD') : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trendIsPositive ? (
                <TrendingUp className="size-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="size-3.5 text-rose-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  trendIsPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`flex items-center justify-center rounded-lg ${iconVariantStyles[variant]} ${styles.icon}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
});

export default KpiCard;

// Compact inline KPI for dashboard grids
export interface KpiInlineProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const inlineVariants = {
  default: 'text-foreground',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-rose-600',
} as const;

export function KpiInline({ label, value, variant = 'default' }: KpiInlineProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${inlineVariants[variant]}`}>
        {typeof value === 'number' ? value.toLocaleString('ro-MD') : value}
      </span>
    </div>
  );
}
