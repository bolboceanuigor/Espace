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
    <label className="block space-y-2" htmlFor={inputId}>
      {label ? <span className="text-[13px] font-semibold tracking-tight text-foreground/90">{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        className={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-foreground shadow-none outline-none transition-all duration-200 placeholder:text-muted-foreground/50 focus:ring-2 hover:border-border ${
          error
            ? 'border-red-200 focus:border-red-300 focus:ring-red-100/50'
            : 'border-border/70 focus:border-primary/30 focus:ring-primary/10'
        } ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
});

export default Input;
