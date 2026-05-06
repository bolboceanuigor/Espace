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

export default function Tabs({ items, value, onChange, ariaLabel = 'Sectiuni' }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1"
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
            className={`min-h-9 shrink-0 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
