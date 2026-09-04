import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CrmView } from "@/components/crm/crm-view";

export default async function CrmPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const { data: prospects } = await supabase
    .from("prospects")
    .select("*")
    .eq("workspace_id", membership.workspace_id)
    .order("quality_score", { ascending: false });

  return (
    <AppShell>
      <CrmView initialProspects={prospects ?? []} />
    </AppShell>
  );
}
