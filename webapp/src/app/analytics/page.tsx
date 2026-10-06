import { OperationalAnalytics } from "@/components/analytics/operational-analytics";
import { DataLoadError, classifyDataError } from "@/lib/data-state";
import { DataLoadErrorView } from "@/components/data-load-error";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { computeFunnel, computeWeeklyNewProspects } from "@/lib/analytics";
import { FunnelChart, PipelineChart, TrendChart, EmptyChartNote } from "@/components/analytics/charts";

// Business Analytics = mesurer la performance réelle de la prospection et
// du CRM — jamais XP/quotas du SaaS (ça, c'est sur /abonnement, voir
// l'audit : cette page en affichait une copie, ce n'est pas de la donnée
// business). Chaque donnée vient du statut RÉEL des prospects ; ce qui
// n'est pas mesurable aujourd'hui (campagnes Studio, autres sources) est
// affiché comme tel, jamais inventé.
async function AnalyticsPageContent() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const workspaceId = membership.workspace_id;

  const { data: prospects } = await supabase
    .from("prospects")
    .select("status, created_at")
    .eq("workspace_id", workspaceId).throwOnError();

  const rows = prospects ?? [];
  const total = rows.length;
  const funnel = computeFunnel(rows);
  const pipelineCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const weekly = computeWeeklyNewProspects(
    rows.map((r) => r.created_at),
    8,
  );

  const operationalAnalytics=await OperationalAnalytics({workspaceId});
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Analytics</h1>
          <p className="mt-1 text-[13px] text-muted">
            Uniquement des données réelles de votre workspace — aucune projection, aucun CA/ROI inventé.
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Prospects au total", value: String(total), sub: undefined as string | undefined },
                { label: "Contactés", value: String(funnel[1].count), sub: funnel[1].pctOfFirst != null ? `${funnel[1].pctOfFirst}%` : undefined },
                { label: "RDV obtenus", value: String(funnel[2].count), sub: funnel[2].pctOfFirst != null ? `${funnel[2].pctOfFirst}%` : undefined },
                { label: "Clients gagnés", value: String(funnel[3].count), sub: funnel[3].pctOfFirst != null ? `${funnel[3].pctOfFirst}%` : undefined },
              ].map((tile, i) => (
                <div key={tile.label} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <StatTile label={tile.label} value={tile.value} sub={tile.sub} />
                </div>
              ))}
            </div>

            <Card>
              <h2 className="font-display text-sm font-bold">Funnel — Prospects → Contactés → RDV → Clients</h2>
              <div className="mt-4">
                <FunnelChart stages={funnel} />
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="font-display text-sm font-bold">Répartition du pipeline</h2>
                <div className="mt-4">
                  <PipelineChart counts={pipelineCounts} />
                </div>
              </Card>

              <Card>
                <h2 className="font-display text-sm font-bold">Nouveaux prospects par semaine</h2>
                <div className="mt-4">
                  <TrendChart points={weekly} />
                </div>
              </Card>
            </div>
          </>
        )}

        <Card>
          <h2 className="font-display text-sm font-bold">Sources</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Tous vos prospects viennent aujourd&apos;hui de <b className="text-ink">Prospection</b> — une seule
            source, donc pas encore de répartition à afficher. Ce graphique deviendra pertinent si d&apos;autres
            sources d&apos;acquisition (import, ajout manuel...) sont ajoutées plus tard.
          </p>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Campagnes Studio</h2>
          <EmptyChartNote>
            Non disponible pour l&apos;instant — Studio ne mesure pas encore les résultats de ses créations (pas de
            suivi d&apos;ouverture/clic), et ses créations ne sont pas encore rattachées à un prospect précis. Rien
            n&apos;est affiché ici plutôt que d&apos;inventer un taux de performance.
          </EmptyChartNote>
        </Card>
        {operationalAnalytics}
      </div>
    </AppShell>
  );
}


export default async function AnalyticsPage() { try { return await AnalyticsPageContent(); } catch(error) { if(error instanceof DataLoadError) return <DataLoadErrorView kind={error.kind}/>; if(error && typeof error === "object" && "code" in error) return <DataLoadErrorView kind={classifyDataError(error)}/>; throw error; } }
