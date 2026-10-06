import { checkedAll, DataLoadError, classifyDataError } from "@/lib/data-state";
import { DataLoadErrorView } from "@/components/data-load-error";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CrmView } from "@/components/crm/crm-view";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";

async function CrmPageContent() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const [{ data: prospects }, plan] = await checkedAll([
    supabase.from("prospects").select("*").eq("workspace_id", membership.workspace_id).order("quality_score", { ascending: false }),
    getWorkspacePlan(membership.workspace_id),
  ]);
  const canUseBusinessOs = businessOsAtLeast(plan, "standard");

  return (
    <AppShell>
      <CrmView initialProspects={prospects ?? []} canUseBusinessOs={canUseBusinessOs} />
    </AppShell>
  );
}


export default async function CrmPage() { try { return await CrmPageContent(); } catch(error) { if(error instanceof DataLoadError) return <DataLoadErrorView kind={error.kind}/>; if(error && typeof error === "object" && "code" in error) return <DataLoadErrorView kind={classifyDataError(error)}/>; throw error; } }
