import { checkedAll, DataLoadError, classifyDataError } from "@/lib/data-state";
import { DataLoadErrorView } from "@/components/data-load-error";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedBusinessProfile } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { SectionLabel } from "@/components/ui/section-label";
import { AppShell } from "@/components/app-shell";
import { getUserAppState } from "@/lib/app-state";
import { ACTIVITY_LABEL } from "@/lib/activity-labels";
import type { ProspectStatus } from "@/lib/crm-status";
import { PlanIntentBanner } from "@/components/plan-intent";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { getOpportunities } from "@/lib/actions/nova-opportunities";
import { listMissions } from "@/lib/actions/business-twin";

// Accueil = CE QUE JE DOIS SAVOIR ET FAIRE AUJOURD'HUI. Jamais une troisième
// copie de la liste complète des missions ou des opportunités NOVA (déjà
// sur /missions et /nova/actions) — seulement un teaser qui y renvoie. Voir
// l'audit : Dashboard et Business OS affichaient auparavant les TROIS mêmes
// blocs complets (GoalPicker/MissionsPreview/NovaOpportunities), ce qui
// donnait l'impression de pages qui se répètent.
const CONTACTED_OR_LATER: ProspectStatus[] = ["contacted", "replied", "interested", "rdv", "quote", "won", "lost"];

async function DashboardPageContent() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // État applicatif calculé une seule fois, de la même façon partout dans
  // l'app (voir lib/app-state.ts) — évite qu'une page décide "onboarding
  // fait" et une autre "non" à partir de lectures légèrement différentes.
  const appState = await getUserAppState(supabase, user.id);
  const { workspaceId, plan, businessProfileExists } = appState;

  // Module Business OS choisi comme mode principal : le Dashboard réel de
  // ce client, c'est son Business OS (qui ouvre déjà sur son propre onglet
  // Dashboard) — pas cette vue orientée prospection, hors-sujet pour qui a
  // explicitement dit vouloir "gérer son entreprise" plutôt que prospecter.
  if (workspaceId) {
    const businessProfile = await getCachedBusinessProfile(workspaceId);
    if (businessProfile?.product_mode === "business_os") redirect("/business-os");
  }

  const [{ count: targetCount }, { data: statusRows }, { data: appointments }, { data: recentActivities }] = workspaceId
    ? await checkedAll([
        supabase
          .from("workspace_targets")
          .select("category_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        supabase.from("prospects").select("status").eq("workspace_id", workspaceId),
        supabase
          .from("appointments")
          .select("id, title, starts_at")
          .eq("workspace_id", workspaceId)
          .order("starts_at"),
        supabase
          .from("activities")
          .select("id, type, detail, created_at, prospect_id")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(6),
      ])
    : [{ count: 0 }, { data: [] }, { data: [] }, { data: [] }];

  // Opportunités NOVA et missions actives : un simple teaser, pas une
  // donnée essentielle du Dashboard (la liste complète vit sur /missions et
  // /nova/actions). Isolé du bloc critique ci-dessus : si une verticale
  // Business OS a un souci de données (ex. une table métier), le Dashboard
  // reste utilisable — seul ce teaser disparaît, au lieu de bloquer toute
  // la page avec un écran "CHARGEMENT INTERROMPU".
  let opportunitiesResult: Awaited<ReturnType<typeof getOpportunities>> = {
    opportunities: [],
    canSeeAcquisition: false,
    canSeeBusinessOs: false,
  };
  let missions: Awaited<ReturnType<typeof listMissions>> = [];
  if (workspaceId) {
    try {
      [opportunitiesResult, missions] = await Promise.all([getOpportunities(workspaceId), listMissions(workspaceId)]);
    } catch (error) {
      console.error(
        "[dashboard] opportunités NOVA / missions indisponibles (non bloquant pour le reste de la page) :",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const configured = businessProfileExists;
  const statuses = statusRows ?? [];
  const total = statuses.length;
  const wonCount = statuses.filter((s) => s.status === "won").length;
  const contactedCount = statuses.filter((s) => CONTACTED_OR_LATER.includes(s.status as ProspectStatus)).length;
  const conversionRate = total > 0 ? Math.round((wonCount / total) * 100) : null;

  const now = new Date().getTime();
  const upcoming = (appointments ?? []).filter((a) => new Date(a.starts_at).getTime() >= now);

  // Deuxième requête pour résoudre les noms d'entreprise des activités
  // récentes (pas de jointure typée disponible sur ce schéma) — jamais un
  // nom inventé si le prospect a depuis été supprimé.
  const activityProspectIds = [...new Set((recentActivities ?? []).map((a) => a.prospect_id))];
  const { data: activityProspects } =
    activityProspectIds.length > 0
      ? await supabase.from("prospects").select("id, company_name").in("id", activityProspectIds)
      : { data: [] };
  const prospectNameById = new Map((activityProspects ?? []).map((p) => [p.id, p.company_name]));

  const toContactCount = statuses.filter((s) => s.status === "to_contact").length;
  const activeMissionsCount = missions.filter((m) => m.status === "active").length;
  const novaOpportunitiesCount = opportunitiesResult.opportunities.length;
  const hasPriorityActions = toContactCount > 0 || upcoming.length > 0 || activeMissionsCount > 0 || novaOpportunitiesCount > 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {!configured && <OnboardingBanner />}
        <PlanIntentBanner currentPlan={plan} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              Bonjour {user.user_metadata?.full_name || user.email}
            </h1>
            <p className="mt-1 text-[13px] text-muted">Voici ce qui mérite votre attention aujourd&apos;hui.</p>
          </div>
          <Link
            href="/prospection"
            className="shrink-0 rounded-lg bg-[image:var(--gradient-signature)] px-4 py-2.5 text-[13px] font-semibold text-accent-ink shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md),var(--glow-accent)]"
          >
            Lancer une recherche →
          </Link>
        </div>

        {total === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-3xl">⌕</span>
            <h2 className="font-display text-[17px] font-extrabold">Aucun prospect pour l&apos;instant</h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted">
              Lancez votre première recherche pour trouver de vraies entreprises (registre officiel + Google Places)
              dans votre zone, puis ajoutez les meilleures au CRM.
            </p>
            <Link
              href="/prospection"
              className="mt-1 rounded-lg bg-[image:var(--gradient-signature)] px-4 py-2.5 text-[13px] font-semibold text-accent-ink shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md),var(--glow-accent)]"
            >
              Trouver mes premiers prospects
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Prospects trouvés", value: String(total) },
              { label: "Contactés", value: String(contactedCount) },
              { label: "RDV à venir", value: String(upcoming.length) },
              { label: "Clients gagnés", value: String(wonCount) },
              { label: "Taux de conversion", value: conversionRate !== null ? `${conversionRate}%` : "—" },
            ].map((tile, i) => (
              <div key={tile.label} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <StatTile label={tile.label} value={tile.value} />
              </div>
            ))}
          </div>
        )}

        {hasPriorityActions && (
          <div className="flex flex-col gap-2.5">
            <SectionLabel>⚡ Actions prioritaires</SectionLabel>
            <Card>
              <ul className="flex flex-col gap-2.5 text-[12.5px]">
                {toContactCount > 0 && (
                  <li>
                    <Link href="/crm" className="font-semibold text-accent">
                      {toContactCount} prospect(s)
                    </Link>{" "}
                    <span className="text-muted">en attente de premier contact</span>
                  </li>
                )}
                {upcoming.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.title}</span>{" "}
                    <span className="text-muted">
                      — {new Date(a.starts_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
                {activeMissionsCount > 0 && (
                  <li>
                    <Link href="/missions" className="font-semibold text-accent">
                      {activeMissionsCount} mission{activeMissionsCount > 1 ? "s" : ""} active{activeMissionsCount > 1 ? "s" : ""}
                    </Link>{" "}
                    <span className="text-muted">en cours de suivi</span>
                  </li>
                )}
                {novaOpportunitiesCount > 0 && (
                  <li>
                    <Link href="/nova/actions" className="font-semibold text-accent">
                      {novaOpportunitiesCount} opportunité{novaOpportunitiesCount > 1 ? "s" : ""} NOVA
                    </Link>{" "}
                    <span className="text-muted">détectée{novaOpportunitiesCount > 1 ? "s" : ""} dans vos données</span>
                  </li>
                )}
              </ul>
            </Card>
          </div>
        )}

        {total > 0 && (
          <Card>
            <h2 className="font-display text-sm font-bold">Activité récente</h2>
            {(recentActivities ?? []).length === 0 ? (
              <p className="mt-3 text-[12.5px] text-muted">Aucune activité récente.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {(recentActivities ?? []).map((a) => (
                  <li key={a.id} className="text-[12.5px]">
                    <span className="font-semibold">{ACTIVITY_LABEL[a.type]}</span>{" "}
                    <span className="text-muted">— {prospectNameById.get(a.prospect_id) ?? "prospect supprimé"}</span>
                    <div className="text-[10.5px] text-faint">
                      {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {targetCount === 0 && (
          <Card className="border-line bg-soft">
            <p className="text-[12.5px] text-muted">
              Aucun métier ciblé pour l&apos;instant —{" "}
              <Link href="/onboarding" className="font-semibold text-accent">
                terminez votre configuration
              </Link>{" "}
              pour préciser qui vous voulez démarcher.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}


export default async function DashboardPage() { try { return await DashboardPageContent(); } catch(error) { if(error instanceof DataLoadError) return <DataLoadErrorView kind={error.kind}/>; if(error && typeof error === "object" && "code" in error) return <DataLoadErrorView kind={classifyDataError(error)}/>; throw error; } }
