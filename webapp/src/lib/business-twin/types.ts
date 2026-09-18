import type { ProspectStatus } from "@/lib/crm-status";
import type { BusinessOsVertical } from "@/lib/business-os";

// PROSPECTFLOW BUSINESS TWIN — types partagés par tout le pipeline
// OBJECTIF -> SITUATION -> SIMULATION -> PLAN -> ACTIONS -> RÉSULTATS.
//
// Règle non négociable (voir la conversation produit) : AUCUNE valeur ne
// doit se présenter comme un fait sans dire d'où elle vient. `DataField<T>`
// est l'unique façon de porter une donnée dans ce module — impossible
// d'écrire un nombre nu dans un snapshot ou un scénario sans passer par un
// des constructeurs ci-dessous, qui forcent à choisir real/estimated/
// hypothesis/insufficient.

export type DataField<T> =
  | { status: "real"; value: T; source: string }
  | { status: "estimated"; value: T; basis: string }
  | { status: "hypothesis"; value: T; assumption: string }
  | { status: "insufficient"; reason: string; whatWouldHelp: string };

export function realField<T>(value: T, source: string): DataField<T> {
  return { status: "real", value, source };
}
export function estimatedField<T>(value: T, basis: string): DataField<T> {
  return { status: "estimated", value, basis };
}
export function hypothesisField<T>(value: T, assumption: string): DataField<T> {
  return { status: "hypothesis", value, assumption };
}
export function insufficientField<T>(reason: string, whatWouldHelp: string): DataField<T> {
  return { status: "insufficient", reason, whatWouldHelp };
}

/** Valeur exploitable pour un calcul, avec un repli explicite si la donnée manque — jamais utilisée pour l'AFFICHER telle quelle (le statut doit rester visible côté UI). */
export function fieldValueOr<T>(field: DataField<T>, fallback: T): T {
  return field.status === "insufficient" ? fallback : field.value;
}

export type GoalType =
  | "revenue_growth"
  | "new_customers"
  | "fill_capacity"
  | "b2b_contracts"
  | "reactivate_customers"
  | "overdue_payments"
  | "margin_improvement"
  | "stock_reduction"
  | "retention"
  | "custom";

export type Effort = "faible" | "moyen" | "eleve";
export type Confidence = "faible" | "moyenne" | "elevee";
export type MissionStatus = "active" | "at_risk" | "succeeded" | "failed" | "abandoned";

export interface ScenarioAssumption {
  kind: "real" | "estimated" | "hypothesis" | "missing";
  label: string;
  explanation: string;
}

export interface PlanPreviewItem {
  label: string;
  count: number | null;
}

export type ScenarioKey = "do_nothing" | "primary" | "alternative";

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  description: string;
  effort: Effort;
  confidence: Confidence;
  confidenceExplanation: string;
  /** Qualitatif UNIQUEMENT — jamais un montant futur promis. */
  qualitativeImpact: string;
  isRecommended: boolean;
  assumptions: ScenarioAssumption[];
  planPreview: PlanPreviewItem[];
}

export type MissionActionType =
  | "relance_devis"
  | "contact_prospect"
  | "upsell"
  | "campagne"
  | "appel"
  | "tache_crm"
  | "relance_facture"
  | "reactivation_client"
  | "autre";

export interface MissionActionDraft {
  actionType: MissionActionType;
  title: string;
  reason: string;
  targetRef?: { table: string; id: string };
  preparedContent?: Record<string, unknown>;
}

export interface BusinessTwinSnapshot {
  vertical: BusinessOsVertical;
  capturedAt: string;
  metrics: Record<string, DataField<unknown>>;
}

export interface TypedProspect {
  id: string;
  company_name: string;
  quality_score: number;
  status: ProspectStatus;
}
