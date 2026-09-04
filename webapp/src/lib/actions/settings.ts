"use server";

import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidPlan } from "@/lib/entitlements";
import type { Database } from "@/lib/supabase/types";

export interface SettingsActionState {
  error: string | null;
  ok?: boolean;
}

/**
 * Change le plan d'un workspace SANS Stripe — uniquement pour tester
 * l'application des quotas/fonctionnalités en développement. Bloqué en
 * production : le seul chemin légitime pour changer de plan en prod sera
 * Stripe Checkout/Billing Portal (pas encore branché, voir README).
 *
 * Bug corrigé : `public.subscriptions` n'a AUCUNE policy RLS d'écriture
 * cliente (voir 0005_subscriptions.sql — volontaire, seul un futur webhook
 * Stripe doit écrire ici). Un .update() avec le client normal ne touchait
 * donc silencieusement AUCUNE ligne : Postgres ne lève pas d'erreur quand
 * RLS exclut une ligne d'un UPDATE, il traite juste ça comme "0 ligne
 * concernée" — l'action renvoyait `{ok:true}` sans que le plan ait changé
 * en base. On utilise donc ici le service role (qui contourne RLS),
 * exclusivement après le contrôle NODE_ENV ci-dessus ET une vérification
 * explicite d'appartenance au workspace (le service role, lui, ignore RLS :
 * l'autorisation doit être vérifiée avant de l'utiliser, pas déléguée à lui).
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

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Vous n'êtes pas membre de ce workspace." };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY manquant dans webapp/.env.local — nécessaire en dev pour écrire dans subscriptions (aucune policy d'écriture cliente n'y existe volontairement). Ajoutez-la (Supabase → Project Settings → API → service_role) puis relancez npm run dev.",
    };
  }
  const admin = createServiceRoleClient<Database>(supabaseUrl, serviceRoleKey);

  const { data: updated, error } = await admin
    .from("subscriptions")
    .upsert({ workspace_id: workspaceId, plan, status: "active" }, { onConflict: "workspace_id" })
    .select("plan")
    .maybeSingle();

  if (error) return { error: `Échec de la mise à jour du plan : ${error.message}` };
  // Jamais de faux succès : on relit ce qui a réellement été écrit plutôt
  // que de supposer que l'absence d'erreur veut dire que ça a marché.
  if (!updated || updated.plan !== plan) {
    return {
      error: `Écriture acceptée mais le plan relu en base ("${updated?.plan ?? "aucune ligne"}") ne correspond pas à "${plan}".`,
    };
  }

  revalidatePath("/parametres");
  revalidatePath("/abonnement");
  revalidatePath("/dashboard");
  revalidatePath("/prospection");
  revalidatePath("/business-os");
  revalidatePath("/analytics");
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

/**
 * Enregistre l'offre + le type de clientèle depuis la page Prospection
 * elle-même (section "Votre offre" / "Type de clientèle") — mêmes colonnes
 * que Paramètres, réutilisées pour que scoring/recommandations/NOVA restent
 * cohérents partout plutôt que de dupliquer ces champs.
 */
export async function updateOfferAudience(
  workspaceId: string,
  offerDescription: string,
  audience: "b2b" | "b2c" | "both",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { error } = await supabase
    .from("business_profiles")
    .update({ offer_description: offerDescription.trim(), audience })
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/prospection");
  revalidatePath("/parametres");
  return { ok: true };
}
