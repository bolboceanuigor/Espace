'use client';

import { forwardRef } from 'react';

const cardBase =
  'rounded-2xl border border-border bg-white';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** No padding (e.g. for tables). Default: p-6 */
  noPadding?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = '', noPadding, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`${cardBase} ${noPadding ? '' : 'p-6'} ${className}`.trim()}
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
    <div className={`mb-4 border-b border-border pb-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-base font-semibold text-foreground ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-1 text-sm text-muted-foreground ${className}`.trim()} {...props} />;
}
