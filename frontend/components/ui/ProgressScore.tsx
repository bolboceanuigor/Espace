'use client';

import { forwardRef } from 'react';

export interface ProgressScoreProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: 'sm' | 'default' | 'lg';
  showValue?: boolean;
  label?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const sizeStyles = {
  sm: {
    circle: 'size-16',
    stroke: 4,
    text: 'text-lg',
    label: 'text-[10px]',
  },
  default: {
    circle: 'size-24',
    stroke: 6,
    text: 'text-2xl',
    label: 'text-xs',
  },
  lg: {
    circle: 'size-32',
    stroke: 8,
    text: 'text-3xl',
    label: 'text-sm',
  },
} as const;

const variantColors = {
  default: { stroke: 'stroke-primary', bg: 'stroke-muted' },
  success: { stroke: 'stroke-emerald-500', bg: 'stroke-emerald-100' },
  warning: { stroke: 'stroke-amber-500', bg: 'stroke-amber-100' },
  error: { stroke: 'stroke-rose-500', bg: 'stroke-rose-100' },
} as const;

const ProgressScore = forwardRef<HTMLDivElement, ProgressScoreProps>(function ProgressScore(
  { value, max = 100, size = 'default', showValue = true, label, variant, className = '', ...props },
  ref
) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const styles = sizeStyles[size];
  
  // Auto-determine variant based on value if not specified
  const autoVariant = variant || (
    percentage >= 80 ? 'success' :
    percentage >= 50 ? 'warning' :
    'error'
  );
  const colors = variantColors[autoVariant];
  
  // SVG circle calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      ref={ref}
      className={`inline-flex flex-col items-center ${className}`.trim()}
      {...props}
    >
      <div className={`relative ${styles.circle}`}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className={colors.bg}
            strokeWidth={styles.stroke}
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className={`${colors.stroke} transition-all duration-500 ease-out`}
            strokeWidth={styles.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-semibold text-foreground ${styles.text}`}>
              {Math.round(value)}
            </span>
          </div>
        )}
      </div>
      {label && (
        <p className={`mt-2 text-muted-foreground font-medium ${styles.label}`}>{label}</p>
      )}
    </div>
  );
});

export default ProgressScore;

// Linear progress bar
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
}

const barSizes = {
  sm: 'h-1',
  default: 'h-2',
  lg: 'h-3',
} as const;

const barColors = {
  default: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
} as const;

export function ProgressBar({
  value,
  max = 100,
  size = 'default',
  variant = 'default',
  showLabel = false,
  className = '',
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={className} {...props}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs font-medium text-foreground">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-muted rounded-full overflow-hidden ${barSizes[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColors[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
