import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProactiveInsight } from "@/lib/automation-insights";

/**
 * Widget "NOVA — à surveiller" : mêmes insights sur toutes les verticales
 * (Garage/Nettoyage/Agence/Restaurant/générique), calculés par
 * lib/automation-insights.ts à partir des vraies données de CE workspace.
 * Chaque action ouvre NOVA avec une question pré-remplie plutôt qu'un faux
 * bouton "Envoyer" — voir le commentaire dans automation-insights.ts.
 */
export function ProactiveInsights({ insights }: { insights: ProactiveInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card className="border-accent/25 bg-gradient-to-br from-panel to-soft">
      <div className="flex items-center gap-1.5">
        <span className="text-[13px]">✦</span>
        <h2 className="text-[12px] font-bold text-ink">NOVA — à surveiller</h2>
      </div>
      <ul className="mt-2.5 flex flex-col gap-2">
        {insights.map((insight, i) => (
          <li
            key={i}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2.5 rounded-lg border bg-bg px-3 py-2",
              insight.level === "warning" ? "border-amber-bg" : "border-line",
            )}
          >
            <span className="flex items-center gap-2 text-[12.5px] text-ink">
              <span>{insight.icon}</span>
              {insight.text}
            </span>
            <Link
              href={insight.actionHref}
              className="shrink-0 rounded-lg border border-line bg-soft px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-panel"
            >
              {insight.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[10.5px] text-faint">
        Calculé à partir de vos vraies données. L&apos;envoi automatique (SMS/email) n&apos;est pas encore branché —
        configurez vos rappels dans{" "}
        <Link href="/automatisations" className="font-semibold text-accent">
          Automatisations
        </Link>
        .
      </p>
    </Card>
  );
}
