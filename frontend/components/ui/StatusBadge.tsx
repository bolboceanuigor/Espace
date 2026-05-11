'use client';

import { forwardRef } from 'react';

const statusConfig = {
  // General statuses
  ACTIVE: { label: 'Activ', variant: 'success' },
  INACTIVE: { label: 'Inactiv', variant: 'neutral' },
  DRAFT: { label: 'Ciornă', variant: 'neutral' },
  PENDING: { label: 'În așteptare', variant: 'warning' },
  SENT: { label: 'Trimis', variant: 'info' },
  ACCEPTED: { label: 'Acceptat', variant: 'success' },
  REJECTED: { label: 'Respins', variant: 'error' },
  EXPIRED: { label: 'Expirat', variant: 'error' },
  CANCELLED: { label: 'Anulat', variant: 'neutral' },
  
  // Invoice statuses
  ISSUED: { label: 'Emisă', variant: 'info' },
  PAID: { label: 'Achitată', variant: 'success' },
  PARTIALLY_PAID: { label: 'Parțial achitată', variant: 'warning' },
  OVERDUE: { label: 'Întârziată', variant: 'error' },
  
  // Request/Issue statuses
  NEW: { label: 'Nouă', variant: 'info' },
  OPEN: { label: 'Deschis', variant: 'info' },
  IN_PROGRESS: { label: 'În lucru', variant: 'warning' },
  AWAITING_RESPONSE: { label: 'Așteaptă răspuns', variant: 'warning' },
  RESOLVED: { label: 'Rezolvată', variant: 'success' },
  CLOSED: { label: 'Închis', variant: 'neutral' },
  
  // Data quality
  WARNING: { label: 'Atenție', variant: 'warning' },
  CRITICAL: { label: 'Critic', variant: 'error' },
  INFO: { label: 'Info', variant: 'info' },
  GOOD: { label: 'Bun', variant: 'success' },
  
  // Subscription
  TRIAL: { label: 'Trial', variant: 'warning' },
  ACTIVE_SUBSCRIPTION: { label: 'Activ', variant: 'success' },
  SUSPENDED: { label: 'Suspendat', variant: 'error' },
  
  // Additional common statuses
  SUCCESS: { label: 'Succes', variant: 'success' },
  DONE: { label: 'Finalizat', variant: 'success' },
  CONFIRMED: { label: 'Confirmat', variant: 'success' },
  COMPLETED: { label: 'Completat', variant: 'success' },
  WAITING: { label: 'În așteptare', variant: 'warning' },
  PAST_DUE: { label: 'Scadent', variant: 'error' },
  ERROR: { label: 'Eroare', variant: 'error' },
  FAILED: { label: 'Eșuat', variant: 'error' },
  URGENT: { label: 'Urgent', variant: 'error' },
} as const;

const variants = {
  success: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200/80 bg-amber-50 text-amber-700',
  error: 'border-rose-200/80 bg-rose-50 text-rose-700',
  info: 'border-sky-200/80 bg-sky-50 text-sky-700',
  neutral: 'border-slate-200/80 bg-slate-50 text-slate-600',
} as const;

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  default: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-xs',
} as const;

export type StatusType = keyof typeof statusConfig;
export type StatusVariant = keyof typeof variants;
export type StatusSize = keyof typeof sizes;

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: StatusType | string;
  size?: StatusSize;
  label?: string;
  dot?: boolean;
}

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { status, size = 'default', label, dot = false, className = '', ...props },
  ref
) {
  const normalizedStatus = String(status || '').toUpperCase().replace(/-/g, '_');
  const config = statusConfig[normalizedStatus as StatusType] || { label: status, variant: 'neutral' as const };
  const displayLabel = label || config.label;
  const variant = config.variant as StatusVariant;

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`size-1.5 rounded-full ${
            variant === 'success'
              ? 'bg-emerald-500'
              : variant === 'warning'
                ? 'bg-amber-500'
                : variant === 'error'
                  ? 'bg-rose-500'
                  : variant === 'info'
                    ? 'bg-sky-500'
                    : 'bg-slate-400'
          }`}
        />
      )}
      {displayLabel}
    </span>
  );
});

export default StatusBadge;

// Simple variant badge for manual control
export interface VariantBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  size?: StatusSize;
  dot?: boolean;
}

export function VariantBadge({
  variant = 'neutral',
  size = 'default',
  dot = false,
  className = '',
  children,
  ...props
}: VariantBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`size-1.5 rounded-full ${
            variant === 'success'
              ? 'bg-emerald-500'
              : variant === 'warning'
                ? 'bg-amber-500'
                : variant === 'error'
                  ? 'bg-rose-500'
                  : variant === 'info'
                    ? 'bg-sky-500'
                    : 'bg-slate-400'
          }`}
        />
      )}
      {children}
    </span>
  );
}
