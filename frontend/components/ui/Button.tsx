'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useLocalizedPath } from '@/lib/use-localized-path';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variants = {
  primary:
    'bg-foreground text-white shadow-medium hover:bg-foreground/90',
  secondary: 'border border-border bg-white text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-border bg-white text-foreground hover:bg-muted',
} as const;

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  default: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-sm',
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
