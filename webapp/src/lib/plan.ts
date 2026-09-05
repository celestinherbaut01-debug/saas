import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { planAtLeast, type Plan } from "@/lib/entitlements";

export type { Plan };
export { planAtLeast };

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  acquisition_starter: "Acquisition Starter",
  acquisition_pro: "Acquisition Pro",
  business_os: "Business OS",
  business_os_advanced: "Business OS Advanced",
  complete: "Complete",
  complete_max: "Complete Max",
};

/**
 * Vérité serveur sur le plan d'un workspace. À utiliser dans toute Server
 * Action ou page sensible au plan — jamais en se fiant uniquement à un état
 * masqué côté client, qui ne protège rien.
 *
 * Mémorisé par requête (`cache()`, clé = workspaceId) : plusieurs pages
 * l'appellent (AppShell, la page elle-même, Business OS...) sans multiplier
 * les lectures de `subscriptions` — voir lib/session.ts pour la même
 * logique appliquée à l'utilisateur/l'appartenance au workspace.
 */
export const getWorkspacePlan = cache(async (workspaceId: string): Promise<Plan> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data || data.status === "canceled" || data.status === "past_due") return "free";
  return data.plan;
});

/** Lève une erreur explicite (jamais un contournement silencieux) si le plan est insuffisant. */
export async function requirePlan(workspaceId: string, min: Plan): Promise<void> {
  const plan = await getWorkspacePlan(workspaceId);
  if (!planAtLeast(plan, min)) {
    throw new Error(
      `Cette fonctionnalité nécessite le plan ${PLAN_LABEL[min]} ou supérieur (plan actuel : ${PLAN_LABEL[plan]}).`,
    );
  }
}
