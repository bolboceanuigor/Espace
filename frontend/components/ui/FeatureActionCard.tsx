'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

type FeatureActionCardTone = 'default' | 'primary' | 'success' | 'warning' | 'info';

export type FeatureActionCardProps = {
  title: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  actionLabel?: string;
  badge?: string | number;
  tone?: FeatureActionCardTone;
  className?: string;
};

const toneStyles: Record<FeatureActionCardTone, { icon: string; badge: string }> = {
  default: {
    icon: 'bg-muted text-muted-foreground',
    badge: 'border-border bg-muted text-muted-foreground',
  },
  primary: {
    icon: 'bg-accent text-primary',
    badge: 'border-primary/20 bg-accent text-primary',
  },
  success: {
    icon: 'bg-success/10 text-success',
    badge: 'border-success/20 bg-success/10 text-success',
  },
  warning: {
    icon: 'bg-warning/10 text-warning',
    badge: 'border-warning/20 bg-warning/10 text-warning',
  },
  info: {
    icon: 'bg-info/10 text-info',
    badge: 'border-info/20 bg-info/10 text-info',
  },
};

export default function FeatureActionCard({
  title,
  description,
  href,
  icon: Icon,
  actionLabel = 'Deschide',
  badge,
  tone = 'default',
  className = '',
}: FeatureActionCardProps) {
  const styles = toneStyles[tone];

  return (
    <Link
      href={href}
      className={`group flex min-h-36 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all duration-200 hover:border-primary/20 hover:bg-accent/20 hover:shadow-card-hover ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="size-5" />
        </span>
        {badge !== undefined ? (
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}>
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition group-hover:border-primary/20 group-hover:text-primary">
          {actionLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
