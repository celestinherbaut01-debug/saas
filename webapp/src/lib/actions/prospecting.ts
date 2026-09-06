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
  if (profileError) return { ok: false, error: profileError.message };

  const { error: deleteError } = await supabase.from("workspace_targets").delete().eq("workspace_id", workspaceId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (input.targetCategoryIds.length > 0) {
    const { error: insertError } = await supabase
      .from("workspace_targets")
      .insert(input.targetCategoryIds.map((category_id) => ({ workspace_id: workspaceId, category_id })));
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath("/prospection");
  return { ok: true };
}
