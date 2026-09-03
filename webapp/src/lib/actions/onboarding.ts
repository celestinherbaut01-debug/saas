"use server";

import { redirect } from "next/navigation";
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
  radiusKm: number;
  targetCategoryIds: string[];
}

export interface OnboardingResult {
  error: string | null;
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
  if (payload.targetCategoryIds.length === 0) {
    return { error: "Sélectionnez au moins un métier à démarcher." };
  }

  // Une seule fonction atomique côté serveur (auth.uid() y est lu en interne,
  // jamais transmis) : soit tout est créé (workspace, membre, profil
  // entreprise, cibles), soit rien ne l'est — plus de workspace orphelin
  // possible en cas d'échec à mi-chemin. Voir 0009_onboarding_rpc.sql.
  const { error } = await supabase.rpc("complete_onboarding", {
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
    p_radius_km: payload.radiusKm,
    p_target_category_ids: payload.targetCategoryIds,
  });

  if (error) {
    // "relation ... does not exist" (code Postgres 42P01) = une migration
    // n'a pas été appliquée sur ce projet Supabase — jamais un message
    // technique brut affiché à l'utilisateur. L'erreur réelle reste dans
    // les logs serveur pour le diagnostic.
    console.error("complete_onboarding RPC error:", error);
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return {
        error:
          "Configuration serveur incomplète — certaines migrations Supabase ne semblent pas appliquées. Contactez le support.",
      };
    }
    return { error: error.message };
  }

  redirect("/dashboard");
}
