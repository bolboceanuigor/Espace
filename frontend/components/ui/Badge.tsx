'use client';

const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

const variants = {
  default: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-foreground text-white',
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
