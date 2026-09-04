import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { AgentChat } from "@/components/agent/agent-chat";
import { isNovaConfigured } from "@/lib/actions/nova";

export default async function AgentPage({ searchParams }: PageProps<"/agent">) {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const configured = await isNovaConfigured();
  const params = await searchParams;
  const initialPrompt = typeof params.prompt === "string" ? params.prompt : undefined;

  return (
    <AppShell>
      <AgentChat workspaceId={membership.workspace_id} configured={configured} initialPrompt={initialPrompt} />
    </AppShell>
  );
}
