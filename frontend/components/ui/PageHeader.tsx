'use client';

import { forwardRef, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  badge?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  variant?: 'default' | 'transparent' | 'compact';
}

const variantStyles = {
  default: 'rounded-2xl border border-border/60 bg-card p-5 shadow-card',
  transparent: 'py-4',
  compact: 'py-3',
} as const;

const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, description, badge, backHref, backLabel, actions, tabs, variant = 'default', className = '', ...props },
  ref
) {
  return (
    <div ref={ref} className={`${variantStyles[variant]} ${className}`.trim()} {...props}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="size-4" />
          {backLabel || 'Înapoi'}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl text-balance">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {tabs && <div className="mt-5 -mb-5 border-t border-border/60 pt-4">{tabs}</div>}
    </div>
  );
});

export default PageHeader;

// Section header for within-page sections
export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 mb-4 ${className}`.trim()}>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Page title for simple pages without card wrapper
export interface PageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function PageTitle({ title, subtitle, className = '' }: PageTitleProps) {
  return (
    <div className={`mb-6 ${className}`.trim()}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
