import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership, getCachedBusinessOsProfile } from "@/lib/session";
import { getWorkspacePlan, PLAN_LABEL } from "@/lib/plan";
import { getEntitlements } from "@/lib/entitlements";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOpportunities } from "@/lib/actions/nova-opportunities";
import { NovaOpportunities } from "@/components/nova-opportunities";
import { opportunityKeyLabel, type Opportunity } from "@/lib/nova-opportunities";
import { generateCampaignTemplate } from "@/lib/nova-campaign";
import { CampaignTemplateCard } from "@/components/nova-campaign-card";

// Règles qui alimentent aujourd'hui le moteur — description honnête de ce
// qui tourne réellement (voir lib/nova-opportunities.ts), pas une liste de
// fonctionnalités promises. Chaque règle est déjà "active" au sens où elle
// est recalculée à chaque chargement de cette page depuis les vraies
// données ; il n'existe PAS encore de moteur qui déclenche une action sans
// supervision humaine (voir item 12 de la refonte : préparation + validation
// humaine d'abord, exécution automatique plus tard, une fois les intégrations
// Meta/Gmail/SMS branchées).
const AUTOMATION_RULES = [
  { trigger: "Un devis envoyé reste sans réponse plus de 3 jours", action: "NOVA propose une relance préparée" },
  { trigger: "Une facture dépasse sa date d'échéance", action: "NOVA propose une relance de paiement préparée" },
  { trigger: "Un client n'a plus de devis/facture depuis 180 jours", action: "NOVA propose une campagne de réactivation" },
  { trigger: "Un stock passe sous son seuil d'alerte", action: "NOVA signale la référence à réapprovisionner" },
  { trigger: "Un renouvellement (contrat, domaine, hébergement) approche", action: "NOVA le signale avant l'échéance" },
  { trigger: "Le planning de la semaine prochaine est nettement sous la moyenne habituelle", action: "NOVA propose de préparer une campagne locale" },
  { trigger: "Un prospect a un score de pertinence élevé et n'est pas encore contacté", action: "NOVA le remonte en priorité" },
];

function isRiskKey(key: string): boolean {
  return key === "overdue_invoices" || key === "low_stock" || key === "unanswered_quotes" || key.startsWith("activity_decline");
}

export default async function NovaActionsPage({ searchParams }: PageProps<"/nova/actions">) {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard");

  const workspaceId = membership.workspace_id;
  const plan = await getWorkspacePlan(workspaceId);
  const entitlements = getEntitlements(plan);
  const params = await searchParams;
  const campaignContext = typeof params.campaign === "string" ? params.campaign : undefined;

  if (!entitlements.canUseActionCenter) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-lg font-extrabold">Centre d&apos;actions NOVA non activé</h1>
          <p className="mt-2 text-[13px] text-muted">
            Le centre d&apos;actions (toutes les opportunités détectées par NOVA Growth Autopilot, au même endroit,
            avec historique et automatisations) fait partie du plan Complete Max. Votre workspace est actuellement
            sur le plan {PLAN_LABEL[plan]}. Activez-le depuis{" "}
            <a href="/abonnement" className="font-semibold text-accent">
              Abonnements
            </a>
            .
          </p>
        </Card>
      </AppShell>
    );
  }

  const supabase = await createClient();
  const [{ opportunities }, { data: historyRows }] = await Promise.all([
    getOpportunities(workspaceId),
    supabase
      .from("nova_action_log")
      .select("opportunity_key, status, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const actionNow: Opportunity[] = [];
  const alerts: Opportunity[] = [];
  const growth: Opportunity[] = [];
  for (const o of opportunities) {
    if (o.priority === "high") actionNow.push(o);
    else if (isRiskKey(o.key)) alerts.push(o);
    else growth.push(o);
  }

  // Généré uniquement si l'utilisateur arrive depuis une opportunité de type
  // "campagne" (voir detectUnderbooking/detectActivityDecline dans
  // lib/nova-opportunities.ts, qui pointent vers /nova/actions?campaign=...).
  const campaignTemplate = campaignContext
    ? await (async () => {
        const [{ data: businessProfile }, osProfile, { count: customerCount }] = await Promise.all([
          supabase.from("business_profiles").select("company_name, city").eq("workspace_id", workspaceId).maybeSingle(),
          getCachedBusinessOsProfile(workspaceId),
          supabase.from("customers").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
        ]);
        return generateCampaignTemplate({
          companyName: businessProfile?.company_name || "Votre entreprise",
          vertical: osProfile.vertical,
          context: campaignContext,
          city: businessProfile?.city || "",
          pastCustomerCount: customerCount ?? null,
        });
      })()
    : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Centre d&apos;actions NOVA</h1>
          <p className="mt-1 text-[13px] text-muted">
            Toutes les opportunités détectées par NOVA Growth Autopilot, au même endroit — calculées en direct
            depuis vos vraies données, jamais une performance ou un ROI inventé.
          </p>
        </div>

        {campaignTemplate && <CampaignTemplateCard template={campaignTemplate} />}

        {opportunities.length === 0 && (
          <Card>
            <p className="text-[13px] text-muted">
              Aucune opportunité détectée pour l&apos;instant. Cette page se met à jour automatiquement dès qu&apos;un
              signal réel apparaît dans vos données (devis, factures, stock, planning, prospects...).
            </p>
          </Card>
        )}

        {actionNow.length > 0 && (
          <NovaOpportunities
            workspaceId={workspaceId}
            opportunities={actionNow}
            title={`À faire maintenant (${actionNow.length})`}
            hideFooterNote
          />
        )}

        {growth.length > 0 && (
          <NovaOpportunities
            workspaceId={workspaceId}
            opportunities={growth}
            title={`Opportunités (${growth.length})`}
            hideFooterNote
          />
        )}

        {alerts.length > 0 && (
          <NovaOpportunities
            workspaceId={workspaceId}
            opportunities={alerts}
            title={`Alertes (${alerts.length})`}
            hideFooterNote
          />
        )}

        <Card>
          <h2 className="text-[13px] font-bold text-ink">Automatisations</h2>
          <p className="mt-1 text-[11.5px] text-muted">
            Les règles ci-dessous tournent déjà (elles alimentent les sections ci-dessus) — elles préparent une
            action et attendent votre validation. L&apos;exécution automatique sans supervision (envoi direct d&apos;un
            SMS/email) n&apos;est pas encore branchée : elle arrivera avec les intégrations Meta/Gmail/SMS.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {AUTOMATION_RULES.map((rule, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-[12px]">
                <span className="text-muted">
                  <span className="font-semibold text-ink">Quand</span> {rule.trigger}
                </span>
                <span className="font-semibold text-accent">→ {rule.action}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-[13px] font-bold text-ink">Historique</h2>
          {(historyRows ?? []).length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted">Aucune action traitée pour l&apos;instant.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {(historyRows ?? []).map((row, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-ink">{opportunityKeyLabel(row.opportunity_key)}</span>
                  <span className="flex items-center gap-2 text-faint">
                    <Badge tone={row.status === "done" ? "success" : "neutral"}>
                      {row.status === "done" ? "Fait" : "Ignoré"}
                    </Badge>
                    {new Date(row.updated_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
