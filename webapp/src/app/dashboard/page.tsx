import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedBusinessProfile } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { UsageBar } from "@/components/ui/usage-bar";
import { AppShell } from "@/components/app-shell";
import { getXpSummary, xpActionLabel } from "@/lib/xp";
import { getUserAppState } from "@/lib/app-state";
import { getUsage } from "@/lib/quota";
import { isNovaConfigured } from "@/lib/actions/nova";
import { novaContexts } from "@/lib/entitlements";
import { ACTIVITY_LABEL } from "@/lib/activity-labels";
import type { ProspectStatus } from "@/lib/crm-status";
import { PlanIntentBanner } from "@/components/plan-intent";
import { OnboardingBanner } from "@/components/onboarding-banner";

const CONTACTED_OR_LATER: ProspectStatus[] = [
  "contacted",
  "replied",
  "interested",
  "rdv",
  "quote",
  "won",
  "lost",
];
const RESPONDED: ProspectStatus[] = ["replied", "interested", "rdv", "quote", "won"];

export default async function DashboardPage() {
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

  const [
    { count: targetCount },
    { data: statusRows },
    { data: appointments },
    { data: recentActivities },
    xp,
    novaConfigured,
    usageNova,
    usageProspects,
    usageSearches,
  ] = workspaceId
    ? await Promise.all([
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
        getXpSummary(workspaceId),
        isNovaConfigured(),
        getUsage(workspaceId, "nova_requests", plan),
        getUsage(workspaceId, "prospects_added", plan),
        getUsage(workspaceId, "searches", plan),
      ])
    : [{ count: 0 }, { data: [] }, { data: [] }, { data: [] }, null, false, null, null, null];

  const configured = businessProfileExists;
  const statuses = statusRows ?? [];
  const total = statuses.length;
  const wonCount = statuses.filter((s) => s.status === "won").length;
  const contactedCount = statuses.filter((s) => CONTACTED_OR_LATER.includes(s.status as ProspectStatus)).length;
  const respondedCount = statuses.filter((s) => RESPONDED.includes(s.status as ProspectStatus)).length;
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
            <p className="mt-1 text-[13px] text-muted">Voici où en est votre prospection.</p>
          </div>
          <Link href="/prospection" className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-semibold text-bg">
            Lancer une recherche →
          </Link>
        </div>

        {total === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-3xl">⌕</span>
            <h2 className="font-display text-[17px] font-extrabold">Aucun prospect pour l&apos;instant</h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted">
              Lancez votre première recherche pour trouver de vraies entreprises (registre officiel + Google
              Places) dans votre zone, puis ajoutez les meilleures au CRM.
            </p>
            <Link href="/prospection" className="mt-1 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-semibold text-bg">
              Trouver mes premiers prospects
            </Link>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Prospects trouvés" value={String(total)} />
              <StatTile label="Contactés" value={String(contactedCount)} />
              <StatTile label="Réponses" value={String(respondedCount)} />
              <StatTile label="Rendez-vous à venir" value={String(upcoming.length)} />
              <StatTile label="Clients gagnés" value={String(wonCount)} />
              <StatTile label="Taux de conversion" value={conversionRate !== null ? `${conversionRate}%` : "—"} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <h2 className="font-display text-sm font-bold">Activité récente</h2>
                {(recentActivities ?? []).length === 0 ? (
                  <p className="mt-3 text-[12.5px] text-muted">Aucune activité récente.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {(recentActivities ?? []).map((a) => (
                      <li key={a.id} className="text-[12.5px]">
                        <span className="font-semibold">{ACTIVITY_LABEL[a.type]}</span>{" "}
                        <span className="text-muted">
                          — {prospectNameById.get(a.prospect_id) ?? "prospect supprimé"}
                        </span>
                        <div className="text-[10.5px] text-faint">
                          {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h2 className="font-display text-sm font-bold">Prochaines actions</h2>
                <ul className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
                  {statuses.filter((s) => s.status === "to_contact").length > 0 && (
                    <li>
                      <Link href="/crm" className="font-semibold text-accent">
                        {statuses.filter((s) => s.status === "to_contact").length} prospect(s)
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
                  {statuses.filter((s) => s.status === "to_contact").length === 0 && upcoming.length === 0 && (
                    <li className="text-muted">Rien en attente pour l&apos;instant.</li>
                  )}
                </ul>
              </Card>
            </div>
          </>
        )}

        <Card>
          <h2 className="font-display text-sm font-bold">NOVA</h2>
          {novaConfigured ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {novaContexts(plan).includes("commercial")
                ? "NOVA peut rédiger vos prochains emails de prospection à partir de vos vraies données CRM."
                : "NOVA peut répondre à partir des vraies données de votre Business OS (planning, stock, clients)."}{" "}
              <Link href="/agent" className="font-semibold text-accent">
                Ouvrir NOVA →
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              NOVA n&apos;est pas encore configurée sur ce projet (clé API manquante côté serveur).
            </p>
          )}
        </Card>

        {workspaceId && usageNova && usageProspects && usageSearches && (
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold">Usage du forfait</h2>
              <Link href="/abonnement" className="text-[12px] font-semibold text-accent">
                Gérer →
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <UsageBar label="Prospects" status={usageProspects} />
              <UsageBar label="Recherches" status={usageSearches} />
              <UsageBar label="NOVA" status={usageNova} />
            </div>
          </Card>
        )}

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
