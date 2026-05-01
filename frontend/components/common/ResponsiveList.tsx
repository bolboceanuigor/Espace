'use client';

import EmptyState from './EmptyState';

type ResponsiveListProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  renderDesktopHeader?: React.ReactNode;
  renderDesktopRow?: (item: T) => React.ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
};

export default function ResponsiveList<T>({
  items,
  keyExtractor,
  renderCard,
  renderDesktopHeader,
  renderDesktopRow,
  emptyTitle,
  emptyDescription,
}: ResponsiveListProps<T>) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {items.map((item) => (
          <div key={keyExtractor(item)} className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            {renderCard(item)}
          </div>
        ))}
      </div>

      {renderDesktopHeader && renderDesktopRow ? (
        <div className="hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:block">
          <div className="border-b border-border/60 pb-2 text-xs text-muted-foreground">{renderDesktopHeader}</div>
          <div className="space-y-2 pt-2">
            {items.map((item) => (
              <div key={keyExtractor(item)}>{renderDesktopRow(item)}</div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
