import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { SettingsView } from "@/components/settings/settings-view";

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

  return (
    <AppShell>
      <SettingsView
        workspaceId={membership.workspace_id}
        businessProfile={businessProfile}
        subscription={subscription}
      />
    </AppShell>
  );
}
