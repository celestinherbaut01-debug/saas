import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

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

  const workspace = membership
    ? (
        await supabase
          .from("workspaces")
          .select("name, plan")
          .eq("id", membership.workspace_id)
          .maybeSingle()
      ).data
    : null;

  const { count: targetCount } = membership
    ? await supabase
        .from("workspace_targets")
        .select("category_id", { count: "exact", head: true })
        .eq("workspace_id", membership.workspace_id)
    : { count: 0 };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            Bonjour {user.user_metadata?.full_name || user.email}
          </h1>
          <p className="text-[13px] text-muted">
            Workspace : {workspace?.name ?? "—"} · Plan {workspace?.plan ?? "starter"}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Se déconnecter
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Métiers ciblés" value={targetCount ?? 0} />
        <Metric label="Prospects" value={0} />
        <Metric label="Emails envoyés" value={0} />
        <Metric label="Rendez-vous" value={0} />
      </div>

      <Card>
        <h2 className="font-display text-sm font-bold">Phase 1 terminée</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Compte, workspace, onboarding et catalogue de métiers sont réels et fonctionnels. La
          recherche de prospects (registre officiel + Google Places), le CRM et l&apos;agent IA
          arrivent dans les phases suivantes — les métriques ci-dessus resteront à zéro tant que
          ces fonctionnalités ne sont pas branchées : aucune donnée n&apos;est inventée en
          attendant.
        </p>
      </Card>
    </main>
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
