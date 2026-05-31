'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export interface QuickActionCardProps {
  title: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  badge?: string | number;
}

const variantStyles = {
  default: {
    card: 'border-border/80 bg-card hover:border-primary/20 hover:bg-accent/25',
    icon: 'bg-muted text-muted-foreground',
  },
  primary: {
    card: 'border-primary/20 bg-accent/35 hover:border-primary/35',
    icon: 'bg-primary/10 text-primary',
  },
  success: {
    card: 'border-success/20 bg-success/10 hover:border-success/30',
    icon: 'bg-success/10 text-success',
  },
  warning: {
    card: 'border-warning/20 bg-warning/10 hover:border-warning/30',
    icon: 'bg-warning/10 text-warning',
  },
} as const;

export default function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  variant = 'default',
  badge,
}: QuickActionCardProps) {
  const styles = variantStyles[variant];

  return (
    <Link
      href={href}
      className={`group flex min-h-24 items-center gap-3 rounded-2xl border p-4 shadow-card transition-all duration-200 hover:shadow-card-hover ${styles.card}`}
    >
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {badge !== undefined && (
            <span className="rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// Compact inline version
export interface QuickActionInlineProps {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: number;
}

export function QuickActionInline({ label, href, icon: Icon, count }: QuickActionInlineProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          {count}
        </span>
      )}
    </Link>
  );
}
