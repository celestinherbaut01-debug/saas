"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMissionFromScenario } from "@/lib/actions/business-twin";
import type { GoalType, ScenarioKey } from "@/lib/business-twin/types";

/**
 * PLAN — étape explicite après la SIMULATION : choisir un scénario crée
 * réellement la mission (voir createMissionFromScenario). La cible
 * chiffrée et l'échéance restent optionnelles et modifiables ici — elles ne
 * sont JAMAIS déduites automatiquement d'un scénario (qui ne contient
 * aucun montant futur promis, voir lib/business-twin/scenarios.ts).
 */
export function ChooseScenarioForm({
  workspaceId,
  scenarioRunId,
  scenarioResultId,
  scenarioKey,
  goalType,
  goalLabel,
  targetUnit,
}: {
  workspaceId: string;
  scenarioRunId: string;
  scenarioResultId: string;
  scenarioKey: ScenarioKey;
  goalType: GoalType;
  goalLabel: string;
  targetUnit: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
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
        Choisir ce scénario
      </Button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-dashed border-line bg-bg p-3">
      {error && <p className="text-[11.5px] font-medium text-red-fg">{error}</p>}
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
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={confirm}>
          {pending && <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
          Créer la mission
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
