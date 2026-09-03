import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { getWorkspacePlan } from "@/lib/plan";
import { getUsage } from "@/lib/quota";

export default async function ParametresPage() {
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

  const [{ data: businessProfile }, { data: subscription }] = await Promise.all([
    supabase.from("business_profiles").select("*").eq("workspace_id", membership.workspace_id).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("workspace_id", membership.workspace_id).maybeSingle(),
  ]);

  const plan = await getWorkspacePlan(membership.workspace_id);
  const [nova, prospects, searches] = await Promise.all([
    getUsage(membership.workspace_id, "nova_requests", plan),
    getUsage(membership.workspace_id, "prospects_added", plan),
    getUsage(membership.workspace_id, "searches", plan),
  ]);

  return (
    <AppShell>
      <SettingsView
        workspaceId={membership.workspace_id}
        businessProfile={businessProfile}
        subscription={subscription}
        usage={{ nova, prospects, searches }}
        isDev={process.env.NODE_ENV !== "production"}
      />
    </AppShell>
  );
}
