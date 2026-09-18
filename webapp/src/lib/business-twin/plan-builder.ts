import type { BusinessOsVertical } from "@/lib/business-os";
import { generateCampaignTemplate } from "@/lib/nova-campaign";
import { listInactiveCustomerIds } from "@/lib/nova-opportunities";
import type { GoalType, ScenarioKey, MissionActionDraft, TypedProspect } from "./types";

// PLAN — transforme un scénario CHOISI en actions concrètes, à partir de
// données FRAÎCHES (chargées au moment du clic sur "Appliquer le plan", pas
// au moment de la simulation) : entre la simulation et l'application, un
// devis peut avoir été payé, un prospect contacté — on ne fige jamais une
// liste d'IDs obsolète dans le scénario lui-même (voir ScenarioResult.
// planPreview, qui ne contient que des libellés/compteurs, jamais d'IDs).

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
  scenarioKey: ScenarioKey;
  companyName: string;
  vertical: BusinessOsVertical;
  city: string;
  prospects: TypedProspect[];
  documents: PlanBuilderDocument[];
  customers: PlanBuilderCustomer[];
}

const MAX_ITEMS = 12;

export function buildPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  if (ctx.scenarioKey === "do_nothing") return [];

  switch (ctx.goalType) {
    case "revenue_growth":
      return revenueGrowthPlan(ctx);
    case "new_customers":
    case "b2b_contracts":
      return newCustomersPlan(ctx);
    case "fill_capacity":
      return fillCapacityPlan(ctx);
    case "reactivate_customers":
      return reactivateCustomersPlan(ctx);
    case "overdue_payments":
      return overduePaymentsPlan(ctx);
    default:
      return genericPlan();
  }
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

function draftsFromInactiveCustomers(ids: string[], customersById: Map<string, string>): MissionActionDraft[] {
  return ids.slice(0, MAX_ITEMS).map((id) => ({
    actionType: "reactivation_client",
    title: `Réactiver ${customersById.get(id) ?? "un client"}`,
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

function revenueGrowthPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  const drafts = [...draftsFromQuotes(unansweredQuotes(ctx)), ...draftsFromProspects(priorityProspects(ctx))];
  if (ctx.scenarioKey === "alternative") drafts.push(campaignDraft(ctx, "Croissance du chiffre d'affaires"));
  return drafts;
}

function newCustomersPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  const drafts = draftsFromProspects(priorityProspects(ctx));
  if (ctx.scenarioKey === "alternative") {
    drafts.push({
      actionType: "tache_crm",
      title: "Lancer une nouvelle recherche de prospects",
      reason: "Élargir le pipeline au-delà des prospects déjà identifiés.",
    });
  }
  return drafts;
}

function fillCapacityPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  const customersById = new Map(ctx.customers.map((c) => [c.id, c.name]));
  const inactiveIds = listInactiveCustomerIds(ctx.customers, ctx.documents, 180);
  return [campaignDraft(ctx, "Remplissage du planning"), ...draftsFromInactiveCustomers(inactiveIds, customersById)];
}

function reactivateCustomersPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  const customersById = new Map(ctx.customers.map((c) => [c.id, c.name]));
  const inactiveIds = listInactiveCustomerIds(ctx.customers, ctx.documents, 180);
  return draftsFromInactiveCustomers(inactiveIds, customersById);
}

function overduePaymentsPlan(ctx: PlanBuilderContext): MissionActionDraft[] {
  return draftsFromInvoices(overdueInvoices(ctx));
}

function genericPlan(): MissionActionDraft[] {
  return [
    {
      actionType: "autre",
      title: "Discuter de cet objectif avec NOVA",
      reason: "Pas de règle déterministe prédéfinie pour ce type d'objectif — NOVA peut explorer vos données au cas par cas.",
    },
  ];
}
