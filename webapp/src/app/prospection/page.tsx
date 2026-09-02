import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { ProspectionView } from "@/components/prospection/prospection-view";

export default async function ProspectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const [{ data: categories }, { data: businessProfile }, { data: targets }] = await Promise.all([
    supabase.from("business_categories").select("*").order("sort_order"),
    supabase
      .from("business_profiles")
      .select("*")
      .eq("workspace_id", membership.workspace_id)
      .maybeSingle(),
    supabase
      .from("workspace_targets")
      .select("category_id")
      .eq("workspace_id", membership.workspace_id),
  ]);

  return (
    <AppShell>
      <ProspectionView
        workspaceId={membership.workspace_id}
        categories={categories ?? []}
        businessProfile={businessProfile}
        defaultTargetIds={(targets ?? []).map((t) => t.category_id)}
      />
    </AppShell>
  );
}
