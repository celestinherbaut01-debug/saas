import { createClient } from "@/lib/supabase/server";
import { getEntitlements, type Plan } from "@/lib/entitlements";

export type QuotaMetric = "nova_requests" | "prospects_added" | "searches";

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

const LIMIT_FIELD: Record<QuotaMetric, "novaMonthlyLimit" | "prospectMonthlyLimit" | "searchMonthlyLimit"> = {
  nova_requests: "novaMonthlyLimit",
  prospects_added: "prospectMonthlyLimit",
  searches: "searchMonthlyLimit",
};

export interface QuotaStatus {
  metric: QuotaMetric;
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}

/** Lecture seule : usage actuel de ce workspace pour une métrique, ce mois-ci. */
export async function getUsage(workspaceId: string, metric: QuotaMetric, plan: Plan): Promise<QuotaStatus> {
  const supabase = await createClient();
  const periodKey = currentPeriodKey();
  const { data } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("period_key", periodKey)
    .eq("metric", metric)
    .maybeSingle();

  const used = data?.count ?? 0;
  const limit = getEntitlements(plan)[LIMIT_FIELD[metric]];
  return { metric, used, limit, remaining: Math.max(0, limit - used), exceeded: used >= limit };
}

/**
 * Vérifie le quota AVANT une action coûteuse (appel NOVA, recherche...).
 * Lève une erreur explicite si dépassé — n'incrémente rien : à appeler
 * `incrementUsage` séparément une fois l'action réellement réussie, pour ne
 * jamais compter un appel qui a échoué.
 */
export async function assertQuota(workspaceId: string, metric: QuotaMetric, plan: Plan): Promise<QuotaStatus> {
  const status = await getUsage(workspaceId, metric, plan);
  if (status.exceeded) {
    const label = { nova_requests: "requêtes NOVA", prospects_added: "prospects ajoutés", searches: "recherches" }[
      metric
    ];
    throw new Error(
      `Quota ${label} atteint pour ce mois (${status.used}/${status.limit}) — passez à un plan supérieur pour continuer.`,
    );
  }
  return status;
}

/** À appeler après le succès réel de l'action, jamais avant. */
export async function incrementUsage(workspaceId: string, metric: QuotaMetric, amount = 1): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_usage", {
    p_workspace_id: workspaceId,
    p_period_key: currentPeriodKey(),
    p_metric: metric,
    p_amount: amount,
  });
}
