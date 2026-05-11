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
      className={`rounded-xl border border-border bg-card shadow-sm ${hoverable ? 'transition-all duration-200 hover:shadow-md hover:border-primary/20' : ''} ${noPadding ? '' : 'p-5'} ${className}`.trim()}
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
    <div className={`flex items-center justify-between pb-4 border-b border-border ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base font-semibold text-foreground ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-0.5 text-sm text-muted-foreground ${className}`.trim()} {...props} />;
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
    <div className={`pt-4 mt-4 border-t border-border ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
