'use client';

type TabItem = {
  key: string;
  label: string;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

export default function Tabs({ items, value, onChange, ariaLabel = 'Secțiuni' }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-border/75 bg-card/95 p-1 shadow-card"
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'bg-primary text-primary-foreground shadow-button'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
