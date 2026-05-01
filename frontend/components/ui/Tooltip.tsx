'use client';

type TooltipProps = {
  content: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export default function Tooltip({ content, children, disabled = false }: TooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div className="group/tooltip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-md group-hover/tooltip:block dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
        {content}
      </div>
    </div>
  );
}
