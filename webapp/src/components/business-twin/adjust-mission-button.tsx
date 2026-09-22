"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runAdjustmentSimulation } from "@/lib/actions/business-twin";

/**
 * AJUSTEMENT — relance une simulation sur une mission existante (nouveau
 * snapshot + nouveaux scénarios à partir des données actuelles). Ne change
 * rien tant que l'utilisateur n'a pas choisi un scénario sur la page de
 * comparaison qui suit (voir /missions/simulate/[scenarioRunId]).
 */
export function AdjustMissionButton({ workspaceId, missionId }: { workspaceId: string; missionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function adjust() {
    setError(null);
    startTransition(async () => {
      const outcome = await runAdjustmentSimulation(workspaceId, missionId);
      if ("error" in outcome) {
        setError(outcome.error);
        return;
      }
      router.push(`/missions/simulate/${outcome.result.scenarioRunId}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={adjust}>
        {pending && <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
        Ajuster le plan
      </Button>
      {error && <p className="text-[11px] font-medium text-red-fg">{error}</p>}
    </div>
  );
}
