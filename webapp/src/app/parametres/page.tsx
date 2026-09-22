import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { DEFAULT_BRAND_KIT, type BrandKit } from "@/lib/studio/types";

export default async function ParametresPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const [{ data: businessProfile }, { data: brandKitRow }] = await Promise.all([
    supabase.from("business_profiles").select("*").eq("workspace_id", membership.workspace_id).maybeSingle(),
    supabase.from("brand_kits").select("*").eq("workspace_id", membership.workspace_id).maybeSingle(),
  ]);

  const brandKit: BrandKit = brandKitRow
    ? { tone: brandKitRow.tone, primaryColor: brandKitRow.primary_color, accentColor: brandKitRow.accent_color, tagline: brandKitRow.tagline }
    : DEFAULT_BRAND_KIT;

  return (
    <AppShell>
      <SettingsView workspaceId={membership.workspace_id} businessProfile={businessProfile} brandKit={brandKit} />
    </AppShell>
  );
}
