import type { GoalType } from "./types";

// Catalogue V1 des objectifs (point 4 de la spec) — volontairement large
// mais contrôlé : 9 types précis + "custom" pour tout le reste. Chaque
// verticale peut mettre en avant un sous-ensemble différent (voir
// RECOMMENDED_GOALS_BY_VERTICAL) sans jamais empêcher les autres — un
// garagiste peut très bien vouloir "signer des contrats B2B" (flotte
// d'entreprise), on ne lui retire pas l'option.

export interface GoalTemplate {
  type: GoalType;
  icon: string;
  buttonLabel: string;
  description: string;
  targetUnit: "eur" | "clients" | "contracts" | "slots" | "percent" | null;
  /** Mots-clés pour la classification sans IA d'un objectif écrit en texte libre (Phase 1 — un vrai NLP viendra avec Anthropic, voir Phase 2). */
  keywords: string[];
}

export const GOAL_CATALOG: GoalTemplate[] = [
  {
    type: "revenue_growth",
    icon: "💰",
    buttonLabel: "Faire plus de CA",
    description: "Augmenter le chiffre d'affaires sur une période donnée.",
    targetUnit: "eur",
    keywords: ["chiffre d'affaires", "ca ", "revenu", "vendre plus", "gagner plus", "€", "euros"],
  },
  {
    type: "new_customers",
    icon: "🎯",
    buttonLabel: "Trouver de nouveaux clients",
    description: "Acquérir de nouveaux clients.",
    targetUnit: "clients",
    keywords: ["nouveaux clients", "trouver des clients", "prospects", "acquisition"],
  },
  {
    type: "fill_capacity",
    icon: "📅",
    buttonLabel: "Remplir mon planning",
    description: "Occuper les créneaux ou la capacité disponible.",
    targetUnit: "slots",
    keywords: ["planning", "créneaux", "remplir", "capacité", "agenda", "réservations", "créneau"],
  },
  {
    type: "b2b_contracts",
    icon: "📄",
    buttonLabel: "Signer des contrats B2B",
    description: "Signer de nouveaux contrats professionnels récurrents.",
    targetUnit: "contracts",
    keywords: ["contrats", "b2b", "professionnels", "récurrent", "entreprises"],
  },
  {
    type: "reactivate_customers",
    icon: "👤",
    buttonLabel: "Réactiver mes anciens clients",
    description: "Reprendre contact avec des clients devenus inactifs.",
    targetUnit: "clients",
    keywords: ["réactiver", "anciens clients", "inactifs", "reprendre contact"],
  },
  {
    type: "overdue_payments",
    icon: "⚠️",
    buttonLabel: "Réduire mes impayés",
    description: "Faire baisser les factures en retard de paiement.",
    targetUnit: "eur",
    keywords: ["impayés", "factures en retard", "retard de paiement", "relance facture"],
  },
  {
    type: "margin_improvement",
    icon: "📈",
    buttonLabel: "Augmenter ma marge",
    description: "Améliorer la marge sur les ventes.",
    targetUnit: "percent",
    keywords: ["marge", "rentabilité", "profit"],
  },
  {
    type: "stock_reduction",
    icon: "📦",
    buttonLabel: "Vider un stock",
    description: "Écouler un stock excédentaire.",
    targetUnit: null,
    keywords: ["stock", "écouler", "déstocker", "invendus", "vider"],
  },
  {
    type: "retention",
    icon: "🔁",
    buttonLabel: "Augmenter le taux de renouvellement",
    description: "Augmenter la fidélisation et le taux de renouvellement.",
    targetUnit: "percent",
    keywords: ["fidélisation", "renouvellement", "rétention", "fidéliser"],
  },
  {
    type: "custom",
    icon: "✏️",
    buttonLabel: "Autre objectif",
    description: "Décrivez votre objectif avec vos propres mots.",
    targetUnit: null,
    keywords: [],
  },
];

export function goalTemplate(type: GoalType): GoalTemplate {
  return GOAL_CATALOG.find((g) => g.type === type) ?? GOAL_CATALOG[GOAL_CATALOG.length - 1];
}

/**
 * Classification par mots-clés, sans IA (Phase 1 — voir point 23 de la
 * spec). Volontairement simple et prévisible : un objectif mal classé reste
 * "custom", jamais un mauvais type assigné avec confiance. La compréhension
 * fine d'un texte libre complexe est explicitement repoussée à la Phase 2
 * (Anthropic), pas simulée ici par des règles de plus en plus tordues.
 */
export function classifyGoalText(text: string): GoalType {
  const normalized = text.toLowerCase();
  for (const g of GOAL_CATALOG) {
    if (g.type === "custom") continue;
    if (g.keywords.some((k) => normalized.includes(k))) return g.type;
  }
  return "custom";
}

/**
 * Extrait un nombre depuis un texte libre (ex. "+5000€ ce mois-ci" -> 5000).
 * Best effort UNIQUEMENT — l'appelant doit traiter le résultat comme une
 * hypothèse (voir hypothesisField dans types.ts), jamais comme une donnée
 * réelle : rien ne garantit que ce nombre est bien la cible visée par
 * l'utilisateur plutôt qu'un autre chiffre présent dans le texte.
 */
export function extractTargetNumber(text: string): number | null {
  const match = text.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
