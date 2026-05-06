'use client';

import { forwardRef } from 'react';

const cardBase =
  'rounded-2xl border border-border/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-200';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** No padding (e.g. for tables). Default: p-6 */
  noPadding?: boolean;
  /** Enable hover effect */
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = '', noPadding, hoverable, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`${cardBase} ${noPadding ? '' : 'p-6'} ${hoverable ? 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 cursor-pointer' : ''} ${className}`.trim()}
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
    <div className={`mb-5 border-b border-border/50 pb-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-[15px] font-semibold tracking-tight text-foreground ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`mt-1 text-sm leading-relaxed text-muted-foreground ${className}`.trim()} {...props} />;
}
