import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CrmView } from "@/components/crm/crm-view";

export default async function CrmPage() {
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
