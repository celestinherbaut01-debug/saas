"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProspectionFilters } from "@/lib/prospecting-config";

export interface ProspectingConfigInput {
  offerDescription: string;
  audience: "b2b" | "b2c" | "both";
  street: string;
  postalCode: string;
  city: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  targetCategoryIds: string[];
  filters: ProspectionFilters;
}

/**
 * Sauvegarde COMPLÈTE de la configuration Prospection (offre, audience,
 * adresse, rayon, métiers ciblés, filtres) en un seul appel — jamais
 * dépendant d'un bouton "Enregistrer" par section. Appelée automatiquement
 * (debounce) par ProspectionView à chaque changement, pour que revenir sur
 * la page après être passé par une autre (ex. /abonnement) retrouve
 * exactement l'état laissé — voir prospection/page.tsx pour le rechargement
 * au retour.
 *
 * Écrit dans business_profiles (une ligne par workspace, déjà la source de
 * vérité pour offer/audience/adresse/rayon — pas de nouvelle table qui
 * dupliquerait ces colonnes) et remplace entièrement workspace_targets pour
 * ce workspace (delete + insert, pas un simple upsert additif : décocher un
 * métier doit réellement le retirer).
 */
export async function saveProspectingConfig(
  workspaceId: string,
  input: ProspectingConfigInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  // "Échec de l'enregistrement" sans détail (bug rapporté) : le message
  // Postgrest réel était déjà renvoyé par cette fonction, mais jeté par
  // l'appelant (voir ProspectionWizard, saveStatus ne gardait qu'un booléen
  // "error"). Corrigé ici ET côté appelant — et loggé serveur dans tous les
  // cas (code/message/détails/hint, jamais de clé/secret) pour diagnostiquer
  // même quand l'UI du client n'est pas sous les yeux.
  const { error: profileError } = await supabase
    .from("business_profiles")
    .update({
      offer_description: input.offerDescription.trim(),
      audience: input.audience,
      street: input.street,
      postal_code: input.postalCode,
      city: input.city,
      lat: input.lat,
      lng: input.lng,
      default_radius_km: input.radiusKm,
      // ProspectionFilters est une interface concrète (pas d'index signature) —
      // TS refuse l'assignation structurelle directe à Record<string, unknown>
      // même si la forme est compatible ; jsonb accepte n'importe quel objet
      // sérialisable, d'où ce cast explicite plutôt qu'affaiblir le type.
      search_filters: input.filters as unknown as Record<string, unknown>,
    })
    .eq("workspace_id", workspaceId);
  if (profileError) {
    console.error("[saveProspectingConfig] échec UPDATE business_profiles", {
      workspaceId,
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });
    return { ok: false, error: `Échec de l'enregistrement (profil) : ${profileError.message}` };
  }

  const { error: deleteError } = await supabase.from("workspace_targets").delete().eq("workspace_id", workspaceId);
  if (deleteError) {
    console.error("[saveProspectingConfig] échec DELETE workspace_targets", {
      workspaceId,
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });
    return { ok: false, error: `Échec de l'enregistrement (cibles) : ${deleteError.message}` };
  }

  if (input.targetCategoryIds.length > 0) {
    const { error: insertError } = await supabase
      .from("workspace_targets")
      .insert(input.targetCategoryIds.map((category_id) => ({ workspace_id: workspaceId, category_id })));
    if (insertError) {
      console.error("[saveProspectingConfig] échec INSERT workspace_targets", {
        workspaceId,
        targetCategoryIds: input.targetCategoryIds,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      return { ok: false, error: `Échec de l'enregistrement (cibles) : ${insertError.message}` };
    }
  }

  revalidatePath("/prospection");
  return { ok: true };
}
