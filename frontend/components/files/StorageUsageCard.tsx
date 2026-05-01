'use client';

type Props = {
  usedMb: number;
  maxStorageMb?: number | null;
  filesCount?: number;
};

export default function StorageUsageCard({ usedMb, maxStorageMb, filesCount }: Props) {
  const percent = maxStorageMb ? Math.min(100, (usedMb / maxStorageMb) * 100) : 0;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">Storage usage</p>
      <p className="mt-1 text-xl font-semibold text-foreground">
        {usedMb.toFixed(2)} MB {maxStorageMb ? `/ ${maxStorageMb} MB` : ''}
      </p>
      {typeof filesCount === 'number' ? <p className="text-xs text-muted-foreground">{filesCount} files</p> : null}
      {maxStorageMb ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

