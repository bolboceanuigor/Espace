'use client';

type PageHeaderProps = {
  title: string;
  description?: string;
  rightSlot?: React.ReactNode;
};

export default function PageHeader({ title, description, rightSlot }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/50 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {rightSlot ? <div className="flex items-center gap-2.5">{rightSlot}</div> : null}
    </div>
  );
}
