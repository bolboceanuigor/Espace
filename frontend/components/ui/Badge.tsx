'use client';

const base = 'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors';

const variants = {
  default: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  error: 'bg-red-50 text-red-700',
  neutral: 'bg-muted/70 text-muted-foreground',
  primary: 'bg-foreground text-background',
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
