import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ChooseScenarioForm } from "@/components/business-twin/choose-scenario-form";
import { goalTemplate } from "@/lib/business-twin/goals";
import type { Confidence, Effort } from "@/lib/business-twin/types";

const CONFIDENCE_LABEL: Record<Confidence, { text: string; tone: BadgeTone }> = {
  elevee: { text: "Confiance élevée", tone: "success" },
  moyenne: { text: "Confiance moyenne", tone: "warning" },
  faible: { text: "Confiance faible", tone: "danger" },
};

const EFFORT_LABEL: Record<Effort, string> = {
  faible: "Effort faible",
  moyen: "Effort moyen",
  eleve: "Effort élevé",
};

const ASSUMPTION_LABEL: Record<string, { text: string; tone: BadgeTone }> = {
  real: { text: "Réel", tone: "success" },
  estimated: { text: "Estimation", tone: "accent" },
  hypothesis: { text: "Hypothèse", tone: "warning" },
  missing: { text: "Donnée manquante", tone: "neutral" },
};

const SIGNAL_CATEGORY_LABEL: Record<string, string> = {
  sales: "Ventes",
  capacity: "Capacité",
  finance: "Finance",
  inventory: "Stock",
  customers: "Clients",
  acquisition: "Acquisition",
  marketing: "Marketing",
};

export default async function SimulatePage({ params }: PageProps<"/missions/simulate/[scenarioRunId]">) {
  const { scenarioRunId } = await params;
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const supabase = await createClient();
  const { data: run } = await supabase
    .from("scenario_runs")
    .select("id, goal_type, prompt, mission_id, applied")
    .eq("id", scenarioRunId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!run) notFound();

  // `mission_id` est déjà rempli pour un run d'AJUSTEMENT dès sa création
  // (voir runAdjustmentSimulation) — seul `applied` dit si un scénario de ce
  // run a déjà été choisi ; sinon on affiche la comparaison normalement.
  if (run.applied && run.mission_id) redirect(`/missions/${run.mission_id}`);

  const { data: results } = await supabase
    .from("scenario_results")
    .select("*")
    .eq("scenario_run_id", scenarioRunId)
    .order("created_at");
  const resultIds = (results ?? []).map((r) => r.id);
  const { data: assumptions } =
    resultIds.length > 0 ? await supabase.from("scenario_assumptions").select("*").in("scenario_result_id", resultIds) : { data: [] };

  const template = goalTemplate(run.goal_type);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {template.icon} {run.prompt}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {run.mission_id
              ? "Ajustement de mission — nouveau snapshot recalculé à partir de vos données actuelles. Choisissez un scénario pour ajouter des actions au plan existant."
              : "ProspectFlow compare plusieurs approches à partir de vos vraies données — aucun résultat futur n'est garanti, voir la confiance et les hypothèses de chaque scénario."}
          </p>
          {run.mission_id && (
            <Link href={`/missions/${run.mission_id}`} className="mt-1 inline-block text-[12px] font-semibold text-accent">
              ← Retour à la mission
            </Link>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {(results ?? []).map((r) => {
            const scenarioAssumptions = (assumptions ?? []).filter((a) => a.scenario_result_id === r.id);
            const planPreview = r.plan_preview as { label: string; count: number | null }[];
            return (
              <Card key={r.id} className={r.is_recommended ? "border-accent/40" : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-[14px] font-extrabold">{r.label}</h2>
                  {r.is_recommended && <Badge tone="accent">Recommandé</Badge>}
                </div>
                <p className="mt-1.5 text-[12.5px] text-muted">{r.description}</p>

                {r.is_repeat && r.first_seen_at && (
                  <p className="mt-2 rounded-lg bg-soft px-2.5 py-1.5 text-[11px] font-medium text-muted">
                    ↻ Cette recommandation reste valable depuis le {new Date(r.first_seen_at).toLocaleDateString("fr-FR")} — rien n&apos;a
                    changé dans vos données depuis.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.signal_category && <Badge tone="dark">{SIGNAL_CATEGORY_LABEL[r.signal_category] ?? r.signal_category}</Badge>}
                  <Badge tone={CONFIDENCE_LABEL[r.confidence].tone}>{CONFIDENCE_LABEL[r.confidence].text}</Badge>
                  <Badge tone="neutral">{EFFORT_LABEL[r.effort]}</Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-faint">{r.confidence_explanation}</p>

                <p className="mt-3 text-[12.5px] text-ink">{r.qualitative_impact}</p>

                {planPreview.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-[12px] text-muted">
                    {planPreview.map((p, i) => (
                      <li key={i}>
                        • {p.label}
                        {p.count != null ? ` (${p.count})` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {scenarioAssumptions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">D&apos;où viennent ces chiffres</p>
                    {scenarioAssumptions.map((a) => (
                      <div key={a.id} className="flex items-start gap-1.5 text-[11.5px] text-muted">
                        <Badge tone={ASSUMPTION_LABEL[a.kind]?.tone ?? "neutral"} className="mt-0.5 shrink-0">
                          {ASSUMPTION_LABEL[a.kind]?.text ?? a.kind}
                        </Badge>
                        <span>
                          <span className="font-semibold text-ink">{a.label}</span> — {a.explanation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {r.key !== "do_nothing" && (
                  <div className="mt-3">
                    <ChooseScenarioForm
                      workspaceId={workspaceId}
                      scenarioRunId={run.id}
                      scenarioResultId={r.id}
                      scenarioKey={r.key}
                      lever={r.lever ?? "do_nothing"}
                      goalType={run.goal_type}
                      goalLabel={run.prompt}
                      targetUnit={template.targetUnit}
                      missionId={run.mission_id ?? undefined}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <p className="text-[11px] text-faint">
          ProspectFlow construit et pilote un plan pour vous aider à atteindre votre objectif — il ne peut jamais
          garantir de l&apos;atteindre.
        </p>
      </div>
    </AppShell>
  );
}
