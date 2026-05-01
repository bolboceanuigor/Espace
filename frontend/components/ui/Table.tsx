'use client';

const tableWrapper = 'overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)]';

export function TableWrapper({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${tableWrapper} ${className}`.trim()} {...props} />;
}

export function Table({ className = '', ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={`w-full ${className}`.trim()} {...props} />;
}

export function TableHead({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-muted/45 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground ${className}`.trim()}
      {...props}
    />
  );
}

export function TableBody({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-border/50 ${className}`.trim()} {...props} />;
}

export function TableRow({
  className = '',
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={`${hover ? 'transition hover:bg-muted/60' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

const cellBase = 'px-5 py-3.5';

export function TableHeaderCell({ className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`${cellBase} ${className}`.trim()} {...props} />;
}

export function TableCell({ className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`${cellBase} text-sm text-foreground ${className}`.trim()} {...props} />;
}

export function TableEmpty({
  colSpan,
  children = 'No data',
}: {
  colSpan: number;
  children?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
