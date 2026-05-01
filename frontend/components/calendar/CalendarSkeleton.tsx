'use client';

export default function CalendarSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-56 rounded-xl bg-muted/60" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {[...Array.from({ length: 6 })].map((_, index) => (
            <div key={`head-${index}`} className="h-9 rounded-xl bg-muted/60" />
          ))}
        </div>
        <div className="rounded-xl border border-border/60 p-2">
          <div className="mb-2 h-10 rounded-lg bg-muted/50" />
          <div className="space-y-2">
            {[...Array.from({ length: 8 })].map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="relative h-12 rounded-lg bg-muted/30">
                <div className="absolute left-2 top-2 h-8 w-36 rounded-md bg-muted/50" />
                <div className="absolute left-44 top-3 h-4 w-32 rounded-md bg-muted/50" />
                <div className="absolute left-80 top-3 h-4 w-24 rounded-md bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
