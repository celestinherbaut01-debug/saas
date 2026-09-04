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
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-soft/60 px-6 py-10 text-center">
      <span className="text-2xl opacity-60">{icon}</span>
      <p className="font-display text-[13.5px] font-bold text-ink">{title}</p>
      {description && <p className="max-w-sm text-[12px] text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
