import data from '@/data/whats-new.json';

export default function WhatsNewPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h1 className="text-lg font-semibold text-foreground">What&apos;s new</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Product updates and improvements.
        </p>
      </div>
      <div className="space-y-3">
        {data.map((entry) => (
          <div key={entry.version} className="rounded-2xl border border-border/60 bg-card p-5">
            <p className="text-sm font-semibold text-foreground">
              {entry.version} <span className="text-muted-foreground">• {entry.date}</span>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {entry.changes.map((change) => (
                <li key={change}>- {change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
