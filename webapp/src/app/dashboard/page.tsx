import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { getXpSummary, xpActionLabel } from "@/lib/xp";
import { getWorkspacePlan } from "@/lib/plan";
import { PlanIntentBanner } from "@/components/plan-intent";

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

  const [{ count: targetCount }, { count: prospectCount }, { count: wonCount }, { count: appointmentCount }] =
    membership
      ? await Promise.all([
          supabase
            .from("workspace_targets")
            .select("category_id", { count: "exact", head: true })
            .eq("workspace_id", membership.workspace_id),
          supabase
            .from("prospects")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", membership.workspace_id),
          supabase
            .from("prospects")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", membership.workspace_id)
            .eq("status", "won"),
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", membership.workspace_id),
        ])
      : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];

  const xp = membership ? await getXpSummary(membership.workspace_id) : null;
  const plan = membership ? await getWorkspacePlan(membership.workspace_id) : "free";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PlanIntentBanner currentPlan={plan} />

        <div>
          <h1 className="font-display text-2xl font-extrabold">
            Bonjour {user.user_metadata?.full_name || user.email}
          </h1>
          <p className="mt-1 text-[13px] text-muted">Voici où en est votre prospection.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Métiers ciblés" value={targetCount ?? 0} />
          <Metric label="Prospects" value={prospectCount ?? 0} />
          <Metric label="Clients gagnés" value={wonCount ?? 0} />
          <Metric label="Rendez-vous" value={appointmentCount ?? 0} />
        </div>

        {xp && (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-bold">
                  Niveau {xp.level.level} — {xp.level.label}
                </h2>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {xp.totalXp} XP{xp.next ? ` — ${xp.next.minXp - xp.totalXp} XP avant ${xp.next.label}` : " — niveau maximum atteint"}
                </p>
              </div>
              <div className="font-display text-2xl font-extrabold">{xp.totalXp}</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent" style={{ width: `${xp.progressPct}%` }} />
            </div>
            {xp.recentEvents.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5 text-[12px]">
                {xp.recentEvents.map((e, i) => (
                  <li key={i} className="flex justify-between text-muted">
                    <span>{xpActionLabel(e.action)}</span>
                    <span className="font-semibold text-accent">+{e.xp_amount} XP</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <h2 className="font-display text-sm font-bold">Prochaine étape</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Lancez une recherche dans <b className="text-ink">Prospection</b> pour trouver de
            vraies entreprises (registre officiel + Google Places), puis ajoutez les meilleures
            au <b className="text-ink">CRM</b>. L&apos;envoi automatique d&apos;emails arrive dans
            une phase suivante (Gmail pas encore branché).
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
