import { createClient } from "@/lib/supabase/server";
import { resolvePlanEntitlements, type Plan } from "@/lib/entitlements";

export type QuotaMetric = "nova_requests" | "prospects_added" | "searches";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentDayKey(): string {
  const now = new Date();
  return `${currentMonthKey()}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

const LIMIT_FIELD: Record<QuotaMetric, "novaMonthlyLimit" | "prospectMonthlyLimit" | "searchMonthlyLimit"> = {
  nova_requests: "novaMonthlyLimit",
  prospects_added: "prospectMonthlyLimit",
  searches: "searchMonthlyLimit",
};

const METRIC_LABEL: Record<QuotaMetric, string> = {
  nova_requests: "requêtes NOVA",
  prospects_added: "prospects ajoutés",
  searches: "recherches",
};

export interface QuotaStatus {
  metric: QuotaMetric;
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}

async function readCount(workspaceId: string, metric: QuotaMetric, periodKey: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("period_key", periodKey)
    .eq("metric", metric)
    .maybeSingle();
  return data?.count ?? 0;
}

/** Lecture seule : usage mensuel actuel de ce workspace pour une métrique. */
export async function getUsage(workspaceId: string, metric: QuotaMetric, plan: Plan): Promise<QuotaStatus> {
  const used = await readCount(workspaceId, metric, currentMonthKey());
  // resolvePlanEntitlements() plutôt qu'un ENTITLEMENTS[plan] direct : `plan`
  // est typé Plan, mais rien ne garantit à l'exécution que la valeur reçue
  // (souvent lue depuis subscriptions.plan) en est réellement une clé
  // valide — voir la panne "Cannot read properties of undefined
  // (reading 'novaMonthlyLimit')" que cette défense corrige.
  const limit = resolvePlanEntitlements(plan, `quota:${metric} workspace ${workspaceId}`)[LIMIT_FIELD[metric]];
  return { metric, used, limit, remaining: Math.max(0, limit - used), exceeded: used >= limit };
}

/**
 * Vérifie le quota MENSUEL avant une action coûteuse. Lève une erreur
 * explicite si dépassé — n'incrémente rien : appeler `incrementUsage`
 * séparément une fois l'action réellement réussie.
 */
export async function assertQuota(workspaceId: string, metric: QuotaMetric, plan: Plan): Promise<QuotaStatus> {
  const status = await getUsage(workspaceId, metric, plan);
  if (status.exceeded) {
    throw new Error(
      `Quota ${METRIC_LABEL[metric]} atteint pour ce mois (${status.used}/${status.limit}) — passez à un plan supérieur pour continuer.`,
    );
  }
  return status;
}

/** À appeler après le succès réel de l'action, jamais avant. */
export async function incrementUsage(workspaceId: string, metric: QuotaMetric, amount = 1): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_usage", {
    p_workspace_id: workspaceId,
    p_period_key: currentMonthKey(),
    p_metric: metric,
    p_amount: amount,
  });
}

export interface NovaQuotaStatus {
  monthly: QuotaStatus;
  daily: QuotaStatus | null; // null = pas de plafond journalier sur ce plan
}

/**
 * NOVA a un double plafond : mensuel (tous les plans) + journalier
 * (uniquement Free, pour éviter qu'un compte gratuit devienne un usage
 * illimité en osant lisser sur le mois). Les deux sont vérifiés ; le
 * message d'erreur précise lequel bloque.
 */
export async function assertNovaQuota(workspaceId: string, plan: Plan): Promise<NovaQuotaStatus> {
  const monthly = await assertQuota(workspaceId, "nova_requests", plan);

  const dailyLimit = resolvePlanEntitlements(plan, `quota:nova_requests:daily workspace ${workspaceId}`).novaDailyLimit;
  if (dailyLimit == null) return { monthly, daily: null };

  const used = await readCount(workspaceId, "nova_requests", currentDayKey());
  if (used >= dailyLimit) {
    throw new Error(
      `Quota requêtes NOVA atteint pour aujourd'hui (${used}/${dailyLimit}) — revenez demain ou passez à un plan supérieur.`,
    );
  }
  return {
    monthly,
    daily: { metric: "nova_requests", used, limit: dailyLimit, remaining: dailyLimit - used, exceeded: false },
  };
}

/** Incrémente à la fois le compteur mensuel et le compteur journalier NOVA. */
export async function incrementNovaUsage(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await Promise.all([
    supabase.rpc("increment_usage", {
      p_workspace_id: workspaceId,
      p_period_key: currentMonthKey(),
      p_metric: "nova_requests",
      p_amount: 1,
    }),
    supabase.rpc("increment_usage", {
      p_workspace_id: workspaceId,
      p_period_key: currentDayKey(),
      p_metric: "nova_requests",
      p_amount: 1,
    }),
  ]);
}
