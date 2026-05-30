'use client';

const base = 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold';

const variants = {
  default: 'border-primary/20 bg-accent/45 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  error: 'border-critical/20 bg-critical/10 text-critical',
  neutral: 'border-border/80 bg-muted/70 text-muted-foreground',
} as const;

export type BadgeVariant = keyof typeof variants;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span className={`${base} ${variants[variant]} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
