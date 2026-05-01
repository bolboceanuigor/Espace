'use client';

export default function LoadingState({ label = 'Loading...', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-10 animate-pulse rounded-lg bg-muted/70" />
        ))}
      </div>
    </div>
  );
}
