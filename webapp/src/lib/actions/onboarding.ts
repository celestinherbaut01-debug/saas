"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingPayload {
  companyName: string;
  website: string;
  offerDescription: string;
  audience: "b2b" | "b2c" | "both";
  ownCategoryId: string | null;
  address: {
    street: string;
    postalCode: string;
    city: string;
    lat: number;
    lng: number;
  } | null;
  targetCategoryIds: string[];
  /** "Que souhaitez-vous faire avec ProspectFlow ?" — pilote la navigation, jamais un droit facturé. */
  productMode: "acquisition" | "business_os" | "both";
}

export interface OnboardingResult {
  error: string | null;
  /** Détail technique réel (jamais inventé) — présent uniquement hors production. */
  devDetail?: string;
  ok?: boolean;
  workspaceId?: string;
}

const GENERIC_ERROR =
  "Impossible de finaliser votre compte pour le moment. Votre configuration n'a pas été perdue. Réessayez ou contactez le support.";

function serverError(realMessage: string): OnboardingResult {
  return {
    error: GENERIC_ERROR,
    devDetail: process.env.NODE_ENV !== "production" ? realMessage : undefined,
  };
}

export async function completeOnboarding(
  payload: OnboardingPayload,
): Promise<OnboardingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Session expirée — reconnectez-vous." };
  if (!payload.companyName.trim()) return { error: "Le nom de l'entreprise est requis." };
  if (!payload.address) return { error: "Adresse de départ manquante — validez une adresse." };
  // Cibles obligatoires SAUF si le client a explicitement dit ne pas vouloir
  // prospecter ("Gérer mon entreprise" uniquement) — voir 0022.
  if (payload.productMode !== "business_os" && payload.targetCategoryIds.length === 0) {
    return { error: "Sélectionnez au moins un métier à démarcher." };
  }

  // Diagnostic temporaire (visible dans le terminal `npm run dev`, pas dans
  // le navigateur) : confirme l'état avant/après pour trouver précisément
  // où ça coince si le bug persiste. `error` est toujours logué séparément
  // — jamais transformé silencieusement en `undefined`.
  const { data: before, error: beforeError } = await supabase
    .from("profiles")
    .select("id, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();
  console.log("[profile] user.id =", user.id);
  console.log("[profile] found =", before !== null);
  console.log("[profile] error =", beforeError ? beforeError.message : null);
  console.log("[profile] onboarding_completed BEFORE =", before?.onboarding_completed ?? "(pas de ligne)");

  // Une seule fonction atomique côté serveur (auth.uid() y est lu en interne,
  // jamais transmis) : soit tout est créé (workspace, membre, profil
  // entreprise, cibles), soit rien ne l'est — plus de workspace orphelin
  // possible en cas d'échec à mi-chemin. Voir 0009_onboarding_rpc.sql / 0011.
  const { data: workspaceId, error } = await supabase.rpc("complete_onboarding", {
    p_company_name: payload.companyName.trim(),
    p_website: payload.website.trim() || null,
    p_offer_description: payload.offerDescription.trim(),
    p_audience: payload.audience,
    p_own_category_id: payload.ownCategoryId,
    p_street: payload.address.street,
    p_postal_code: payload.address.postalCode,
    p_city: payload.address.city,
    p_lat: payload.address.lat,
    p_lng: payload.address.lng,
    p_target_category_ids: payload.targetCategoryIds,
    // Rayon volontairement absent : n'est plus choisi à l'onboarding, mais
    // sur la page Prospection (dépend du forfait) — voir 0014.
    p_product_mode: payload.productMode,
  });

  if (error) {
    console.error("[onboarding] complete_onboarding RPC error:", error);
    // Jamais de message Postgres brut affiché à l'utilisateur. L'erreur
    // réelle reste dans les logs serveur + en devDetail (dev uniquement).
    return serverError(`RPC complete_onboarding: ${error.message} (code: ${error.code ?? "?"})`);
  }

  const { data: workspaceCheck } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  console.log("[onboarding] workspace_id =", workspaceId, "| workspace_members found =", workspaceCheck !== null);

  const { data: after, error: afterError } = await supabase
    .from("profiles")
    .select("id, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();
  console.log("[profile] error (after) =", afterError ? afterError.message : null);
  console.log("[profile] onboarding_completed AFTER =", after?.onboarding_completed ?? "(pas de ligne)");

  if (!after || after.onboarding_completed !== true) {
    console.error("[onboarding] ÉCHEC : onboarding_completed n'est pas true après complete_onboarding — arrêt, pas de faux succès.");
    return serverError(
      `profiles.onboarding_completed n'est pas passé à true après le RPC (found=${after !== null}, error=${afterError?.message ?? "none"})`,
    );
  }

  // Revalide le cache Next.js pour /dashboard et /onboarding : sans ça, un
  // rendu de /dashboard mis en cache AVANT la fin de l'onboarding pourrait
  // être resservi tel quel juste après, au lieu de refléter le nouvel état.
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  revalidatePath("/", "layout");

  // Pas de redirect() ici : appelé via startTransition() (pas un <form
  // action=...>), donc pas de <form> pour porter une redirection serveur
  // fiable. On renvoie un statut de succès ; c'est le composant client qui
  // déclenche une VRAIE navigation complète (window.location.href) vers
  // /dashboard — garantit que proxy.ts s'exécute contre une requête neuve,
  // sans dépendre du cache de routage client de Next.js.
  return { error: null, ok: true, workspaceId: workspaceId ?? undefined };
}
