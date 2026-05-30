'use client';

import { forwardRef, type ReactNode } from 'react';

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
  variant?: 'default' | 'outlined' | 'muted';
}

const variantStyles = {
  default: 'border border-border/70 bg-card shadow-card',
  outlined: 'border border-border/70 bg-transparent',
  muted: 'border border-border/40 bg-muted/30',
} as const;

const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(function SectionCard(
  { title, description, actions, footer, noPadding, variant = 'default', className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
      {footer && (
        <div className="rounded-b-2xl border-t border-border/60 bg-muted/30 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
});

export default SectionCard;

// Simple info row for section content
export interface InfoRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function InfoRow({ label, value, className = '' }: InfoRowProps) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0 ${className}`.trim()}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// Grid layout for section content
export function SectionGrid({
  columns = 2,
  children,
  className = '',
}: {
  columns?: 1 | 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return <div className={`grid gap-4 ${gridClass} ${className}`.trim()}>{children}</div>;
}
