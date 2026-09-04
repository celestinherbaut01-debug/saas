"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setDevPlan } from "@/lib/actions/settings";
import { ENTITLEMENTS, PLAN_ORDER, type Plan } from "@/lib/entitlements";

/**
 * Change réellement workspaces/subscriptions.plan en base, sans Stripe —
 * dev uniquement (setDevPlan refuse en production). Voir lib/actions/settings.ts
 * pour le bug corrigé (RLS bloquait silencieusement l'écriture) et pourquoi
 * ça passe désormais par le service role.
 */
export function DevPlanSwitcher({ workspaceId, currentPlan }: { workspaceId: string; currentPlan: Plan }) {
  const [pending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function choose(plan: Plan) {
    if (plan === currentPlan || pending) return;
    setPendingPlan(plan);
    setToast(null);
    startTransition(async () => {
      const result = await setDevPlan(workspaceId, plan);
      setPendingPlan(null);
      if (result.error) {
        setToast({ kind: "err", text: result.error });
      } else {
        // La sidebar, les quotas, le rayon max et Business OS se
        // rafraîchissent seuls : setDevPlan appelle revalidatePath sur les
        // routes concernées + le layout, donc ce composant n'a rien de plus
        // à faire pour que le reste de l'app reflète le nouveau plan.
        setToast({ kind: "ok", text: `Plan changé vers ${ENTITLEMENTS[plan].label}.` });
      }
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-line bg-soft p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        Dev uniquement — désactivé en production
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Change réellement le plan en base (sans Stripe), pour vérifier que quotas, rayon max et Business OS
        s&apos;appliquent correctement à chaque forfait.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLAN_ORDER.map((planId) => (
          <Button
            key={planId}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || planId === currentPlan}
            onClick={() => choose(planId)}
            className="flex items-center gap-1.5"
          >
            {pending && pendingPlan === planId && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            )}
            {ENTITLEMENTS[planId].label}
            {planId === currentPlan && " (actuel)"}
          </Button>
        ))}
      </div>
      {toast && (
        <p
          role="status"
          className={`mt-2 rounded-md px-2.5 py-1.5 text-[12px] ${
            toast.kind === "ok" ? "bg-green-bg text-green-fg" : "bg-red-bg text-red-fg"
          }`}
        >
          {toast.text}
        </p>
      )}
    </div>
  );
}
