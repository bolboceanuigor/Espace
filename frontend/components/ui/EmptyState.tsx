'use client';

import { forwardRef, type ReactNode } from 'react';
import { Inbox, FileText, Users, Building2, Receipt, AlertCircle, Search } from 'lucide-react';

const defaultIcons = {
  default: Inbox,
  documents: FileText,
  users: Users,
  buildings: Building2,
  invoices: Receipt,
  error: AlertCircle,
  search: Search,
} as const;

export type EmptyStateType = keyof typeof defaultIcons;

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: EmptyStateType;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'default' | 'lg';
}

const sizeStyles = {
  sm: {
    wrapper: 'py-8',
    icon: 'size-10',
    iconWrapper: 'size-14',
    title: 'text-sm',
    description: 'text-xs',
  },
  default: {
    wrapper: 'py-12',
    icon: 'size-12',
    iconWrapper: 'size-16',
    title: 'text-base',
    description: 'text-sm',
  },
  lg: {
    wrapper: 'py-16',
    icon: 'size-14',
    iconWrapper: 'size-20',
    title: 'text-lg',
    description: 'text-sm',
  },
} as const;

const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { type = 'default', icon, title, description, action, size = 'default', className = '', ...props },
  ref
) {
  const styles = sizeStyles[size];
  const IconComponent = defaultIcons[type];

  return (
    <div
      ref={ref}
      className={`flex flex-col items-center justify-center text-center ${styles.wrapper} ${className}`.trim()}
      {...props}
    >
      <div className={`mb-4 flex items-center justify-center rounded-2xl border border-border/70 bg-muted/55 ${styles.iconWrapper}`}>
        {icon || <IconComponent className={`text-muted-foreground/60 ${styles.icon}`} />}
      </div>
      <h3 className={`font-semibold tracking-tight text-foreground ${styles.title}`}>{title}</h3>
      {description && (
        <p className={`mt-1 max-w-sm leading-6 text-muted-foreground ${styles.description}`}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
});

export default EmptyState;

// Inline empty state for small areas
export interface EmptyStateInlineProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyStateInline({ message, icon }: EmptyStateInlineProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      {icon || <Inbox className="size-4" />}
      <span>{message}</span>
    </div>
  );
}
