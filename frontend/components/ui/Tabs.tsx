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
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-white/80 p-1 shadow-[0_12px_34px_rgba(15,23,42,0.04)]"
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
            className={`min-h-9 shrink-0 rounded-xl px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'bg-foreground text-background shadow-[0_12px_24px_rgba(15,23,42,0.12)]'
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
