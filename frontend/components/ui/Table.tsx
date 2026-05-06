'use client';

const tableWrapper = 'overflow-x-auto rounded-2xl border border-border/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)]';

export function TableWrapper({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`${tableWrapper} ${className}`.trim()} {...props} />;
}

export function Table({ className = '', ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={`w-full ${className}`.trim()} {...props} />;
}

export function TableHead({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`.trim()}
      {...props}
    />
  );
}

export function TableBody({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-border/40 ${className}`.trim()} {...props} />;
}

export function TableRow({
  className = '',
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={`${hover ? 'transition-colors duration-150 hover:bg-muted/30' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

const cellBase = 'px-5 py-4';

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
      <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
