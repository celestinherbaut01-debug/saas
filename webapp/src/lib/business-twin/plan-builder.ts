import type { BusinessOsVertical } from "@/lib/business-os";
import { generateCampaignTemplate } from "@/lib/nova-campaign";
import { listInactiveCustomerIds } from "@/lib/nova-opportunities";
import type { GoalType, MissionActionDraft, TypedProspect } from "./types";

// PLAN — transforme un scénario CHOISI en actions concrètes, à partir de
// données FRAÎCHES (chargées au moment du clic sur "Appliquer le plan", pas
// au moment de la simulation) : entre la simulation et l'application, un
// devis peut avoir été payé, un prospect contacté — on ne fige jamais une
// liste d'IDs obsolète dans le scénario lui-même (voir ScenarioResult.
// planPreview, qui ne contient que des libellés/compteurs, jamais d'IDs).
//
// SUITE À L'AUDIT : le dispatch se fait maintenant sur `lever` (le levier
// RÉEL choisi par scenarios.ts, ex. "reactivation_direct" vs
// "reactivation_bulk_campaign"), pas sur `scenarioKey` (qui ne dit que la
// position A/B/C). Deux leviers différents produisent maintenant des
// actions structurellement différentes (une action de campagne unique vs N
// actions individuelles), pas la même liste redécorée.

export interface PlanBuilderDocument {
  id: string;
  doc_type: "quote" | "invoice";
  status: string;
  issued_at: string;
  due_at: string | null;
  /** Utilisé uniquement par snapshot.ts (calcul du CA encaissé) — optionnel ici, le plan-builder ne s'en sert pas. */
  paid_at?: string | null;
  number: string;
  customer_id: string | null;
  total_ttc: number;
}

export interface PlanBuilderCustomer {
  id: string;
  name: string;
}

export interface PlanBuilderContext {
  goalType: GoalType;
  /** Levier réel choisi (voir ScenarioResult.lever dans lib/business-twin/scenarios.ts) — pilote QUELLES actions sont générées. */
  lever: string;
  companyName: string;
  vertical: BusinessOsVertical;
  city: string;
  prospects: TypedProspect[];
  documents: PlanBuilderDocument[];
  customers: PlanBuilderCustomer[];
}

const MAX_ITEMS = 12;

export function buildPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  switch (ctx.lever) {
    case "do_nothing":
    case "capacity_wait_for_data":
      return [];
    case "sales_followup":
      return draftsFromQuotes(unansweredQuotes(ctx));
    case "acquisition_direct":
      return draftsFromProspects(priorityProspects(ctx));
    case "acquisition_launch_search":
      return [{ actionType: "tache_crm", title: "Lancer une nouvelle recherche de prospects", reason: "Élargir le pipeline — aucun prospect prioritaire identifié actuellement." }];
    case "marketing_campaign":
      return [campaignDraft(ctx, campaignContextLabel(ctx.goalType))];
    case "reactivation_direct":
      return draftsFromInactiveCustomers(inactiveCustomerIds(ctx), customersById(ctx));
    case "reactivation_bulk_campaign":
      return [campaignDraft(ctx, "Réactivation clients")];
    case "finance_batch":
      return draftsFromInvoices(overdueInvoices(ctx));
    case "finance_triage": {
      const invoices = overdueInvoicesSortedByUrgency(ctx).slice(0, 5);
      return draftsFromInvoices(invoices);
    }
    case "manual_review_nova":
    default:
      return [
        {
          actionType: "autre",
          title: "Discuter de cet objectif avec NOVA",
          reason: "Pas de règle déterministe prédéfinie pour ce levier — NOVA peut explorer vos données au cas par cas.",
        },
      ];
  }
}

function campaignContextLabel(goalType: GoalType): string {
  const labels: Record<GoalType, string> = {
    revenue_growth: "Croissance du chiffre d'affaires",
    new_customers: "Nouveaux clients",
    b2b_contracts: "Nouveaux contrats B2B",
    fill_capacity: "Remplissage du planning",
    reactivate_customers: "Réactivation clients",
    overdue_payments: "Impayés",
    margin_improvement: "Marge",
    stock_reduction: "Déstockage",
    retention: "Fidélisation",
    custom: "Objectif personnalisé",
  };
  return labels[goalType];
}

function priorityProspects(ctx: PlanBuilderContext): TypedProspect[] {
  const NOT_CONTACTED = new Set(["new", "to_contact"]);
  return ctx.prospects.filter((p) => p.quality_score >= 70 && NOT_CONTACTED.has(p.status)).slice(0, MAX_ITEMS);
}

function unansweredQuotes(ctx: PlanBuilderContext): PlanBuilderDocument[] {
  return ctx.documents.filter((d) => d.doc_type === "quote" && d.status === "sent").slice(0, MAX_ITEMS);
}

function overdueInvoices(ctx: PlanBuilderContext): PlanBuilderDocument[] {
  const now = Date.now();
  return ctx.documents
    .filter((d) => d.doc_type === "invoice" && d.status !== "paid" && d.status !== "canceled" && d.due_at && new Date(d.due_at).getTime() < now)
    .slice(0, MAX_ITEMS);
}

/** Les plus anciennes/montants les plus élevés d'abord — voir le levier "finance_triage". */
function overdueInvoicesSortedByUrgency(ctx: PlanBuilderContext): PlanBuilderDocument[] {
  const now = Date.now();
  return ctx.documents
    .filter((d) => d.doc_type === "invoice" && d.status !== "paid" && d.status !== "canceled" && d.due_at && new Date(d.due_at).getTime() < now)
    .sort((a, b) => {
      const daysLateA = now - new Date(a.due_at as string).getTime();
      const daysLateB = now - new Date(b.due_at as string).getTime();
      if (daysLateA !== daysLateB) return daysLateB - daysLateA;
      return b.total_ttc - a.total_ttc;
    });
}

function inactiveCustomerIds(ctx: PlanBuilderContext): string[] {
  return listInactiveCustomerIds(ctx.customers, ctx.documents, 180);
}

function customersById(ctx: PlanBuilderContext): Map<string, string> {
  return new Map(ctx.customers.map((c) => [c.id, c.name]));
}

function draftsFromQuotes(quotes: PlanBuilderDocument[]): MissionActionDraft[] {
  return quotes.map((d) => ({
    actionType: "relance_devis",
    title: `Relancer le devis ${d.number || d.id.slice(0, 8)}`,
    reason: `Envoyé le ${new Date(d.issued_at).toLocaleDateString("fr-FR")}, toujours sans réponse.`,
    targetRef: { table: "documents", id: d.id },
  }));
}

function draftsFromInvoices(invoices: PlanBuilderDocument[]): MissionActionDraft[] {
  return invoices.map((d) => ({
    actionType: "relance_facture",
    title: `Relancer la facture ${d.number || d.id.slice(0, 8)}`,
    reason: `Échéance dépassée${d.due_at ? ` (${new Date(d.due_at).toLocaleDateString("fr-FR")})` : ""}, ${d.total_ttc} € TTC.`,
    targetRef: { table: "documents", id: d.id },
  }));
}

function draftsFromProspects(prospects: TypedProspect[]): MissionActionDraft[] {
  return prospects.map((p) => ({
    actionType: "contact_prospect",
    title: `Contacter ${p.company_name}`,
    reason: `Score de pertinence ${p.quality_score}/100, pas encore contacté.`,
    targetRef: { table: "prospects", id: p.id },
  }));
}

function draftsFromInactiveCustomers(ids: string[], customersMap: Map<string, string>): MissionActionDraft[] {
  return ids.slice(0, MAX_ITEMS).map((id) => ({
    actionType: "reactivation_client",
    title: `Réactiver ${customersMap.get(id) ?? "un client"}`,
    reason: "Aucun devis ni facture depuis plus de 6 mois.",
    targetRef: { table: "customers", id },
  }));
}

function campaignDraft(ctx: PlanBuilderContext, context: string): MissionActionDraft {
  const template = generateCampaignTemplate({
    companyName: ctx.companyName,
    vertical: ctx.vertical,
    context,
    city: ctx.city,
    pastCustomerCount: ctx.customers.length > 0 ? ctx.customers.length : null,
  });
  return {
    actionType: "campagne",
    title: `Préparer une campagne — ${context}`,
    reason: "Contenu prêt à relire et adapter (aucun envoi automatique).",
    preparedContent: template as unknown as Record<string, unknown>,
  };
}
