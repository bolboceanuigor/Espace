'use client';

import { forwardRef, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  eyebrow?: string;
  description?: string;
  badge?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  rightSlot?: ReactNode; // Alias for actions - backwards compatibility
  tabs?: ReactNode;
  variant?: 'default' | 'transparent' | 'compact';
}

const variantStyles = {
  default: 'py-1',
  transparent: 'py-4',
  compact: 'py-3',
} as const;

const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, eyebrow, description, badge, backHref, backLabel, actions, rightSlot, tabs, variant = 'default', className = '', ...props },
  ref
) {
  // Support both actions and rightSlot for backwards compatibility
  const actionsContent = actions || rightSlot;
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
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-foreground md:text-[1.9rem] text-balance">
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
        {actionsContent && <div className="flex w-full flex-shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actionsContent}</div>}
      </div>
      {tabs && <div className="mt-4 overflow-x-auto border-b border-border/70">{tabs}</div>}
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
