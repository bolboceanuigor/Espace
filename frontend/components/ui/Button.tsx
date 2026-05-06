'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useLocalizedPath } from '@/lib/use-localized-path';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-2xl font-medium transition duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-primary/35 focus:ring-offset-1 disabled:pointer-events-none disabled:opacity-50';

const variants = {
  primary:
    'bg-foreground text-background shadow-[0_14px_34px_-20px_rgba(15,23,42,0.85)] hover:bg-foreground/90',
  secondary: 'border border-border/70 bg-white text-foreground shadow-sm hover:bg-muted/80',
  ghost: 'text-foreground/80 hover:bg-muted/70',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  outline: 'border border-border/70 bg-white text-foreground hover:bg-muted/70',
} as const;

const sizes = {
  sm: 'h-9 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-10 px-6 text-sm',
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
