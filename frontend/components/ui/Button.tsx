'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useLocalizedPath } from '@/lib/use-localized-path';

const base =
  'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full font-semibold transition duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variants = {
  primary:
    'bg-primary text-primary-foreground shadow-button hover:bg-primary/90',
  secondary: 'border border-border/80 bg-card text-foreground shadow-sm hover:border-primary/20 hover:bg-muted/70',
  ghost: 'text-foreground/75 hover:bg-muted/70 hover:text-foreground',
  danger: 'border border-critical/20 bg-critical/10 text-critical hover:bg-critical/15',
  outline: 'border border-border/80 bg-transparent text-foreground hover:border-primary/20 hover:bg-muted/70',
} as const;

const sizes = {
  sm: 'h-9 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10 p-0 text-sm',
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
