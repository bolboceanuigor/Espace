'use client';

import { forwardRef } from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className = '', id, children, ...props },
  ref,
) {
  const selectId = id || props.name;

  return (
    <label className="block space-y-1.5" htmlFor={selectId}>
      {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
      <select
        ref={ref}
        id={selectId}
        aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        className={`h-11 w-full rounded-xl border bg-card px-4 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:text-muted-foreground ${
          error
            ? 'border-critical/30 focus:border-critical/40 focus:ring-critical/10'
            : 'border-border/80 focus:border-primary/30 focus:ring-primary/15'
        } ${className}`.trim()}
        {...props}
      >
        {children}
      </select>
      {error ? <span id={`${selectId}-error`} className="text-xs text-critical">{error}</span> : null}
      {!error && hint ? <span id={`${selectId}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
});

export default Select;
