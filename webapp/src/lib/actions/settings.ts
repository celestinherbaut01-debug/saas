"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidPlan } from "@/lib/entitlements";

export interface SettingsActionState {
  error: string | null;
  ok?: boolean;
}

/**
 * Change le plan d'un workspace SANS Stripe — uniquement pour tester
 * l'application des quotas/fonctionnalités en développement. Bloqué en
 * production : le seul chemin légitime pour changer de plan en prod sera
 * Stripe Checkout/Billing Portal (pas encore branché, voir README).
 */
export async function setDevPlan(workspaceId: string, plan: string): Promise<SettingsActionState> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Changement de plan manuel désactivé en production — Stripe n'est pas encore branché." };
  }
  if (!isValidPlan(plan)) return { error: "Plan invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { error } = await supabase
    .from("subscriptions")
    .update({ plan, status: "active" })
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

export async function updateBusinessProfile(
  workspaceId: string,
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { error } = await supabase
    .from("business_profiles")
    .update({
      company_name: String(formData.get("company_name") || ""),
      website: String(formData.get("website") || "") || null,
      offer_description: String(formData.get("offer_description") || ""),
    })
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/parametres");
  return { error: null, ok: true };
}
