'use client';

import { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, ...props },
  ref,
) {
  const inputId = id || props.name;

  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`h-11 w-full rounded-2xl border bg-card px-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:text-muted-foreground ${
          error
            ? 'border-rose-200 focus:border-rose-300 focus:ring-rose-100'
            : 'border-border/80 focus:border-foreground/25 focus:ring-foreground/10'
        } ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <span id={`${inputId}-error`} className="text-xs text-rose-600">{error}</span> : null}
      {!error && hint ? <span id={`${inputId}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
});

export default Input;
