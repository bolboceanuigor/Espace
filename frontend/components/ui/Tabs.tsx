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
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/30 p-1"
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
            className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? 'bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                : 'text-muted-foreground hover:bg-white/50 hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
