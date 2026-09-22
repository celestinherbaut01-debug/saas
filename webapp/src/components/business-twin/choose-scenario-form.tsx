"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMissionFromScenario, addScenarioToMission } from "@/lib/actions/business-twin";
import type { GoalType, ScenarioKey } from "@/lib/business-twin/types";

/**
 * PLAN — étape explicite après la SIMULATION. Deux modes :
 * - Nouvelle mission (missionId absent) : choisir un scénario crée
 *   réellement la mission (createMissionFromScenario), avec cible chiffrée
 *   et échéance optionnelles.
 * - AJUSTEMENT (missionId présent) : le scénario vient d'un run relancé
 *   depuis une mission existante (voir runAdjustmentSimulation) — choisir
 *   ajoute de nouvelles actions à la mission (addScenarioToMission), sans
 *   toucher à sa cible/échéance déjà définies.
 * Dans les deux cas, aucun montant futur n'est déduit automatiquement d'un
 * scénario (qui n'en contient aucun, voir lib/business-twin/scenarios.ts).
 */
export function ChooseScenarioForm({
  workspaceId,
  scenarioRunId,
  scenarioResultId,
  scenarioKey,
  goalType,
  goalLabel,
  targetUnit,
  missionId,
}: {
  workspaceId: string;
  scenarioRunId: string;
  scenarioResultId: string;
  scenarioKey: ScenarioKey;
  goalType: GoalType;
  goalLabel: string;
  targetUnit: string | null;
  /** Présent uniquement pour un run d'AJUSTEMENT sur une mission déjà existante. */
  missionId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAdjustment = Boolean(missionId);

  function confirm() {
    setError(null);
    startTransition(async () => {
      if (missionId) {
        const result = await addScenarioToMission(workspaceId, { missionId, scenarioRunId, scenarioResultId, scenarioKey });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        router.push(`/missions/${missionId}`);
        return;
      }

      const result = await createMissionFromScenario(workspaceId, {
        scenarioRunId,
        scenarioResultId,
        scenarioKey,
        goalType,
        goalLabel,
        goalTargetValue: targetValue.trim() ? Number(targetValue) : null,
        goalTargetUnit: targetUnit,
        deadline: deadline || null,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/missions/${result.missionId}`);
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {isAdjustment ? "Ajouter ce plan à la mission" : "Choisir ce scénario"}
      </Button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-dashed border-line bg-bg p-3">
      {error && <p className="text-[11.5px] font-medium text-red-fg">{error}</p>}

      {!isAdjustment && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`target-${scenarioResultId}`}>Cible chiffrée (optionnel){targetUnit ? ` — ${targetUnit}` : ""}</Label>
            <Input id={`target-${scenarioResultId}`} type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="ex. 5000" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`deadline-${scenarioResultId}`}>Échéance (optionnel)</Label>
            <Input id={`deadline-${scenarioResultId}`} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={confirm}>
          {pending && <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
          {isAdjustment ? "Ajouter à la mission" : "Créer la mission"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
