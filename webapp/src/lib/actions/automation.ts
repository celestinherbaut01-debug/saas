"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AutomationSettings } from "@/lib/session";

/**
 * Écrit les préférences de rappels/alertes d'un workspace — un upsert car
 * aucune ligne n'existe tant que l'utilisateur n'a jamais rien changé (voir
 * getCachedAutomationSettings, qui retourne des valeurs par défaut en
 * mémoire dans ce cas). Rappel : ceci ne fait qu'activer/désactiver ce que
 * les insights NOVA affichent — aucun envoi (SMS/email) n'est branché.
 */
export async function updateAutomationSettings(
  workspaceId: string,
  patch: Partial<AutomationSettings>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { error } = await supabase
    .from("automation_settings")
    .upsert({ workspace_id: workspaceId, ...patch }, { onConflict: "workspace_id" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/automatisations");
  revalidatePath("/business-os");
  return { ok: true };
}
