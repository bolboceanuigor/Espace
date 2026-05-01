'use client';

type PageHeaderProps = {
  title: string;
  description?: string;
  rightSlot?: React.ReactNode;
};

export default function PageHeader({ title, description, rightSlot }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  );
}
