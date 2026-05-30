'use client';

import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** No padding (e.g. for tables). Default: p-5 */
  noPadding?: boolean;
  /** Add hover effect */
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = '', noPadding, hoverable, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-border/75 bg-card shadow-card ${hoverable ? 'transition-all duration-200 hover:border-foreground/10 hover:shadow-card-hover' : ''} ${noPadding ? '' : 'p-5'} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
});

export default Card;

export function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base font-semibold tracking-tight text-foreground ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-1 text-sm leading-6 text-muted-foreground ${className}`.trim()} {...props} />;
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`pt-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 border-t border-border/70 pt-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
