import { checkedAll, DataLoadError, classifyDataError } from "@/lib/data-state";
import { DataLoadErrorView } from "@/components/data-load-error";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { DEFAULT_BRAND_KIT, type BrandKit } from "@/lib/studio/types";

async function ParametresPageContent() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const [{ data: businessProfile }, { data: brandKitRow }, { data: categories }] = await checkedAll([
    supabase.from("business_profiles").select("*").eq("workspace_id", membership.workspace_id).maybeSingle(),
    supabase.from("brand_kits").select("*").eq("workspace_id", membership.workspace_id).maybeSingle(),
    supabase.from("business_categories").select("*").order("sort_order"),
  ]);

  const brandKit: BrandKit = brandKitRow
    ? { tone: brandKitRow.tone, primaryColor: brandKitRow.primary_color, accentColor: brandKitRow.accent_color, tagline: brandKitRow.tagline }
    : DEFAULT_BRAND_KIT;

  return (
    <AppShell>
      <SettingsView
        workspaceId={membership.workspace_id}
        businessProfile={businessProfile}
        brandKit={brandKit}
        categories={categories ?? []}
      />
    </AppShell>
  );
}

export default async function ParametresPage() { try { return await ParametresPageContent(); } catch(error) { if(error instanceof DataLoadError) return <DataLoadErrorView kind={error.kind}/>; if(error && typeof error === "object" && "code" in error) return <DataLoadErrorView kind={classifyDataError(error)}/>; throw error; } }
