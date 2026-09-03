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

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name: payload.companyName.trim(), created_by: user.id })
    .select("id")
    .single();

  if (wsError || !workspace) {
    return { error: wsError?.message ?? "Impossible de créer le workspace." };
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  if (memberError) return { error: memberError.message };

  const { error: profileError } = await supabase.from("business_profiles").insert({
    workspace_id: workspace.id,
    company_name: payload.companyName.trim(),
    website: payload.website.trim() || null,
    offer_description: payload.offerDescription.trim(),
    audience: payload.audience,
    own_category_id: payload.ownCategoryId,
    street: payload.address.street,
    postal_code: payload.address.postalCode,
    city: payload.address.city,
    lat: payload.address.lat,
    lng: payload.address.lng,
    default_radius_km: payload.radiusKm,
  });

  if (profileError) return { error: profileError.message };

  const { error: targetsError } = await supabase.from("workspace_targets").insert(
    payload.targetCategoryIds.map((category_id) => ({
      workspace_id: workspace.id,
      category_id,
    })),
  );

  if (targetsError) return { error: targetsError.message };

  const { error: onboardError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (onboardError) return { error: onboardError.message };

  await supabase.rpc("award_xp", {
    p_workspace_id: workspace.id,
    p_action: "onboarding_completed",
    p_amount: 50,
    p_dedupe: true,
  });

  redirect("/dashboard");
}
