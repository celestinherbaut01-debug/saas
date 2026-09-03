"use server";

import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { assertQuota, incrementUsage } from "@/lib/quota";
import { ENTITLEMENTS } from "@/lib/entitlements";

export interface SearchProspectsParams {
  lat: number;
  lng: number;
  radiusKm: number;
  nafCodes: string[];
  filters: Record<string, unknown>;
}

export interface SearchProspectsResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Passe par une Server Action (plutôt qu'un appel direct depuis le
 * navigateur) pour que le quota "recherches/mois" du plan soit vérifié
 * côté serveur avant de consommer l'edge function.
 */
export async function runProspectSearch(
  workspaceId: string,
  params: SearchProspectsParams,
): Promise<SearchProspectsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const plan = await getWorkspacePlan(workspaceId);

  const maxRadiusKm = ENTITLEMENTS[plan].maxRadiusKm;
  if (params.radiusKm > maxRadiusKm) {
    return {
      ok: false,
      error: `Rayon trop grand pour votre forfait ${ENTITLEMENTS[plan].label} (max ${maxRadiusKm} km). Passez à un forfait supérieur dans Paramètres.`,
    };
  }

  try {
    await assertQuota(workspaceId, "searches", plan);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Quota atteint." };
  }

  const { data, error } = await supabase.functions.invoke("search-prospects", { body: params });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };

  await incrementUsage(workspaceId, "searches");
  return { ok: true, data };
}
