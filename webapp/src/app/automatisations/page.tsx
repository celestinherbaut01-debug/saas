import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership, getCachedAutomationSettings, getCachedBusinessOsProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getWorkspacePlan, PLAN_LABEL } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";
import { AutomationSettingsView } from "@/components/automation/automation-settings-view";

export default async function AutomatisationsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const workspaceId = membership.workspace_id;
  const plan = await getWorkspacePlan(workspaceId);

  if (!businessOsAtLeast(plan, "standard")) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-lg font-extrabold">Automatisations — Business OS non activé</h1>
          <p className="mt-2 text-[13px] text-muted">
            Les automatisations (rappels, alertes proactives) font partie des plans Business OS, Business OS
            Advanced, Complete et Complete Max. Votre workspace est actuellement sur le plan {PLAN_LABEL[plan]}.
            Activez-le depuis{" "}
            <a href="/abonnement" className="font-semibold text-accent">
              Abonnements
            </a>
            .
          </p>
        </Card>
      </AppShell>
    );
  }

  const [settings, profile] = await Promise.all([
    getCachedAutomationSettings(workspaceId),
    getCachedBusinessOsProfile(workspaceId),
  ]);

  return (
    <AppShell>
      <AutomationSettingsView workspaceId={workspaceId} initialSettings={settings} vertical={profile.vertical} />
    </AppShell>
  );
}
