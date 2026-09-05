import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership, getCachedBusinessProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { SubscriptionView } from "@/components/settings/subscription-view";
import { getWorkspacePlan } from "@/lib/plan";
import { getUsage } from "@/lib/quota";
import { getBusinessOsProfile, verticalLabelFromProfile } from "@/lib/business-os";

export default async function AbonnementPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const workspaceId = membership.workspace_id;
  const supabase = await createClient();
  const [plan, businessProfile] = await Promise.all([
    getWorkspacePlan(workspaceId),
    getCachedBusinessProfile(workspaceId),
  ]);

  const [nova, prospects, searches] = await Promise.all([
    getUsage(workspaceId, "nova_requests", plan),
    getUsage(workspaceId, "prospects_added", plan),
    getUsage(workspaceId, "searches", plan),
  ]);

  // Même résolution parent/feuille que /business-os, pour afficher "Business
  // OS — Garage" plutôt qu'un générique "Business OS" quand une verticale
  // dédiée s'applique (voir lib/business-os.ts).
  let parentSlug: string | null = null;
  let leafSlug: string | null = null;
  if (businessProfile?.own_category_id) {
    const { data: ownCategory } = await supabase
      .from("business_categories")
      .select("slug, parent_id")
      .eq("id", businessProfile.own_category_id)
      .maybeSingle();
    leafSlug = ownCategory?.slug ?? null;
    if (ownCategory?.parent_id) {
      const { data: parent } = await supabase
        .from("business_categories")
        .select("slug")
        .eq("id", ownCategory.parent_id)
        .maybeSingle();
      parentSlug = parent?.slug ?? null;
    }
  }
  const businessOsVerticalLabel = verticalLabelFromProfile(getBusinessOsProfile(parentSlug, leafSlug));

  return (
    <AppShell>
      <SubscriptionView
        workspaceId={workspaceId}
        currentPlan={plan}
        usage={{ nova, prospects, searches }}
        isDev={process.env.NODE_ENV !== "production"}
        businessOsVerticalLabel={businessOsVerticalLabel}
      />
    </AppShell>
  );
}
