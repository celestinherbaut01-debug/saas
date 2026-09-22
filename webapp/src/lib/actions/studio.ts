"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateStudioContent } from "@/lib/studio/generator";
import { DEFAULT_BRAND_KIT, parseStudioInput, type BrandKit, type GeneratedContent, type OfferType, type StudioInput, type StudioStatus, type StudioVertical } from "@/lib/studio/types";

function toBrandKit(row: { tone: string; primary_color: string; accent_color: string; tagline: string | null } | null): BrandKit {
  if (!row) return DEFAULT_BRAND_KIT;
  return {
    tone: (["professionnel", "chaleureux", "dynamique", "premium"].includes(row.tone) ? row.tone : "professionnel") as BrandKit["tone"],
    primaryColor: row.primary_color || DEFAULT_BRAND_KIT.primaryColor,
    accentColor: row.accent_color || DEFAULT_BRAND_KIT.accentColor,
    tagline: row.tagline,
  };
}

export async function saveBrandKit(workspaceId: string, kit: BrandKit): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { error } = await supabase.from("brand_kits").upsert({
    workspace_id: workspaceId,
    tone: kit.tone,
    primary_color: kit.primaryColor,
    accent_color: kit.accentColor,
    tagline: kit.tagline?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/parametres");
  return { ok: true };
}

export interface CreateStudioCreationInput {
  vertical: StudioVertical;
  offerType: OfferType;
  input: StudioInput;
  sourceMissionId?: string | null;
}

/**
 * Génère ET persiste une création en un seul appel — récupère nom/ville de
 * l'entreprise et le Brand Kit (déjà en base, jamais redemandés à
 * l'utilisateur) pour que generateStudioContent compose le contenu.
 */
export async function createStudioCreation(
  workspaceId: string,
  params: CreateStudioCreationInput,
): Promise<{ ok: true; id: string; content: GeneratedContent } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  if (!params.input.title.trim()) return { ok: false, error: "Le titre est obligatoire." };

  const [{ data: profile }, { data: brandKitRow }] = await Promise.all([
    supabase.from("business_profiles").select("company_name, city").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("brand_kits").select("*").eq("workspace_id", workspaceId).maybeSingle(),
  ]);

  const content = generateStudioContent({
    input: params.input,
    offerType: params.offerType,
    vertical: params.vertical,
    brandKit: toBrandKit(brandKitRow ?? null),
    companyName: profile?.company_name ?? "Votre entreprise",
    city: profile?.city ?? null,
  });

  const { data, error } = await supabase
    .from("studio_creations")
    .insert({
      workspace_id: workspaceId,
      vertical: params.vertical,
      offer_type: params.offerType,
      title: params.input.title.trim(),
      input_data: params.input as unknown as Record<string, unknown>,
      generated_content: content as unknown as Record<string, unknown>,
      status: "draft",
      source_mission_id: params.sourceMissionId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Échec de la création." };

  revalidatePath("/studio");
  return { ok: true, id: data.id, content };
}

export async function updateStudioCreationInput(
  workspaceId: string,
  id: string,
  updates: { title: string; input: StudioInput },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!updates.title.trim()) return { ok: false, error: "Le titre est obligatoire." };

  const { error } = await supabase
    .from("studio_creations")
    .update({ title: updates.title.trim(), input_data: updates.input as unknown as Record<string, unknown> })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/studio");
  return { ok: true };
}

/** Recalcule le contenu généré à partir des champs ACTUELLEMENT enregistrés — action distincte de la modification des champs. */
export async function regenerateStudioCreation(
  workspaceId: string,
  id: string,
): Promise<{ ok: true; content: GeneratedContent } | { ok: false; error: string }> {
  const supabase = await createClient();

  const [{ data: creation }, { data: profile }, { data: brandKitRow }] = await Promise.all([
    supabase.from("studio_creations").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("business_profiles").select("company_name, city").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("brand_kits").select("*").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (!creation) return { ok: false, error: "Création introuvable." };

  const content = generateStudioContent({
    input: parseStudioInput(creation.input_data),
    offerType: creation.offer_type,
    vertical: creation.vertical as StudioVertical,
    brandKit: toBrandKit(brandKitRow ?? null),
    companyName: profile?.company_name ?? "Votre entreprise",
    city: profile?.city ?? null,
  });

  const { error } = await supabase
    .from("studio_creations")
    .update({ generated_content: content as unknown as Record<string, unknown> })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/studio");
  return { ok: true, content };
}

/**
 * "published" est coché par l'utilisateur après avoir posté ailleurs —
 * jamais une vraie publication automatique (aucune intégration Meta API).
 */
export async function updateStudioCreationStatus(workspaceId: string, id: string, status: StudioStatus): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("studio_creations").update({ status }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/studio");
  return { ok: true };
}
