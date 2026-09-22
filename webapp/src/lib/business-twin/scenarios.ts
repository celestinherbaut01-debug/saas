import type { GoalType, DataField, ScenarioResult, ScenarioAssumption, Confidence, PlanPreviewItem, SignalCategory } from "./types";
import { fieldValueOr } from "./types";

// SIMULATION — génère les scénarios A (ne rien changer) / B / C pour un
// objectif, à partir du snapshot (lib/business-twin/snapshot.ts).
//
// SUITE À L'AUDIT (voir conversation produit) : l'ancienne version
// dispatchait uniquement sur `goalType`, avec une fonction par type qui
// codait EN DUR un unique "levier" (ex. toujours devis+prospects pour
// revenue_growth) ; le scénario C n'était presque jamais une vraie
// alternative — juste le scénario B plus une ligne. Cette version compose
// les scénarios à partir d'un LEVIER (SignalCategory) réellement différent
// à chaque fois : `buildScenarioFromLever` transforme un `LeverCandidate`
// (signal + action) en ScenarioResult, et chaque fonction par objectif
// choisit 2 leviers de catégories DIFFÉRENTES plutôt que de dupliquer le
// même levier avec plus ou moins de contenu. Un levier "marketing" (créer
// une campagne) est toujours disponible comme filet de sécurité — jamais
// pour remplacer un vrai signal, seulement pour combler un deuxième
// scénario quand un seul signal réactif existe.
//
// 100% déterministe (aucun appel Anthropic). Le chiffre d'affaires ou le
// nombre de clients gagnés futurs ne sont JAMAIS calculés ici — voir
// `qualitativeImpact` (texte).

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
    return { confidence: "moyenne", explanation: "Levier toujours disponible, indépendant du volume de données actuel." };
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

/** Bucket un compte en tranche — le fingerprint doit ignorer les variations de +/-1 non significatives tout en réagissant à un vrai changement de situation (voir item 3 : "valeurs importantes"). */
function bucketCount(n: number): string {
  if (n <= 0) return "0";
  if (n <= 2) return "1-2";
  if (n <= 5) return "3-5";
  if (n <= 10) return "6-10";
  if (n <= 20) return "11-20";
  return "20+";
}

function num(field: DataField<unknown>): number {
  const v = fieldValueOr(field, 0);
  return typeof v === "number" ? v : 0;
}

function doNothingScenario(riskDescription: string, category: SignalCategory, fingerprintSeed: string): ScenarioResult {
  return {
    key: "do_nothing",
    lever: "do_nothing",
    signalCategory: category,
    label: "Scénario A — Ne rien changer",
    description: "Continuer sans action supplémentaire.",
    effort: "faible",
    confidence: "elevee",
    confidenceExplanation: "Aucune incertitude : ce scénario ne dépend d'aucune donnée future.",
    qualitativeImpact: riskDescription,
    isRecommended: false,
    assumptions: [],
    planPreview: [],
    fingerprintSeed: `do_nothing:${fingerprintSeed}`,
  };
}

interface LeverCandidate {
  lever: string;
  category: SignalCategory;
  label: string;
  description: string;
  qualitativeImpact: string;
  effort: "faible" | "moyen" | "eleve";
  relevantFields: DataField<unknown>[];
  assumptionLabels: [string, DataField<unknown>][];
  planPreview: PlanPreviewItem[];
  fingerprintSeed: string;
  isRecommended: boolean;
}

function buildScenarioFromLever(position: "primary" | "alternative", label: string, candidate: LeverCandidate): ScenarioResult {
  const { confidence, explanation } = deriveConfidence(candidate.relevantFields);
  return {
    key: position,
    lever: candidate.lever,
    signalCategory: candidate.category,
    label,
    description: candidate.description,
    effort: candidate.effort,
    confidence,
    confidenceExplanation: explanation,
    qualitativeImpact: candidate.qualitativeImpact,
    isRecommended: candidate.isRecommended,
    assumptions: candidate.assumptionLabels.map(([l, f]) => assumptionFromField(l, f)),
    planPreview: candidate.planPreview,
    fingerprintSeed: candidate.fingerprintSeed,
  };
}

/** Levier toujours disponible (aucune donnée requise) — jamais utilisé seul quand un vrai signal existe, seulement pour compléter un deuxième scénario réellement différent. */
function marketingCampaignLever(contextLabel: string): LeverCandidate {
  return {
    lever: "marketing_campaign",
    category: "marketing",
    label: `Campagne — ${contextLabel}`,
    description: `Préparer une campagne (contenu prêt à valider) pour ${contextLabel.toLowerCase()}.`,
    qualitativeImpact: "Levier disponible même sans signal fort dans vos données actuelles — portée dépendant de la diffusion réelle, jamais garantie.",
    effort: "moyen",
    relevantFields: [],
    assumptionLabels: [],
    planPreview: [{ label: "Campagne préparée (contenu à valider)", count: null }],
    fingerprintSeed: `marketing_campaign:${contextLabel}`,
    isRecommended: false,
  };
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

/**
 * revenue_growth : deux leviers de nature différente — SALES (sécuriser le
 * pipeline déjà engagé : devis envoyés) vs ACQUISITION (activer de nouveaux
 * prospects déjà identifiés). Le marketing comble un levier manquant plutôt
 * que de dupliquer celui déjà choisi.
 */
function revenueGrowthScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const unanswered = num(m.unansweredQuotesCount);
  const priority = num(m.priorityProspectsCount);

  const candidates: LeverCandidate[] = [];
  if (unanswered > 0) {
    candidates.push({
      lever: "sales_followup",
      category: "sales",
      label: "Sécuriser le pipeline existant",
      description: "Relancer les devis déjà envoyés qui n'ont pas encore de réponse.",
      qualitativeImpact: "Cible des opportunités déjà engagées — impact réel dépendant du taux de réponse, non garanti.",
      effort: "faible",
      relevantFields: [m.unansweredQuotesCount],
      assumptionLabels: [["Devis sans réponse", m.unansweredQuotesCount]],
      planPreview: [{ label: "Devis à relancer", count: unanswered }],
      fingerprintSeed: `sales_followup:unanswered=${bucketCount(unanswered)}`,
      isRecommended: true,
    });
  }
  if (priority > 0) {
    candidates.push({
      lever: "acquisition_direct",
      category: "acquisition",
      label: "Activer de nouveaux prospects",
      description: "Contacter les prospects les plus pertinents déjà identifiés dans le CRM.",
      qualitativeImpact: "Cible des profils déjà signalés comme pertinents — pas de garantie de conversion.",
      effort: "moyen",
      relevantFields: [m.priorityProspectsCount],
      assumptionLabels: [["Prospects prioritaires", m.priorityProspectsCount]],
      planPreview: [{ label: "Prospects prioritaires à contacter", count: priority }],
      fingerprintSeed: `acquisition_direct:priority=${bucketCount(priority)}`,
      isRecommended: candidates.length === 0,
    });
  }
  while (candidates.length < 2) candidates.push(marketingCampaignLever("Croissance du chiffre d'affaires"));

  const risk =
    unanswered > 0
      ? `${unanswered} devis déjà envoyé(s) reste(nt) sans relance — un risque de les voir accepter ailleurs ou être oubliés.`
      : "Aucun signal de risque immédiat identifié, mais aucune action ne sera lancée pour augmenter le CA.";

  return [
    doNothingScenario(risk, "sales", `revenue_growth:unanswered=${bucketCount(unanswered)},priority=${bucketCount(priority)}`),
    buildScenarioFromLever("primary", `Scénario B — ${candidates[0].label}`, candidates[0]),
    buildScenarioFromLever("alternative", `Scénario C — ${candidates[1].label}`, candidates[1]),
  ];
}

/**
 * new_customers / b2b_contracts : ACQUISITION directe (contacter le
 * pipeline déjà identifié) vs MARKETING (campagne pour générer des leads
 * entrants) — deux canaux différents, pas "contacter plus de monde".
 */
function newCustomersScenarios(m: Record<string, DataField<unknown>>, goalType: GoalType): ScenarioResult[] {
  const priority = num(m.priorityProspectsCount);
  const isB2b = goalType === "b2b_contracts";

  if (m.priorityProspectsCount.status === "insufficient") {
    return [
      doNothingScenario("Aucun prospect prioritaire identifié actuellement dans le CRM.", "acquisition", "new_customers:insufficient"),
      buildScenarioFromLever("primary", "Scénario B — Activer la prospection", {
        lever: "acquisition_launch_search",
        category: "acquisition",
        label: "Activer la prospection",
        description: "Le module Acquisition n'a pas encore assez de données pour prioriser des prospects.",
        qualitativeImpact: "Impossible de prioriser sans recherche de prospects réelle — commencez par une recherche.",
        effort: "eleve",
        relevantFields: [m.priorityProspectsCount],
        assumptionLabels: [["Prospects prioritaires", m.priorityProspectsCount]],
        planPreview: [{ label: "Lancer une recherche de prospects", count: null }],
        fingerprintSeed: "acquisition_launch_search",
        isRecommended: false,
      }),
    ];
  }

  const direct: LeverCandidate = {
    lever: "acquisition_direct",
    category: "acquisition",
    label: `Contacter les prospects prioritaires${isB2b ? " (cible B2B)" : ""} déjà identifiés`,
    description: "Séquence de contact (email + relance + script d'appel) sur les prospects au score le plus élevé.",
    qualitativeImpact: priority > 0 ? "Cible les profils déjà signalés comme les plus pertinents — pas de garantie de conversion." : "Peu de prospects prioritaires actuellement : impact limité tant que le pipeline ne s'étoffe pas.",
    effort: "moyen",
    relevantFields: [m.priorityProspectsCount],
    assumptionLabels: [["Prospects prioritaires", m.priorityProspectsCount]],
    planPreview: [{ label: "Prospects à contacter", count: priority }],
    fingerprintSeed: `acquisition_direct:priority=${bucketCount(priority)}`,
    isRecommended: priority > 0,
  };
  const marketing = marketingCampaignLever(isB2b ? "Nouveaux contrats B2B" : "Nouveaux clients");

  return [
    doNothingScenario(
      priority > 0 ? `${priority} prospect(s) pertinent(s) déjà identifié(s) resteront non contactés.` : "Aucun prospect prioritaire identifié actuellement dans le CRM.",
      "acquisition",
      `new_customers:priority=${bucketCount(priority)}`,
    ),
    buildScenarioFromLever("primary", `Scénario B — ${direct.label}`, direct),
    buildScenarioFromLever("alternative", `Scénario C — ${marketing.label}`, marketing),
  ];
}

/**
 * fill_capacity : exactement l'exemple donné par le produit — RÉACTIVATION
 * (contacter d'anciens clients pertinents) vs MARKETING (promotion locale
 * d'une prestation), deux leviers réellement indépendants.
 */
function fillCapacityScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  if (m.capacityNextWeek.status === "insufficient") {
    return [
      doNothingScenario("Pas assez d'historique de planning pour évaluer un risque de sous-remplissage.", "capacity", "fill_capacity:insufficient"),
      buildScenarioFromLever("primary", "Scénario B — Continuer à renseigner le planning", {
        lever: "capacity_wait_for_data",
        category: "capacity",
        label: "Continuer à renseigner le planning",
        description: "Pas assez d'historique pour comparer objectivement la semaine à venir à une moyenne.",
        qualitativeImpact: "Aucune comparaison fiable possible pour l'instant — revenez sur cette simulation dans quelques semaines.",
        effort: "faible",
        relevantFields: [m.capacityNextWeek],
        assumptionLabels: [["Capacité semaine prochaine", m.capacityNextWeek]],
        planPreview: [],
        fingerprintSeed: "capacity_wait_for_data",
        isRecommended: false,
      }),
    ];
  }

  const value = fieldValueOr(m.capacityNextWeek, { current: 0, average: 0 }) as { current: number; average: number };
  const belowAverage = value.average > 0 && value.current <= value.average * 0.5;
  const inactive = num(m.inactiveCustomersCount);

  const reactivation: LeverCandidate = {
    lever: "reactivation_direct",
    category: "customers",
    label: "Réactiver d'anciens clients",
    description: "Contacter individuellement les clients sans devis/facture récent pour occuper les créneaux disponibles.",
    qualitativeImpact:
      inactive > 0
        ? "Cible des clients ayant déjà fait confiance à l'entreprise — impact réel dépendant du taux de réponse."
        : "Peu de clients inactifs identifiés actuellement — impact limité pour ce levier.",
    effort: "moyen",
    relevantFields: [m.inactiveCustomersCount],
    assumptionLabels: [["Clients inactifs", m.inactiveCustomersCount]],
    planPreview: [{ label: "Clients inactifs à contacter", count: m.inactiveCustomersCount.status === "insufficient" ? null : inactive }],
    fingerprintSeed: `reactivation_direct:inactive=${bucketCount(inactive)}`,
    isRecommended: belowAverage && inactive > 0,
  };
  const marketing = marketingCampaignLever("Remplissage du planning");
  marketing.isRecommended = belowAverage && inactive === 0;

  return [
    doNothingScenario(
      belowAverage
        ? `La semaine prochaine (${value.current}) est nettement en dessous de votre moyenne habituelle (${value.average}) — sans action, ces créneaux resteront probablement inoccupés.`
        : `La semaine prochaine (${value.current}) est proche de votre moyenne habituelle (${value.average}).`,
      "capacity",
      `fill_capacity:current=${value.current},avg=${Math.round(value.average)}`,
    ),
    buildScenarioFromLever("primary", `Scénario B — ${reactivation.label}`, reactivation),
    buildScenarioFromLever("alternative", `Scénario C — Promotion locale d'une prestation`, marketing),
  ];
}

/**
 * reactivate_customers : contact DIRECT individuel vs campagne GROUPÉE
 * (offre spéciale envoyée à tous en une fois) — deux approches
 * opérationnellement différentes (1:1 vs diffusion), pas la même liste
 * présentée deux fois.
 */
function reactivateCustomersScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const inactive = num(m.inactiveCustomersCount);

  if (m.inactiveCustomersCount.status === "insufficient") {
    return [doNothingScenario("Pas assez de données pour identifier des clients inactifs.", "customers", "reactivate_customers:insufficient")];
  }
  if (inactive === 0) {
    return [doNothingScenario("Aucun client inactif identifié actuellement (tous ont un devis/facture récent).", "customers", "reactivate_customers:0")];
  }

  const direct: LeverCandidate = {
    lever: "reactivation_direct",
    category: "customers",
    label: "Contact individuel des clients inactifs",
    description: "Message personnalisé un par un aux clients sans devis/facture depuis plus de 6 mois.",
    qualitativeImpact: "Approche personnalisée — demande plus de temps par client mais un message adapté à chacun.",
    effort: "moyen",
    relevantFields: [m.inactiveCustomersCount],
    assumptionLabels: [["Clients inactifs", m.inactiveCustomersCount]],
    planPreview: [{ label: "Clients à contacter individuellement", count: inactive }],
    fingerprintSeed: `reactivation_direct:inactive=${bucketCount(inactive)}`,
    isRecommended: inactive <= 10,
  };
  const bulk: LeverCandidate = {
    lever: "reactivation_bulk_campaign",
    category: "marketing",
    label: "Campagne groupée de réactivation",
    description: "Une offre de reprise de contact envoyée en une fois à tous les clients inactifs identifiés.",
    qualitativeImpact: "Moins de personnalisation par client, mais couvre l'ensemble du groupe en une seule action.",
    effort: "faible",
    relevantFields: [m.inactiveCustomersCount],
    assumptionLabels: [["Clients inactifs", m.inactiveCustomersCount]],
    planPreview: [{ label: "Campagne de réactivation préparée", count: inactive }],
    fingerprintSeed: `reactivation_bulk_campaign:inactive=${bucketCount(inactive)}`,
    isRecommended: inactive > 10,
  };

  return [
    doNothingScenario(`${inactive} client(s) inactif(s) resteront sans nouveau contact.`, "customers", `reactivate_customers:inactive=${bucketCount(inactive)}`),
    buildScenarioFromLever("primary", `Scénario B — ${direct.label}`, direct),
    buildScenarioFromLever("alternative", `Scénario C — ${bulk.label}`, bulk),
  ];
}

/**
 * overdue_payments : relance GROUPÉE immédiate vs TRIAGE (prioriser les
 * plus anciennes/montants les plus élevés d'abord, échelonner le reste) —
 * deux stratégies opérationnelles réellement différentes, même catégorie
 * FINANCE mais approche distincte.
 */
function overduePaymentsScenarios(m: Record<string, DataField<unknown>>): ScenarioResult[] {
  const count = num(m.overdueInvoicesCount);
  const amount = num(m.overdueInvoicesAmount);

  if (count === 0) {
    return [doNothingScenario("Aucune facture en retard identifiée actuellement.", "finance", "overdue_payments:0")];
  }

  const batch: LeverCandidate = {
    lever: "finance_batch",
    category: "finance",
    label: "Relancer toutes les factures maintenant",
    description: "Préparer une relance pour chaque facture en retard, envoyées en une seule vague.",
    qualitativeImpact: `${amount.toFixed(0)} € de factures en retard concernées — la relance ne garantit pas le paiement.`,
    effort: "faible",
    relevantFields: [m.overdueInvoicesCount, m.overdueInvoicesAmount],
    assumptionLabels: [["Factures en retard", m.overdueInvoicesCount], ["Montant en retard", m.overdueInvoicesAmount]],
    planPreview: [{ label: "Factures à relancer", count }],
    fingerprintSeed: `finance_batch:count=${bucketCount(count)}`,
    isRecommended: count <= 5,
  };
  const triage: LeverCandidate = {
    lever: "finance_triage",
    category: "finance",
    label: "Prioriser les plus urgentes, échelonner le reste",
    description: "Relancer d'abord les factures les plus anciennes et les montants les plus élevés, puis les suivantes dans un second temps.",
    qualitativeImpact: "Concentre l'effort immédiat sur le risque le plus élevé plutôt que de tout traiter en même temps.",
    effort: "moyen",
    relevantFields: [m.overdueInvoicesCount, m.overdueInvoicesAmount],
    assumptionLabels: [["Factures en retard", m.overdueInvoicesCount], ["Montant en retard", m.overdueInvoicesAmount]],
    planPreview: [{ label: "Factures prioritaires à relancer d'abord", count: Math.min(count, 5) }],
    fingerprintSeed: `finance_triage:count=${bucketCount(count)}`,
    isRecommended: count > 5,
  };

  return [
    doNothingScenario(`${count} facture(s) en retard (${amount.toFixed(0)} € au total) resteront impayées sans relance.`, "finance", `overdue_payments:count=${bucketCount(count)}`),
    buildScenarioFromLever("primary", `Scénario B — ${batch.label}`, batch),
    buildScenarioFromLever("alternative", `Scénario C — ${triage.label}`, triage),
  ];
}

/**
 * Pour les objectifs sans règle déterministe suffisamment fiable
 * aujourd'hui (marge, stock excédentaire, fidélisation) ou un objectif
 * libre non classé — honnêteté plutôt qu'invention : on dit explicitement
 * quelle donnée manque au lieu de fabriquer un scénario chiffré. Un seul
 * scénario B, jamais de C fabriqué pour faire nombre.
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
    doNothingScenario("Aucune action automatique proposée pour cet objectif pour l'instant.", "marketing", `generic:${goalType}`),
    buildScenarioFromLever("primary", "Scénario B — Revue manuelle avec NOVA", {
      lever: "manual_review_nova",
      category: "marketing",
      label: "Revue manuelle avec NOVA",
      description: "Discutez de cet objectif avec NOVA pour explorer les données disponibles au cas par cas.",
      qualitativeImpact: "Pas de scénario chiffré disponible tant que la donnée nécessaire n'est pas suivie dans ProspectFlow.",
      effort: "moyen",
      relevantFields: [],
      assumptionLabels: Object.entries(m),
      planPreview: [{ label: "Échanger avec NOVA sur cet objectif", count: null }],
      fingerprintSeed: `manual_review_nova:${goalType}`,
      isRecommended: false,
    }),
  ].map((s, i) => (i === 1 ? { ...s, confidence: "faible" as const, confidenceExplanation: reason } : s));
}
