import { checkedAll, DataLoadError, classifyDataError } from "@/lib/data-state";
import { DataLoadErrorView } from "@/components/data-load-error";
import { propertyToStudioInput } from "@/lib/realestate";
import { parsePhotos } from "@/lib/studio/photos";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { StudioView } from "@/components/studio/studio-view";
import { resolveStudioVertical } from "@/lib/studio/vertical";
import { DEFAULT_BRAND_KIT, type BrandKit } from "@/lib/studio/types";

async function StudioPageContent({ searchParams }: PageProps<"/studio">) {
  const params = await searchParams;
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const supabase = await createClient();
  const [{ data: businessProfile }, { data: categories }, { data: creations }, { data: brandKitRow }] = await checkedAll([
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
  let prefill: import("@/components/studio/studio-view").StudioPrefill | null =
    asString(params.new) === "1"
      ? {
          title: asString(params.title) ?? "",
          description: asString(params.description) ?? "",
          sourceMissionId: asString(params.sourceMissionId) ?? null,
        }
      : null;

  const propertyId = asString(params.propertyId);
  if(propertyId) {
    const [result] = await checkedAll([supabase.from("properties").select("*").eq("workspace_id",workspaceId).eq("id",propertyId).single()]);
    const property=result.data;
    if(property) prefill={title:property.title,description:property.description,sourceMissionId:null,sourcePropertyId:property.id,input:propertyToStudioInput(property),photos:parsePhotos(property.photos),offerType:"bien"};
  }
  return (
    <AppShell>
      <StudioView key={propertyId??asString(params.sourceMissionId)??"studio-library"}
        workspaceId={workspaceId}
        vertical={propertyId ? "realestate" : vertical}
        initialCreations={creations ?? []}
        brandKit={brandKit}
        prefill={prefill}
        companyName={businessProfile?.company_name ?? "Votre entreprise"}
        city={businessProfile?.city ?? null}
      />
    </AppShell>
  );
}

export default async function StudioPage(props: Parameters<typeof StudioPageContent>[0]) { try { return await StudioPageContent(props); } catch(error) { if(error instanceof DataLoadError) return <DataLoadErrorView kind={error.kind}/>; if(error && typeof error === "object" && "code" in error) return <DataLoadErrorView kind={classifyDataError(error)}/>; throw error; } }
