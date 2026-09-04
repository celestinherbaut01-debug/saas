import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getWorkspacePlan } from "@/lib/plan";
import { getUsage } from "@/lib/quota";
import { getXpSummary } from "@/lib/xp";

const STATUS_ORDER: [string, string][] = [
  ["new", "Nouveau"],
  ["to_contact", "À contacter"],
  ["contacted", "Contacté"],
  ["replied", "A répondu"],
  ["won", "Gagné"],
  ["lost", "Perdu"],
];

export default async function AnalyticsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const workspaceId = membership.workspace_id;
  const plan = await getWorkspacePlan(workspaceId);

  const [{ data: statusRows }, xp, nova, prospectsUsed, searches] = await Promise.all([
    supabase.from("prospects").select("status").eq("workspace_id", workspaceId),
    getXpSummary(workspaceId),
    getUsage(workspaceId, "nova_requests", plan),
    getUsage(workspaceId, "prospects_added", plan),
    getUsage(workspaceId, "searches", plan),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  const total = statusRows?.length ?? 0;
  const maxCount = Math.max(1, ...Object.values(byStatus));

  const contactedOrLater = (byStatus.contacted ?? 0) + (byStatus.replied ?? 0) + (byStatus.won ?? 0) + (byStatus.lost ?? 0);
  const responseRate = contactedOrLater > 0 ? Math.round(((byStatus.replied ?? 0) + (byStatus.won ?? 0)) / contactedOrLater * 100) : null;
  const conversionRate = total > 0 ? Math.round(((byStatus.won ?? 0) / total) * 100) : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Analytics</h1>
          <p className="mt-1 text-[13px] text-muted">
            Uniquement des données réelles de votre workspace — aucune projection ni chiffre inventé.
          </p>
        </div>

        {total === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">
              Aucun prospect pour le moment — lancez une recherche dans{" "}
              <a href="/prospection" className="font-semibold text-accent">
                Prospection
              </a>{" "}
              pour voir vos statistiques ici.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Prospects au total" value={String(total)} />
              <StatTile label="Taux de réponse" value={responseRate !== null ? `${responseRate}%` : "—"} />
              <StatTile label="Taux de conversion" value={conversionRate !== null ? `${conversionRate}%` : "—"} />
            </div>

            <Card>
              <h2 className="font-display text-sm font-bold">Pipeline CRM</h2>
              <div className="mt-4 flex flex-col gap-2.5">
                {STATUS_ORDER.map(([value, label]) => {
                  const count = byStatus[value] ?? 0;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={value} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[12px] text-muted">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[12px] font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        <Card>
          <h2 className="font-display text-sm font-bold">Usage & progression</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <StatTile label="XP total" value={String(xp.totalXp)} sub={`Niveau ${xp.level.level} — ${xp.level.label}`} />
            <StatTile label="NOVA ce mois" value={`${nova.used}/${nova.limit}`} />
            <StatTile label="Prospects ce mois" value={`${prospectsUsed.used}/${prospectsUsed.limit}`} />
            <StatTile label="Recherches ce mois" value={`${searches.used}/${searches.limit}`} />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}
