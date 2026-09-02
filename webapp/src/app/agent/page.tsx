import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { AgentChat } from "@/components/agent/agent-chat";
import { isNovaConfigured } from "@/lib/actions/nova";

export default async function AgentPage() {
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

  const configured = await isNovaConfigured();

  return (
    <AppShell>
      <AgentChat workspaceId={membership.workspace_id} configured={configured} />
    </AppShell>
  );
}
