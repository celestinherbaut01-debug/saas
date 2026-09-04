import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { AgentChat } from "@/components/agent/agent-chat";
import { isNovaConfigured } from "@/lib/actions/nova";

export default async function AgentPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const configured = await isNovaConfigured();

  return (
    <AppShell>
      <AgentChat workspaceId={membership.workspace_id} configured={configured} />
    </AppShell>
  );
}
