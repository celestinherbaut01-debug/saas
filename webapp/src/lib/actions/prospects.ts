"use server";

import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { assertQuota, incrementUsage } from "@/lib/quota";
import type { Database } from "@/lib/supabase/types";

type ProspectInsert = Database["public"]["Tables"]["prospects"]["Insert"];

export interface AddProspectsResult {
  ok: boolean;
  error?: string;
  addedCount?: number;
}

/**
 * Ajoute des prospects au CRM depuis les résultats de recherche. Passe par
 * une Server Action (plutôt qu'un upsert direct côté client) pour que le
 * quota "prospects/mois" du plan soit réellement appliqué côté serveur —
 * masquer le bouton côté client ne protège rien.
 */
export async function addProspectsToCrm(
  workspaceId: string,
  rows: ProspectInsert[],
): Promise<AddProspectsResult> {
  if (rows.length === 0) return { ok: true, addedCount: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const plan = await getWorkspacePlan(workspaceId);
  try {
    await assertQuota(workspaceId, "prospects_added", plan);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Quota atteint." };
  }

  const { data: inserted, error } = await supabase
    .from("prospects")
    .upsert(
      rows.map((r) => ({ ...r, workspace_id: workspaceId })),
      { onConflict: "workspace_id,siret" },
    )
    .select("id");

  if (error) return { ok: false, error: error.message };

  if (inserted?.length) {
    await supabase.from("activities").insert(
      inserted.map((p) => ({
        workspace_id: workspaceId,
        prospect_id: p.id,
        type: "added_to_crm" as const,
        detail: "Depuis la Prospection",
      })),
    );
    await incrementUsage(workspaceId, "prospects_added", inserted.length);
  }

  return { ok: true, addedCount: inserted?.length ?? 0 };
}
