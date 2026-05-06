'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useLocalizedPath } from '@/lib/use-localized-path';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]';

const variants = {
  primary:
    'bg-foreground text-background shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.25)] hover:bg-foreground/95 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-8px_rgba(0,0,0,0.3)]',
  secondary: 'border border-border bg-white text-foreground hover:bg-muted/60 hover:border-border/80',
  ghost: 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
  danger: 'border border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300',
  outline: 'border border-border bg-transparent text-foreground hover:bg-muted/40',
  accent: 'bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(251,146,60,0.35)] hover:bg-accent/90',
} as const;

const sizes = {
  sm: 'h-9 px-3.5 text-xs',
  default: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-sm',
  icon: 'h-10 w-10',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', className = '', children, type = 'button', isLoading = false, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

export default Button;

export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>,
    Pick<ButtonProps, 'variant' | 'size'> {
  href: string;
  className?: string;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}: ButtonLinkProps) {
  const localizedPath = useLocalizedPath();

  return (
    <Link
      href={localizedPath(href)}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </Link>
  );
}
