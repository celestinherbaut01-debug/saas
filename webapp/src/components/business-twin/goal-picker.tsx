"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { runSimulation, type BusinessTwinStatus } from "@/lib/actions/business-twin";
import { GOAL_CATALOG, classifyGoalText } from "@/lib/business-twin/goals";
import type { GoalType } from "@/lib/business-twin/types";

/**
 * Le bloc central de Business Twin : "Quel résultat voulez-vous obtenir ?"
 * — pensé pour être l'élément le plus visible du dashboard (voir point 8 de
 * la refonte), pas une fonctionnalité cachée. Un clic lance une SIMULATION
 * (runSimulation) puis redirige vers la comparaison de scénarios ; aucune
 * mission n'est créée à ce stade — voir /missions/simulate/[id].
 */
export function GoalPicker({ workspaceId, status }: { workspaceId: string; status: BusinessTwinStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const presets = GOAL_CATALOG.filter((g) => g.type !== "custom");
  const quotaLeft = Math.max(0, status.scenarioRunsLimit - status.scenarioRunsUsed);

  function launch(goalType: GoalType, goalLabel: string) {
    setError(null);
    setPendingType(goalType);
    startTransition(async () => {
      const outcome = await runSimulation(workspaceId, { goalType, goalLabel });
      setPendingType(null);
      if ("error" in outcome) {
        setError(outcome.error);
        return;
      }
      router.push(`/missions/simulate/${outcome.result.scenarioRunId}`);
    });
  }

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-panel to-soft">
      <h2 className="font-display text-[17px] font-extrabold text-ink">Quel résultat voulez-vous obtenir ?</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        ProspectFlow analyse vos vraies données, compare plusieurs façons d&apos;y arriver, et prépare un plan concret —
        jamais une promesse de résultat garanti.
      </p>

      {error && <p className="mt-2 text-[12px] font-medium text-red-fg">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {presets.map((g) => (
          <button
            key={g.type}
            type="button"
            disabled={pending}
            onClick={() => launch(g.type, g.buttonLabel)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-line bg-bg px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60",
            )}
          >
            {pendingType === g.type ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : g.icon}
            {g.buttonLabel}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowCustom((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-line bg-bg px-3.5 py-2 text-[12.5px] font-semibold text-muted hover:opacity-90"
        >
          ✏️ Autre objectif
        </button>
      </div>

      {showCustom && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Décrivez votre objectif (ex. Signer 5 contrats avant le 31 octobre)"
            className="max-w-md"
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || customText.trim().length === 0}
            onClick={() => launch(classifyGoalText(customText), customText.trim())}
          >
            Lancer la simulation
          </Button>
        </div>
      )}

      <p className="mt-3 text-[10.5px] text-faint">
        {status.maxActiveMissions === 0
          ? `Plan actuel : simulation d'essai uniquement (${quotaLeft}/${status.scenarioRunsLimit} restante(s) ce mois-ci) — aucune mission enregistrée. Passez à un plan payant pour créer une vraie mission suivie.`
          : `${status.activeMissionsCount}/${status.maxActiveMissions} mission(s) active(s) — ${quotaLeft}/${status.scenarioRunsLimit} simulation(s) restante(s) ce mois-ci.`}
      </p>
    </Card>
  );
}
