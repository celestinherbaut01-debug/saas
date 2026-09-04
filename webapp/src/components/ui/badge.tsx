import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "dark";

const TONE_CLS: Record<BadgeTone, string> = {
  neutral: "bg-soft text-muted",
  accent: "bg-accent/15 text-accent",
  success: "bg-green-bg text-green-fg",
  warning: "bg-amber-bg text-amber-fg",
  danger: "bg-red-bg text-red-fg",
  dark: "bg-ink text-bg",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold", TONE_CLS[tone], className)}>
      {children}
    </span>
  );
}
