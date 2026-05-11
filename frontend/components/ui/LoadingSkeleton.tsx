'use client';

type LoadingSkeletonProps = {
  rows?: number;
  variant?: 'cards' | 'table' | 'page';
  label?: string;
};

export default function LoadingSkeleton({ rows = 4, variant = 'cards', label }: LoadingSkeletonProps) {
  if (variant === 'table') {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-slate-50" />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 px-5 py-4">
              <span className="h-4 rounded-full bg-slate-100" />
              <span className="h-4 rounded-full bg-slate-100" />
              <span className="h-4 rounded-full bg-slate-100" />
              <span className="h-4 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      {label ? <p className="text-sm font-medium text-slate-500">{label}</p> : null}
      <div className={`grid gap-3 ${variant === 'page' ? 'md:grid-cols-3' : ''}`}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-3 p-5">
              <div className="h-4 w-1/3 rounded-full bg-slate-100" />
              <div className="h-7 w-1/2 rounded-full bg-slate-100" />
              <div className="h-3 w-2/3 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
