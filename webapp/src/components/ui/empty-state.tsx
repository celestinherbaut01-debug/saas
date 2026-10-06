export function EmptyState({
  icon = "○",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-soft/60 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[image:var(--gradient-signature)] text-[18px] opacity-80">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-display text-[13.5px] font-bold text-ink">{title}</p>
        {description && <p className="max-w-sm text-[12px] text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
