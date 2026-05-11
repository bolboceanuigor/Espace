'use client';

import { forwardRef, type ReactNode } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  activeFiltersCount?: number;
  onClearFilters?: () => void;
}

const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(function FilterBar(
  {
    search,
    onSearchChange,
    searchPlaceholder = 'Caută...',
    filters,
    actions,
    activeFiltersCount,
    onClearFilters,
    className = '',
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={`flex flex-wrap items-center gap-3 ${className}`.trim()}
      {...props}
    >
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}
      {filters && <div className="flex items-center gap-2">{filters}</div>}
      {activeFiltersCount && activeFiltersCount > 0 && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
          Șterge filtrele ({activeFiltersCount})
        </button>
      )}
      {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
    </div>
  );
});

export default FilterBar;

// Filter button component
export interface FilterButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  count?: number;
}

export function FilterButton({
  label,
  active,
  count,
  className = '',
  ...props
}: FilterButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary/30 bg-primary/5 text-foreground'
          : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      } ${className}`.trim()}
      {...props}
    >
      {label}
      {typeof count === 'number' && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {count}
        </span>
      )}
      <ChevronDown className="size-3.5" />
    </button>
  );
}

// Filter chip for active filters
export interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// Filter dropdown trigger
export function FilterDropdownTrigger({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors ${className}`.trim()}
      {...props}
    >
      <SlidersHorizontal className="size-4" />
      {children || 'Filtre'}
    </button>
  );
}
