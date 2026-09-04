import type { QuotaStatus } from "@/lib/quota";
import { cn } from "@/lib/utils";

export function UsageBar({ label, status }: { label: string; status: QuotaStatus }) {
  const pct = status.limit > 0 ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0;
  return (
    <div className="rounded-lg border border-line bg-soft p-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
        <span>{label}</span>
        <span>
          {status.used} / {status.limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn("h-full rounded-full", status.exceeded ? "bg-red-fg" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
