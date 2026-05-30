'use client';

import { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className = '', id, ...props },
  ref,
) {
  const textareaId = id || props.name;

  return (
    <label className="block space-y-1.5" htmlFor={textareaId}>
      {label ? <span className="text-sm font-medium text-foreground">{label}</span> : null}
      <textarea
        ref={ref}
        id={textareaId}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        className={`min-h-28 w-full rounded-2xl border bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:text-muted-foreground ${
          error
            ? 'border-rose-200 focus:border-rose-300 focus:ring-rose-100'
            : 'border-border/80 focus:border-primary/30 focus:ring-primary/15'
        } ${className}`.trim()}
        {...props}
      />
      {error ? <span id={`${textareaId}-error`} className="text-xs text-rose-600">{error}</span> : null}
      {!error && hint ? <span id={`${textareaId}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
});

export default Textarea;
