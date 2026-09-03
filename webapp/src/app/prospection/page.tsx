import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { ProspectionView } from "@/components/prospection/prospection-view";
import { getWorkspacePlan } from "@/lib/plan";
import { ENTITLEMENTS } from "@/lib/entitlements";

export default async function ProspectionPage() {
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

  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const [{ data: categories }, { data: businessProfile }, { data: targets }] = await Promise.all([
    supabase.from("business_categories").select("*").order("sort_order"),
    supabase
      .from("business_profiles")
      .select("*")
      .eq("workspace_id", membership.workspace_id)
      .maybeSingle(),
    supabase
      .from("workspace_targets")
      .select("category_id")
      .eq("workspace_id", membership.workspace_id),
  ]);

  // Configuration incomplète : la page reste visitable (pas de redirection),
  // mais la recherche elle-même nécessite une adresse de départ, qui vient
  // de l'onboarding — un CTA remplace le formulaire plutôt que de bloquer
  // l'accès à toute l'application.
  if (!businessProfile || businessProfile.lat == null || businessProfile.lng == null) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-lg font-extrabold">Prospection</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Terminez la configuration de votre entreprise pour lancer votre première recherche —
            il faut au minimum votre métier, vos cibles et une adresse de départ.
          </p>
          <a
            href="/onboarding"
            className="mt-4 inline-block rounded-lg bg-ink px-4 py-2.5 text-[13px] font-semibold text-bg"
          >
            Terminer la configuration
          </a>
        </Card>
      </AppShell>
    );
  }

  const plan = await getWorkspacePlan(membership.workspace_id);

  return (
    <AppShell>
      <ProspectionView
        workspaceId={membership.workspace_id}
        categories={categories ?? []}
        businessProfile={businessProfile}
        defaultTargetIds={(targets ?? []).map((t) => t.category_id)}
        maxRadiusKm={ENTITLEMENTS[plan].maxRadiusKm}
        planLabel={ENTITLEMENTS[plan].label}
      />
    </AppShell>
  );
}
