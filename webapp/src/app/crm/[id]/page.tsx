import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { ProspectDetail } from "@/components/crm/prospect-detail";
import { resolveScoringProfile, SCORING_PROFILE_LABEL } from "@/lib/scoring-profile";

export default async function ProspectDetailPage({ params }: PageProps<"/crm/[id]">) {
  const { id } = await params;
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Les deux requêtes ne dépendent que de `id` (pas l'une de l'autre) :
  // parallélisées plutôt qu'attendues l'une après l'autre.
  const [{ data: prospect }, { data: activities }] = await Promise.all([
    supabase.from("prospects").select("*").eq("id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
  ]);
  if (!prospect) notFound();

  // Même logique que la recherche (search-prospects) pour que le libellé du
  // score affiché sur la fiche corresponde à ce qui a été calculé à l'ajout
  // — voir lib/scoring-profile.ts, miroir exact de la version edge function.
  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("own_category_id, audience")
    .eq("workspace_id", prospect.workspace_id)
    .maybeSingle();
  const ownSlug = businessProfile?.own_category_id
    ? (
        await supabase
          .from("business_categories")
          .select("slug")
          .eq("id", businessProfile.own_category_id)
          .maybeSingle()
      ).data?.slug ?? null
    : null;
  const scoreLabel = SCORING_PROFILE_LABEL[resolveScoringProfile(ownSlug, businessProfile?.audience ?? null)];

  return (
    <AppShell>
      <ProspectDetail prospect={prospect} initialActivities={activities ?? []} scoreLabel={scoreLabel} />
    </AppShell>
  );
}
