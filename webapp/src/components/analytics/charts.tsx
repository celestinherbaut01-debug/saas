import { cn } from "@/lib/utils";
import type { FunnelStage, WeekPoint } from "@/lib/analytics";
import { STATUS_OPTIONS, type ProspectStatus } from "@/lib/crm-status";

// Graphiques en SVG inline, sans dépendance de charting — mêmes principes
// que le reste du design system (pas de nouvelle dépendance ajoutée sans
// nécessité). Pas de composant client : rendu 100% serveur, aucune
// interactivité JS requise (tooltips natifs via <title>).

const BAR_MAX_THICKNESS = 22;

/** Funnel ordonné (catégories ordonnées -> une seule teinte, paliers d'opacité) — jamais une couleur par étape sans rapport avec l'ordre. */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, stages[0]?.count ?? 0);
  const opacitySteps = [1, 0.8, 0.62, 0.45];
  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.count / max) * 100, stage.count > 0 ? 4 : 0);
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[11.5px] font-semibold text-muted">{stage.label}</span>
            <div className="relative flex-1 rounded-full bg-soft" style={{ height: BAR_MAX_THICKNESS }}>
              <div
                className="flex h-full items-center justify-end rounded-full pr-2.5 transition-[width] duration-500"
                style={{
                  width: `${widthPct}%`,
                  minWidth: stage.count > 0 ? 36 : 0,
                  background: `color-mix(in srgb, var(--accent) ${Math.round(opacitySteps[i] * 100)}%, transparent)`,
                }}
                title={`${stage.label} : ${stage.count}${stage.pctOfFirst != null ? ` (${stage.pctOfFirst}%)` : ""}`}
              >
                {stage.count > 0 && (
                  <span className="text-[10.5px] font-bold text-accent-ink">
                    {stage.count}
                    {stage.pctOfFirst != null && i > 0 && <span className="opacity-80"> · {stage.pctOfFirst}%</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-[10.5px] text-faint">
        Calculé à partir du statut actuel de chaque prospect — pas une reconstitution de l&apos;historique complet
        (un prospect marqué &laquo; Perdu &raquo; après un RDV n&apos;est plus compté dans &laquo; RDV obtenus &raquo;).
      </p>
    </div>
  );
}

const PIPELINE_STATUS_COLOR: Partial<Record<ProspectStatus, string>> = {
  won: "var(--green-fg)",
  lost: "var(--red-fg)",
};

/** Répartition du pipeline — catégories ordonnées (l'ordre du pipeline), teinte unique sauf les deux états terminaux (won/lost = couleur de statut, jamais une teinte par étape arbitraire). */
export function PipelineChart({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  const stages = STATUS_OPTIONS.filter(([v]) => v !== "do_not_contact");
  return (
    <div className="flex flex-col gap-2">
      {stages.map(([status, label]) => {
        const count = counts[status] ?? 0;
        const widthPct = Math.max((count / max) * 100, count > 0 ? 3 : 0);
        const color = PIPELINE_STATUS_COLOR[status] ?? "var(--accent)";
        return (
          <div key={status} className="flex items-center gap-2.5">
            <span className="w-20 shrink-0 text-[11px] text-muted">{label}</span>
            <div className="relative flex-1 rounded-full bg-soft" style={{ height: 16 }}>
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${widthPct}%`, minWidth: count > 0 ? 18 : 0, backgroundColor: color }}
                title={`${label} : ${count}`}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[11px] font-bold text-ink">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Évolution hebdomadaire — une seule série -> une seule teinte, pas de légende (le titre nomme déjà la série). */
export function TrendChart({ points }: { points: WeekPoint[] }) {
  const width = 600;
  const height = 140;
  const padX = 8;
  const padTop = 14;
  const padBottom = 22;
  const plotH = height - padTop - padBottom;
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: padTop + plotH - (p.count / max) * plotH,
    point: p,
  }));
  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const total = points.reduce((s, p) => s + p.count, 0);

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Évolution hebdomadaire des nouveaux prospects, total ${total} sur la période`}>
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={padTop + plotH * t}
            y2={padTop + plotH * t}
            stroke="var(--line)"
            strokeWidth={1}
          />
        ))}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={4} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2}>
            <title>{`${c.point.label} : ${c.point.count} nouveau${c.point.count > 1 ? "x" : ""}`}</title>
          </circle>
        ))}
        {last && (
          <text x={Math.min(last.x, width - 24)} y={last.y - 10} textAnchor="end" className="fill-ink text-[10px] font-bold">
            {last.point.count}
          </text>
        )}
      </svg>
      <div className="flex justify-between text-[9.5px] text-faint">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <p className="text-[10.5px] text-faint">{total} prospect{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""} sur la période affichée.</p>
    </div>
  );
}

export function EmptyChartNote({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-line bg-soft px-3 py-2.5 text-[11.5px] text-faint")}>
      {children}
    </div>
  );
}
