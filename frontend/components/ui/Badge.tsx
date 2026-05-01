'use client';

const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium';

const variants = {
  default: 'border-blue-200/80 bg-blue-50 text-blue-700',
  success: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200/80 bg-amber-50 text-amber-700',
  error: 'border-rose-200/80 bg-rose-50 text-rose-700',
  neutral: 'border-border/80 bg-muted/50 text-muted-foreground',
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
