import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { MissionSummary } from "@/lib/actions/business-twin";

const STATUS_LABEL: Record<string, { text: string; tone: BadgeTone }> = {
  active: { text: "Active", tone: "accent" },
  at_risk: { text: "À risque", tone: "danger" },
  succeeded: { text: "Réussie", tone: "success" },
  failed: { text: "Échouée", tone: "neutral" },
  abandoned: { text: "Abandonnée", tone: "neutral" },
};

/** Aperçu compact des missions actives — voir /missions pour la vue complète (point 8/14 de la refonte). */
export function MissionsPreview({ missions }: { missions: MissionSummary[] }) {
  if (missions.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold">Missions en cours</h2>
        <Link href="/missions" className="text-[12px] font-semibold text-accent">
          Voir tout →
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {missions.slice(0, 3).map((m) => {
          const status = m.risk.status === "at_risk" ? "at_risk" : m.status;
          return (
            <li key={m.id}>
              <Link href={`/missions/${m.id}`} className="flex flex-col gap-1 rounded-lg border border-line bg-bg px-3 py-2.5 hover:bg-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">{m.goalLabel}</span>
                  <Badge tone={STATUS_LABEL[status]?.tone ?? "neutral"}>{STATUS_LABEL[status]?.text ?? status}</Badge>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${m.totalActions > 0 ? Math.round((m.doneActions / m.totalActions) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted">
                  {m.doneActions}/{m.totalActions} action(s) — {m.risk.note ?? "en bonne voie"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
