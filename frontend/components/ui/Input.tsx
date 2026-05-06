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
        className={`h-11 w-full rounded-xl border bg-white px-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 ${
          error
            ? 'border-red-200 focus:border-red-300 focus:ring-red-100'
            : 'border-border focus:border-foreground/20 focus:ring-foreground/5'
        } ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
});

export default Input;
