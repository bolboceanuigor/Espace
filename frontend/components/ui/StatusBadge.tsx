'use client';

import { forwardRef } from 'react';

const statusConfig = {
  // General statuses
  ACTIVE: { label: 'Activ', variant: 'success' },
  INACTIVE: { label: 'Inactiv', variant: 'neutral' },
  DRAFT: { label: 'Ciornă', variant: 'neutral' },
  LOCKED: { label: 'Blocat', variant: 'neutral' },
  PENDING: { label: 'În așteptare', variant: 'warning' },
  SENT: { label: 'Trimis', variant: 'info' },
  APPROVED: { label: 'Aprobat', variant: 'success' },
  PUBLISHED: { label: 'Publicat', variant: 'success' },
  ACCEPTED: { label: 'Acceptat', variant: 'success' },
  REJECTED: { label: 'Respins', variant: 'error' },
  EXPIRED: { label: 'Expirat', variant: 'error' },
  CANCELLED: { label: 'Anulat', variant: 'neutral' },
  
  // Invoice statuses
  ISSUED: { label: 'Emisă', variant: 'info' },
  UNPAID: { label: 'Neachitată', variant: 'warning' },
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
  WAITING_RESIDENT: { label: 'Așteaptă locatar', variant: 'warning' },
  WAITING_VENDOR: { label: 'Așteaptă prestator', variant: 'warning' },
  CONTACTED: { label: 'Contactat', variant: 'info' },
  QUALIFIED: { label: 'Calificat', variant: 'success' },
  ONBOARDING: { label: 'În onboarding', variant: 'warning' },
  IN_ONBOARDING: { label: 'În onboarding', variant: 'warning' },
  CONVERTED: { label: 'Convertit', variant: 'success' },
  SPAM: { label: 'Spam', variant: 'neutral' },
  PAST_DUE: { label: 'Scadent', variant: 'error' },
  ERROR: { label: 'Eroare', variant: 'error' },
  FAILED: { label: 'Eșuat', variant: 'error' },
  PARTIALLY_ACCEPTED: { label: 'Parțial acceptat', variant: 'warning' },
  REVERSED: { label: 'Stornat', variant: 'neutral' },
  URGENT: { label: 'Urgent', variant: 'error' },
} as const;

const variants = {
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  error: 'border-critical/20 bg-critical/10 text-critical',
  info: 'border-info/20 bg-info/10 text-info',
  neutral: 'border-border/90 bg-muted/70 text-muted-foreground',
} as const;

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  default: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-xs',
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
              ? 'bg-success'
              : variant === 'warning'
                ? 'bg-warning'
                : variant === 'error'
                  ? 'bg-critical'
                  : variant === 'info'
                    ? 'bg-info'
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
              ? 'bg-success'
              : variant === 'warning'
                ? 'bg-warning'
                : variant === 'error'
                  ? 'bg-critical'
                  : variant === 'info'
                    ? 'bg-info'
                    : 'bg-slate-400'
          }`}
        />
      )}
      {children}
    </span>
  );
}
