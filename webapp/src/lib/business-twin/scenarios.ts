import type { GoalType, DataField, ScenarioResult, ScenarioAssumption, Confidence, PlanPreviewItem } from "./types";
import { fieldValueOr } from "./types";

// SIMULATION — génère les scénarios A (ne rien changer) / B (levier
// principal) / C (alternative) pour un objectif, à partir du snapshot
// (lib/business-twin/snapshot.ts). 100% déterministe (aucun appel
// Anthropic) : chaque scénario est produit par une règle fixe par
// goal_type, jamais par une estimation statistique qui se ferait passer
// pour un fait. Le chiffre d'affaires ou le nombre de clients gagnés futurs
// ne sont JAMAIS calculés ici — voir `qualitativeImpact` (texte).

function assumptionFromField(label: string, field: DataField<unknown>): ScenarioAssumption {
  if (field.status === "real") return { kind: "real", label, explanation: field.source };
  if (field.status === "estimated") return { kind: "estimated", label, explanation: field.basis };
  if (field.status === "hypothesis") return { kind: "hypothesis", label, explanation: field.assumption };
  return { kind: "missing", label, explanation: field.reason };
}

/**
 * Confiance dérivée du VOLUME de données réelles disponibles parmi les
 * champs pertinents pour ce scénario — jamais un pourcentage scientifique
 * inventé. Une majorité de champs "insufficient" -> confiance faible ; tous
 * réels -> confiance élevée ; un mélange -> moyenne.
 */
function deriveConfidence(fields: DataField<unknown>[]): { confidence: Confidence; explanation: string } {
  if (fields.length === 0) {
    return { confidence: "faible", explanation: "Aucune donnée pertinente disponible pour ce scénario." };
  }
  const real = fields.filter((f) => f.status === "real").length;
  const insufficient = fields.filter((f) => f.status === "insufficient").length;
  if (insufficient / fields.length > 0.5) {
    return { confidence: "faible", explanation: `${insufficient} donnée(s) sur ${fields.length} encore insuffisante(s) pour ce calcul.` };
  }
  if (insufficient > 0) {
    return { confidence: "moyenne", explanation: `${real} donnée(s) réelle(s) sur ${fields.length}, le reste est encore limité.` };
  }
  return { confidence: "elevee", explanation: `Basé sur ${real} donnée(s) réelle(s) de votre activité, sans donnée manquante identifiée.` };
}

function doNothingScenario(riskDescription: string): ScenarioResult {
  return {
    key: "do_nothing",
    label: "Scénario A — Ne rien changer",
    description: "Continuer sans action supplémentaire.",
    effort: "faible",
    confidence: "elevee",
    confidenceExplanation: "Aucune incertitude : ce scénario ne dépend d'aucune donnée future.",
    qualitativeImpact: riskDescription,
    isRecommended: false,
    assumptions: [],
    planPreview: [],
  };
}

function num(field: DataField<unknown>): number {
  const v = fieldValueOr(field, 0);
  return typeof v === "number" ? v : 0;
}

export function generateScenarios(goalType: GoalType, metrics: Record<string, DataField<unknown>>): ScenarioResult[] {
  switch (goalType) {
    case "revenue_growth":
      return revenueGrowthScenarios(metrics);
    case "new_customers":
    case "b2b_contracts":
      return newCustomersScenarios(metrics, goalType);
    case "fill_capacity":
      return fillCapacityScenarios(metrics);
    case "reactivate_customers":
      return reactivateCustomersScenarios(metrics);
    case "overdue_payments":
      return overduePaymentsScenarios(metrics);
    default:
      return genericScenarios(metrics, goalType);
  }
}

function revenueGrowthScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const unanswered = num(m.unansweredQuotesCount);
  const priority = num(m.priorityProspectsCount);
  const relevant = [m.unansweredQuotesCount, m.priorityProspectsCount, m.revenuePaidLast30d];
  const { confidence, explanation } = deriveConfidence(relevant);

  const scenarios: ScenarioResult[] = [
    doNothingScenario(
      unanswered > 0
        ? `${unanswered} devis déjà envoyé(s) reste(nt) sans relance — un risque de les voir accepter ailleurs ou être oubliés.`
        : "Aucun signal de risque immédiat identifié, mais aucune action ne sera lancée pour augmenter le CA.",
    ),
  ];

  const previewB: PlanPreviewItem[] = [];
  if (unanswered > 0) previewB.push({ label: "Devis à relancer", count: unanswered });
  if (priority > 0) previewB.push({ label: "Prospects prioritaires à contacter", count: priority });

  scenarios.push({
    key: "primary",
    label: "Scénario B — Relancer devis et prospects prioritaires",
    description: "Relancer les devis envoyés sans réponse et contacter les prospects les plus pertinents déjà identifiés.",
    effort: previewB.length > 0 ? "moyen" : "eleve",
    confidence,
    confidenceExplanation: explanation,
    qualitativeImpact:
      previewB.length > 0
        ? "Concentre l'effort sur des opportunités déjà identifiées dans vos données — impact réel dépendant du taux de réponse, non garanti."
        : "Peu de signaux exploitables actuellement dans vos données — l'impact réel de ce scénario reste incertain.",
    isRecommended: previewB.length > 0,
    assumptions: [assumptionFromField("Devis sans réponse", m.unansweredQuotesCount), assumptionFromField("Prospects prioritaires", m.priorityProspectsCount)],
    planPreview: previewB,
  });

  scenarios.push({
    key: "alternative",
    label: "Scénario C — Lancer une campagne + relances",
    description: "Combine une campagne de prospection/réactivation avec les relances du scénario B.",
    effort: "eleve",
    confidence,
    confidenceExplanation: explanation,
    qualitativeImpact: "Effort plus important, portée potentiellement plus large — aucune garantie de résultat chiffré.",
    isRecommended: false,
    assumptions: [assumptionFromField("Devis sans réponse", m.unansweredQuotesCount), assumptionFromField("Prospects prioritaires", m.priorityProspectsCount)],
    planPreview: [...previewB, { label: "Campagne préparée (contenu à valider)", count: null }],
  });

  return scenarios;
}

function newCustomersScenarios(m: Record<string, DataField<unknown>>, goalType: GoalType): ScenarioResult[] {
  const priority = num(m.priorityProspectsCount);
  const relevant = [m.priorityProspectsCount];
  const { confidence, explanation } = deriveConfidence(relevant);
  const isB2b = goalType === "b2b_contracts";

  const scenarios: ScenarioResult[] = [
    doNothingScenario(
      priority > 0
        ? `${priority} prospect(s) pertinent(s) déjà identifié(s) resteront non contactés.`
        : "Aucun prospect prioritaire identifié actuellement dans le CRM.",
    ),
  ];

  if (m.priorityProspectsCount.status === "insufficient") {
    scenarios.push({
      key: "primary",
      label: "Scénario B — Activer la prospection",
      description: "Le module Acquisition n'a pas encore assez de données pour prioriser des prospects.",
      effort: "eleve",
      confidence: "faible",
      confidenceExplanation: explanation,
      qualitativeImpact: "Impossible de prioriser sans recherche de prospects réelle — commencez par une recherche.",
      isRecommended: false,
      assumptions: [assumptionFromField("Prospects prioritaires", m.priorityProspectsCount)],
      planPreview: [{ label: "Lancer une recherche de prospects", count: null }],
    });
    return scenarios;
  }

  scenarios.push({
    key: "primary",
    label: `Scénario B — Contacter les prospects prioritaires${isB2b ? " (cible B2B)" : ""}`,
    description: "Séquence de contact (email + relance + script d'appel) sur les prospects au score le plus élevé.",
    effort: "moyen",
    confidence,
    confidenceExplanation: explanation,
    qualitativeImpact: priority > 0 ? "Cible les profils déjà signalés comme les plus pertinents — pas de garantie de conversion." : "Peu de prospects prioritaires actuellement : impact limité tant que le pipeline ne s'étoffe pas.",
    isRecommended: priority > 0,
    assumptions: [assumptionFromField("Prospects prioritaires", m.priorityProspectsCount)],
    planPreview: [{ label: "Prospects à contacter", count: priority }],
  });

  scenarios.push({
    key: "alternative",
    label: "Scénario C — Élargir la recherche + contacter",
    description: "Lance une nouvelle recherche de prospects en plus de contacter ceux déjà identifiés.",
    effort: "eleve",
    confidence,
    confidenceExplanation: explanation,
    qualitativeImpact: "Portée plus large, effort de recherche supplémentaire — impact réel non garanti.",
    isRecommended: false,
    assumptions: [assumptionFromField("Prospects prioritaires", m.priorityProspectsCount)],
    planPreview: [{ label: "Prospects à contacter", count: priority }, { label: "Nouvelle recherche à lancer", count: null }],
  });

  return scenarios;
}

function fillCapacityScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const relevant = [m.capacityNextWeek];
  const { confidence, explanation } = deriveConfidence(relevant);

  if (m.capacityNextWeek.status === "insufficient") {
    return [
      doNothingScenario("Pas assez d'historique de planning pour évaluer un risque de sous-remplissage."),
      {
        key: "primary",
        label: "Scénario B — Continuer à renseigner le planning",
        description: "Pas assez d'historique pour comparer objectivement la semaine à venir à une moyenne.",
        effort: "faible",
        confidence: "faible",
        confidenceExplanation: explanation,
        qualitativeImpact: "Aucune comparaison fiable possible pour l'instant — revenez sur cette simulation dans quelques semaines.",
        isRecommended: false,
        assumptions: [assumptionFromField("Capacité semaine prochaine", m.capacityNextWeek)],
        planPreview: [],
      },
    ];
  }

  const value = fieldValueOr(m.capacityNextWeek, { current: 0, average: 0 }) as { current: number; average: number };
  const belowAverage = value.average > 0 && value.current <= value.average * 0.5;

  const scenarios: ScenarioResult[] = [
    doNothingScenario(
      belowAverage
        ? `La semaine prochaine (${value.current}) est nettement en dessous de votre moyenne habituelle (${value.average}) — sans action, ces créneaux resteront probablement inoccupés.`
        : `La semaine prochaine (${value.current}) est proche de votre moyenne habituelle (${value.average}).`,
    ),
  ];

  scenarios.push({
    key: "primary",
    label: "Scénario B — Campagne locale + relance clients",
    description: "Préparer une campagne locale et relancer les clients pertinents pour occuper les créneaux disponibles.",
    effort: "moyen",
    confidence,
    confidenceExplanation: explanation,
    qualitativeImpact: belowAverage
      ? "Semaine identifiée comme sous-remplie par rapport à votre historique — bon candidat pour une campagne ciblée."
      : "Le remplissage est déjà proche de la normale — l'effet d'une campagne serait probablement plus limité.",
    isRecommended: belowAverage,
    assumptions: [assumptionFromField("Capacité semaine prochaine", m.capacityNextWeek)],
    planPreview: [{ label: "Campagne locale préparée", count: null }, { label: "Clients à relancer", count: null }],
  });

  return scenarios;
}

function reactivateCustomersScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const relevant = [m.customersCount];
  const { confidence, explanation } = deriveConfidence(relevant);
  return [
    doNothingScenario("Les clients inactifs identifiés resteront sans nouveau contact."),
    {
      key: "primary",
      label: "Scénario B — Campagne de réactivation",
      description: "Contacter les clients sans devis/facture récent avec une offre de reprise de contact.",
      effort: "moyen",
      confidence,
      confidenceExplanation: explanation,
      qualitativeImpact: "Cible des clients ayant déjà fait confiance à l'entreprise — impact réel dépendant du taux de réponse.",
      isRecommended: true,
      assumptions: [assumptionFromField("Clients enregistrés", m.customersCount)],
      planPreview: [{ label: "Clients inactifs à contacter", count: null }],
    },
  ];
}

function overduePaymentsScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const count = num(m.overdueInvoicesCount);
  const amount = num(m.overdueInvoicesAmount);
  const relevant = [m.overdueInvoicesCount, m.overdueInvoicesAmount];
  const { confidence, explanation } = deriveConfidence(relevant);

  return [
    doNothingScenario(count > 0 ? `${count} facture(s) en retard (${amount.toFixed(0)} € au total) resteront impayées sans relance.` : "Aucune facture en retard identifiée actuellement."),
    {
      key: "primary",
      label: "Scénario B — Relancer les factures en retard",
      description: "Préparer une relance pour chaque facture en retard de paiement.",
      effort: "faible",
      confidence,
      confidenceExplanation: explanation,
      qualitativeImpact: count > 0 ? `${amount.toFixed(0)} € de factures en retard concernées — la relance ne garantit pas le paiement.` : "Rien à relancer actuellement.",
      isRecommended: count > 0,
      assumptions: [assumptionFromField("Factures en retard", m.overdueInvoicesCount), assumptionFromField("Montant en retard", m.overdueInvoicesAmount)],
      planPreview: count > 0 ? [{ label: "Factures à relancer", count }] : [],
    },
  ];
}

/**
 * Pour les objectifs sans règle déterministe suffisamment fiable
 * aujourd'hui (marge, stock excédentaire, fidélisation) ou un objectif
 * libre non classé — honnêteté plutôt qu'invention : on dit explicitement
 * quelle donnée manque au lieu de fabriquer un scénario chiffré.
 */
function genericScenarios(m: Record<string, DataField<unknown>>, goalType: GoalType): ScenarioResult[] {
  const reasonByGoal: Record<string, string> = {
    margin_improvement: "Aucune donnée de coût/marge fiable n'est encore suivie dans ProspectFlow.",
    stock_reduction: "ProspectFlow suit le stock bas, pas le surstock — aucun signal de stock excédentaire n'existe encore.",
    retention: "Le taux de renouvellement réel n'est pas encore calculé automatiquement.",
    custom: "Objectif libre — pas de règle déterministe prédéfinie pour ce type d'objectif.",
  };
  const reason = reasonByGoal[goalType] ?? reasonByGoal.custom;

  return [
    doNothingScenario("Aucune action automatique proposée pour cet objectif pour l'instant."),
    {
      key: "primary",
      label: "Scénario B — Revue manuelle avec NOVA",
      description: "Discutez de cet objectif avec NOVA pour explorer les données disponibles au cas par cas.",
      effort: "moyen",
      confidence: "faible",
      confidenceExplanation: reason,
      qualitativeImpact: "Pas de scénario chiffré disponible tant que la donnée nécessaire n'est pas suivie dans ProspectFlow.",
      isRecommended: false,
      assumptions: Object.entries(m).map(([key, field]) => assumptionFromField(key, field)),
      planPreview: [{ label: "Échanger avec NOVA sur cet objectif", count: null }],
    },
  ];
}
