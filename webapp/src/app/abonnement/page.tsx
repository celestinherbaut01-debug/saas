import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { SubscriptionView } from "@/components/settings/subscription-view";
import { getWorkspacePlan } from "@/lib/plan";
import { getUsage } from "@/lib/quota";

export default async function AbonnementPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const workspaceId = membership.workspace_id;
  const plan = await getWorkspacePlan(workspaceId);

  const [nova, prospects, searches] = await Promise.all([
    getUsage(workspaceId, "nova_requests", plan),
    getUsage(workspaceId, "prospects_added", plan),
    getUsage(workspaceId, "searches", plan),
  ]);

  return (
    <AppShell>
      <SubscriptionView
        workspaceId={workspaceId}
        currentPlan={plan}
        usage={{ nova, prospects, searches }}
        isDev={process.env.NODE_ENV !== "production"}
      />
    </AppShell>
  );
}
