import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { StudioView } from "@/components/studio/studio-view";
import { resolveStudioVertical } from "@/lib/studio/vertical";
import { DEFAULT_BRAND_KIT, type BrandKit } from "@/lib/studio/types";

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const params = await searchParams;
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const supabase = await createClient();
  const [{ data: businessProfile }, { data: categories }, { data: creations }, { data: brandKitRow }] = await Promise.all([
    supabase.from("business_profiles").select("own_category_id, company_name, city").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("business_categories").select("id, slug, parent_id"),
    supabase.from("studio_creations").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    supabase.from("brand_kits").select("*").eq("workspace_id", workspaceId).maybeSingle(),
  ]);

  const allCategories = categories ?? [];
  const ownCategory = businessProfile?.own_category_id ? allCategories.find((c) => c.id === businessProfile.own_category_id) : null;
  const parentSlug = ownCategory?.parent_id ? allCategories.find((c) => c.id === ownCategory.parent_id)?.slug ?? null : null;
  const vertical = resolveStudioVertical(ownCategory?.slug ?? null, parentSlug);

  const brandKit: BrandKit = brandKitRow
    ? { tone: brandKitRow.tone, primaryColor: brandKitRow.primary_color, accentColor: brandKitRow.accent_color, tagline: brandKitRow.tagline }
    : DEFAULT_BRAND_KIT;

  // Préremplissage venant d'une action Business Twin de type "campagne"
  // (voir MissionActionItem) — jamais un nouveau texte inventé côté page,
  // seulement ce que le plan avait déjà préparé.
  const asString = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const prefill =
    asString(params.new) === "1"
      ? {
          title: asString(params.title) ?? "",
          description: asString(params.description) ?? "",
          sourceMissionId: asString(params.sourceMissionId) ?? null,
        }
      : null;

  return (
    <AppShell>
      <StudioView
        workspaceId={workspaceId}
        vertical={vertical}
        initialCreations={creations ?? []}
        brandKit={brandKit}
        prefill={prefill}
        companyName={businessProfile?.company_name ?? "Votre entreprise"}
        city={businessProfile?.city ?? null}
      />
    </AppShell>
  );
}
