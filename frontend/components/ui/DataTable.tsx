'use client';

import { forwardRef, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (item: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  className?: string;
  stickyHeader?: boolean;
}

function DataTableInner<T>(
  {
    columns,
    data,
    keyExtractor,
    onRowClick,
    selectedIds,
    onSelectionChange,
    sortBy,
    sortDirection,
    onSort,
    loading,
    emptyState,
    className = '',
    stickyHeader = false,
  }: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };
  const selectionEnabled = Boolean(onSelectionChange);
  const allVisibleSelected = data.length > 0 && data.every((item) => selectedIds?.includes(keyExtractor(item)));

  return (
    <div ref={ref} className={`overflow-x-auto ${className}`.trim()}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={`border-b border-border/60 ${stickyHeader ? 'sticky top-0 bg-card z-10' : ''}`}>
            {selectionEnabled ? (
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => onSelectionChange?.(event.target.checked ? data.map((item) => keyExtractor(item)) : [])}
                  aria-label="Selectează toate rândurile vizibile"
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${alignClass(col.align)}`}
                style={{ width: col.width }}
              >
                {col.sortable && onSort ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => onSort(col.key)}
                  >
                    {col.header}
                    {sortBy === col.key ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )
                    ) : (
                      <ChevronDown className="size-3.5 opacity-30" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <div className="h-4 bg-muted/60 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectionEnabled ? 1 : 0)} className="px-4 py-8">
                {emptyState || (
                  <div className="text-center text-sm text-muted-foreground">
                    Nu există date de afișat.
                  </div>
                )}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-muted/30'
                    : 'hover:bg-muted/20'
                }`}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {selectionEnabled ? (
                  <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds?.includes(keyExtractor(item)))}
                      onChange={(event) => {
                        const id = keyExtractor(item);
                        onSelectionChange?.(event.target.checked ? [...(selectedIds || []), id] : (selectedIds || []).filter((value) => value !== id));
                      }}
                      aria-label="Selectează rândul"
                    />
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 text-sm text-foreground ${alignClass(col.align)}`}
                  >
                    {col.render
                      ? col.render(item, index)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const DataTable = forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof DataTableInner>;

export default DataTable;

// Row action dropdown trigger
export function RowActions({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <MoreHorizontal className="size-4" />
    </button>
  );
}

// Simple cell components
export function CellText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span className={muted ? 'text-muted-foreground' : 'text-foreground'}>{children}</span>
  );
}

export function CellPrimary({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium text-foreground">{primary}</span>
      {secondary && <span className="text-xs text-muted-foreground">{secondary}</span>}
    </div>
  );
}
