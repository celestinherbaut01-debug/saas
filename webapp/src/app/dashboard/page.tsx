import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";

export default async function DashboardPage() {
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

  const [{ count: targetCount }, { count: prospectCount }] = membership
    ? await Promise.all([
        supabase
          .from("workspace_targets")
          .select("category_id", { count: "exact", head: true })
          .eq("workspace_id", membership.workspace_id),
        supabase
          .from("prospects")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", membership.workspace_id),
      ])
    : [{ count: 0 }, { count: 0 }];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            Bonjour {user.user_metadata?.full_name || user.email}
          </h1>
          <p className="mt-1 text-[13px] text-muted">Voici où en est votre prospection.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Métiers ciblés" value={targetCount ?? 0} />
          <Metric label="Prospects" value={prospectCount ?? 0} />
          <Metric label="Emails envoyés" value={0} />
          <Metric label="Rendez-vous" value={0} />
        </div>

        <Card>
          <h2 className="font-display text-sm font-bold">Prochaine étape</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Lancez une recherche dans <b className="text-ink">Prospection</b> pour trouver de
            vraies entreprises (registre officiel + Google Places), puis ajoutez les meilleures
            au <b className="text-ink">CRM</b>. L&apos;envoi d&apos;emails et l&apos;agent IA
            arrivent dans une phase suivante — les compteurs ci-dessus restent à 0 tant que ces
            fonctionnalités n&apos;existent pas encore.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </Card>
  );
}
