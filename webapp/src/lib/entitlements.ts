// Source UNIQUE de vérité pour ce que chaque plan autorise. La page /tarifs,
// la page Abonnement et toute vérification serveur de quota lisent ce
// fichier — jamais de liste de features dupliquée ailleurs dans le code.
//
// Les limites ci-dessous sont volontairement modifiables ici uniquement :
// changer un chiffre dans ce fichier suffit à changer le comportement réel
// (affichage ET application serveur), sans toucher au reste du code.
//
// ARCHITECTURE MODULAIRE (refonte produit) : ProspectFlow est UNE plateforme
// avec DEUX modules indépendants — Acquisition (prospection/CRM/NOVA
// commercial) et Business OS (gestion métier). Chaque plan combine un
// niveau d'Acquisition et un niveau de Business OS ; un client ne paie que
// pour ce dont il a besoin. "Complete"/"Complete Max" sont des BUNDLES des
// deux modules à un tarif inférieur à la somme des deux pris séparément
// (voir yearlyPrice — même logique de calcul honnête, jamais un chiffre
// affiché sans qu'il soit dérivé des vrais prix).
//
// Ancien catalogue (avant cette refonte) : free/starter/pro/max, un seul
// axe linéaire où "pro" forçait Business OS standard même pour un client
// qui ne voulait qu'Acquisition. Migration des abonnements existants :
// starter → acquisition_starter, pro → complete, max → complete_max (mêmes
// droits qu'avant, nouveau nom) — voir 0023_modular_pricing.sql.

export type Plan =
  | "free"
  | "acquisition_starter"
  | "acquisition_pro"
  | "business_os"
  | "business_os_advanced"
  | "complete"
  | "complete_max";

export const PLAN_ORDER: Plan[] = [
  "free",
  "acquisition_starter",
  "acquisition_pro",
  "business_os",
  "business_os_advanced",
  "complete",
  "complete_max",
];
// Rang purement indicatif (ordre d'affichage / prix croissant) — PAS un
// vrai ordre total puisque les deux axes (Acquisition/Business OS) sont
// indépendants : "business_os" n'est ni supérieur ni inférieur à
// "acquisition_pro". planAtLeast() reste utile pour comparer un plan à
// "free" (aucun payant n'est "en dessous"), pas pour comparer deux plans à
// module différent entre eux.
const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  acquisition_starter: 1,
  business_os: 1,
  acquisition_pro: 2,
  business_os_advanced: 2,
  complete: 3,
  complete_max: 4,
};

export type BusinessOsLevel = "none" | "standard" | "advanced";
export type AcquisitionLevel = "none" | "starter" | "pro";

export interface PlanEntitlements {
  id: Plan;
  label: string;
  tagline: string;
  priceMonthly: number; // en euros, 0 = gratuit
  seats: number; // utilisateurs inclus (1 = pas d'équipe)
  prospectMonthlyLimit: number;
  searchMonthlyLimit: number;
  maxRadiusKm: number;
  novaMonthlyLimit: number;
  novaDailyLimit: number | null; // null = pas de plafond journalier séparé
  canUseNova: boolean;
  canDraftEmails: boolean;
  canUseCampaigns: boolean; // envoi/relances automatiques via Gmail
  canUseAutoFollowup: boolean;
  acquisitionLevel: AcquisitionLevel;
  businessOsLevel: BusinessOsLevel;
  canUseTeam: boolean;
  teamMemberLimit: number;
  highlighted?: boolean;
  /** Prix additionné des deux modules pris séparément — pour afficher l'économie d'un bundle. Absent si non pertinent. */
  bundleOf?: { acquisition: Plan; businessOs: Plan };
  features: string[]; // libellés affichés tels quels sur /tarifs
}

export const ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  free: {
    id: "free",
    label: "Free",
    tagline: "Pour découvrir ProspectFlow.",
    priceMonthly: 0,
    seats: 1,
    prospectMonthlyLimit: 15,
    searchMonthlyLimit: 3,
    maxRadiusKm: 10,
    novaMonthlyLimit: 60,
    novaDailyLimit: 2,
    canUseNova: true,
    canDraftEmails: false,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    acquisitionLevel: "starter",
    businessOsLevel: "none",
    canUseTeam: false,
    teamMemberLimit: 1,
    features: [
      "Rayon de prospection jusqu'à 10 km",
      "1 utilisateur",
      "15 prospects vérifiés / mois",
      "3 recherches / mois",
      "CRM très limité",
      "2 requêtes NOVA / jour",
      "Aucune automatisation, aucun Business OS",
    ],
  },
  acquisition_starter: {
    id: "acquisition_starter",
    label: "Acquisition Starter",
    tagline: "Pour lancer une vraie prospection.",
    priceMonthly: 59,
    seats: 1,
    prospectMonthlyLimit: 500,
    searchMonthlyLimit: 60,
    maxRadiusKm: 50,
    novaMonthlyLimit: 100,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    acquisitionLevel: "starter",
    businessOsLevel: "none",
    canUseTeam: false,
    teamMemberLimit: 1,
    features: [
      "Rayon de prospection jusqu'à 50 km",
      "1 utilisateur",
      "500 prospects vérifiés / mois",
      "Recherche avancée (zones, rayon, métiers)",
      "CRM complet + score d'opportunité",
      "100 requêtes NOVA commercial / mois",
      "Génération d'emails (validation manuelle obligatoire)",
      "Analytics simples",
    ],
  },
  acquisition_pro: {
    id: "acquisition_pro",
    label: "Acquisition Pro",
    tagline: "Toute la puissance de prospection, sans Business OS.",
    priceMonthly: 129,
    seats: 1,
    prospectMonthlyLimit: 2000,
    searchMonthlyLimit: 200,
    maxRadiusKm: 150,
    novaMonthlyLimit: 500,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    acquisitionLevel: "pro",
    businessOsLevel: "none",
    canUseTeam: false,
    teamMemberLimit: 1,
    highlighted: true,
    features: [
      "Rayon de prospection jusqu'à 150 km",
      "Tout Acquisition Starter",
      "2 000 prospects vérifiés / mois",
      "500 requêtes NOVA commercial / mois",
      "Campagnes email Gmail + relances automatiques",
      "Classification automatique des réponses",
      "Calendrier + analytics avancées",
    ],
  },
  business_os: {
    id: "business_os",
    label: "Business OS",
    tagline: "Le logiciel de gestion de votre métier — sans prospection.",
    priceMonthly: 89,
    seats: 1,
    prospectMonthlyLimit: 15,
    searchMonthlyLimit: 3,
    maxRadiusKm: 10,
    novaMonthlyLimit: 300,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: false,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    acquisitionLevel: "none",
    businessOsLevel: "standard",
    canUseTeam: false,
    teamMemberLimit: 1,
    features: [
      "Business OS STANDARD adapté à votre métier",
      "Clients, planning, stock, devis, factures",
      "1 utilisateur",
      "300 requêtes NOVA métier / mois",
      "Prospection non incluse (option Acquisition disponible séparément)",
    ],
  },
  business_os_advanced: {
    id: "business_os_advanced",
    label: "Business OS Advanced",
    tagline: "Business OS complet, équipe incluse.",
    priceMonthly: 139,
    seats: 5,
    prospectMonthlyLimit: 15,
    searchMonthlyLimit: 3,
    maxRadiusKm: 10,
    novaMonthlyLimit: 800,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: false,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    acquisitionLevel: "none",
    businessOsLevel: "advanced",
    canUseTeam: true,
    teamMemberLimit: 5,
    features: [
      "Business OS AVANCÉ : alertes, historique complet, automatisations",
      "Jusqu'à 5 utilisateurs (équipe)",
      "800 requêtes NOVA métier / mois",
      "NOVA connectée aux données Business OS",
      "Prospection non incluse (option Acquisition disponible séparément)",
    ],
  },
  complete: {
    id: "complete",
    label: "Complete",
    tagline: "Acquisition Pro + Business OS, au prix d'un bundle.",
    priceMonthly: 179,
    seats: 1,
    prospectMonthlyLimit: 2000,
    searchMonthlyLimit: 200,
    maxRadiusKm: 150,
    novaMonthlyLimit: 800,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    acquisitionLevel: "pro",
    businessOsLevel: "standard",
    canUseTeam: false,
    teamMemberLimit: 1,
    highlighted: true,
    bundleOf: { acquisition: "acquisition_pro", businessOs: "business_os" },
    features: [
      "Tout Acquisition Pro",
      "Tout Business OS (standard)",
      "NOVA commercial ET NOVA métier",
      "800 requêtes NOVA / mois",
    ],
  },
  complete_max: {
    id: "complete_max",
    label: "Complete Max",
    tagline: "Acquisition Pro + Business OS avancé + équipe, sans compromis.",
    priceMonthly: 249,
    seats: 5,
    prospectMonthlyLimit: 5000,
    searchMonthlyLimit: 1000,
    maxRadiusKm: 250,
    novaMonthlyLimit: 1500,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    acquisitionLevel: "pro",
    businessOsLevel: "advanced",
    canUseTeam: true,
    teamMemberLimit: 5,
    bundleOf: { acquisition: "acquisition_pro", businessOs: "business_os_advanced" },
    features: [
      "Tout Acquisition Pro",
      "Tout Business OS Advanced",
      "5 000+ prospects vérifiés / mois",
      "1 500 requêtes NOVA / mois",
      "Jusqu'à 5 utilisateurs (équipe)",
      "NOVA commercial ET NOVA métier",
      "Support prioritaire",
    ],
  },
};

/** ~2 mois offerts à l'année : calculé, jamais un chiffre inventé. */
export function yearlyPrice(plan: Plan): number {
  return Math.round(ENTITLEMENTS[plan].priceMonthly * 10);
}

/** Économie réelle d'un bundle vs les deux modules achetés séparément — 0 si le plan n'est pas un bundle. */
export function bundleSavingsMonthly(plan: Plan): number {
  const bundle = ENTITLEMENTS[plan].bundleOf;
  if (!bundle) return 0;
  const separate = ENTITLEMENTS[bundle.acquisition].priceMonthly + ENTITLEMENTS[bundle.businessOs].priceMonthly;
  return Math.max(0, separate - ENTITLEMENTS[plan].priceMonthly);
}

// Défense en profondeur : même si `plan` est typé `Plan`, ce type n'est
// qu'une PROMESSE côté TypeScript — rien ne garantit à l'exécution que la
// valeur qui arrive ici (souvent lue telle quelle depuis `subscriptions.plan`
// en base, voir lib/plan.ts) est réellement une des clés de ENTITLEMENTS.
// Un plan hérité jamais migré (voir LEGACY_PLAN_MAP ci-dessous) planterait
// sinon ici avec "Cannot read properties of undefined" — repli sur `free`
// plutôt qu'un crash, jamais l'inverse.
export function getEntitlements(plan: Plan): PlanEntitlements {
  return ENTITLEMENTS[plan] ?? ENTITLEMENTS.free;
}

// Catalogue AVANT la refonte modulaire (migration 0023) : un seul axe
// linéaire free/starter/pro/max. Équivalence retenue lors de la migration —
// mêmes droits qu'avant, nouveau nom (voir 0023_modular_pricing.sql) :
//   starter -> acquisition_starter (aucun Business OS avant)
//   pro     -> complete            (avait déjà Acquisition + Business OS standard)
//   max     -> complete_max        (avait déjà Acquisition + Business OS avancé)
// Nécessaire tant qu'on n'est pas certain que 0023 a été appliquée sur
// TOUTES les bases réelles (une ligne `subscriptions` créée avant la
// migration, ou une migration jamais exécutée en production, contiendrait
// encore ces valeurs littérales).
const LEGACY_PLAN_MAP: Record<string, Plan> = {
  free: "free",
  starter: "acquisition_starter",
  pro: "complete",
  max: "complete_max",
};

/**
 * Source UNIQUE de normalisation d'une valeur de plan potentiellement non
 * fiable (lue en base, jamais garantie par le type TypeScript à
 * l'exécution) vers un `Plan` du catalogue actuel — ne renvoie JAMAIS une
 * valeur qui ferait planter `ENTITLEMENTS[plan]`. Trois cas :
 *  1. Déjà une clé valide du catalogue actuel -> renvoyée telle quelle.
 *  2. Une valeur héritée connue (free/starter/pro/max) -> équivalent moderne,
 *     avec un avertissement serveur (la ligne DB devrait être migrée).
 *  3. Une valeur inconnue (typo, donnée corrompue, plan jamais vu) -> repli
 *     sur "free" (le plan le plus restrictif, jamais un crash), avec une
 *     erreur claire dans les logs serveur — "contrôlée" plutôt qu'une pile
 *     d'appels brute côté client.
 *
 * `context` sert uniquement à rendre le message de log exploitable (ex.
 * l'ID du workspace concerné) — n'affecte jamais la valeur renvoyée.
 */
export function resolvePlan(rawPlan: string | null | undefined, context?: string): Plan {
  if (rawPlan && isValidPlan(rawPlan)) return rawPlan;

  const suffix = context ? ` (${context})` : "";
  if (rawPlan && rawPlan in LEGACY_PLAN_MAP) {
    const resolved = LEGACY_PLAN_MAP[rawPlan];
    console.error(
      `[entitlements] Plan hérité "${rawPlan}" non migré${suffix} — utilisation de l'équivalent moderne "${resolved}". ` +
        `Vérifiez que la migration 0023_modular_pricing.sql a bien été appliquée sur cette base.`,
    );
    return resolved;
  }

  if (rawPlan) {
    console.error(
      `[entitlements] Valeur de plan invalide et inconnue : "${rawPlan}"${suffix} — repli sur "free" pour éviter un crash. ` +
        `Vérifiez la colonne subscriptions.plan pour ce workspace.`,
    );
  }
  return "free";
}

/**
 * Accesseur normalisé demandé pour tout code qui reçoit un plan dont la
 * provenance n'est pas garantie (lecture DB, payload externe...) — combine
 * resolvePlan() et le catalogue en un seul appel qui ne renvoie jamais
 * `undefined`. À utiliser à la place d'un `ENTITLEMENTS[plan]` direct
 * partout où `plan` n'a pas déjà été validé par isValidPlan()/resolvePlan().
 */
export function resolvePlanEntitlements(rawPlan: string | null | undefined, context?: string): PlanEntitlements {
  return ENTITLEMENTS[resolvePlan(rawPlan, context)];
}

/** Comparaison utile seulement contre "free" — voir le commentaire sur PLAN_RANK. */
export function planAtLeast(plan: Plan, min: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

export function businessOsAtLeast(plan: Plan, min: BusinessOsLevel): boolean {
  const rank: Record<BusinessOsLevel, number> = { none: 0, standard: 1, advanced: 2 };
  return rank[ENTITLEMENTS[plan].businessOsLevel] >= rank[min];
}

export function acquisitionAtLeast(plan: Plan, min: AcquisitionLevel): boolean {
  const rank: Record<AcquisitionLevel, number> = { none: 0, starter: 1, pro: 2 };
  return rank[ENTITLEMENTS[plan].acquisitionLevel] >= rank[min];
}

export type NovaContext = "commercial" | "metier";

/**
 * Quels contextes NOVA doit couvrir pour ce plan — dérivé des deux mêmes
 * axes que le reste du catalogue, jamais un troisième champ à maintenir en
 * synchro à part. NOVA Commercial (prospection/CRM/relances) suit l'accès
 * Acquisition ; NOVA Métier (données Business OS) suit l'accès Business OS
 * dès le niveau STANDARD.
 *
 * Bug corrigé : le code NOVA gatait auparavant get_business_os_data sur
 * `businessOsAtLeast(plan, "advanced")` alors que le plan `business_os`
 * (standard) promet lui-même "300 requêtes NOVA métier / mois" dans ses
 * features, et que `complete` promet "NOVA commercial ET NOVA métier" tout
 * en ayant un businessOsLevel "standard" — les deux plans payaient pour une
 * fonctionnalité que le code ne livrait jamais. Et symétriquement, un plan
 * Business OS seul (acquisitionLevel "none") recevait quand même les outils
 * commerciaux (search_prospects, etc.) sans aucun accès Acquisition réel.
 */
export function novaContexts(plan: Plan): NovaContext[] {
  const contexts: NovaContext[] = [];
  if (acquisitionAtLeast(plan, "starter")) contexts.push("commercial");
  if (businessOsAtLeast(plan, "standard")) contexts.push("metier");
  return contexts;
}

export function isValidPlan(value: string): value is Plan {
  return (PLAN_ORDER as string[]).includes(value);
}

/**
 * Modules qu'on peut AJOUTER depuis le plan actuel sans jamais perdre ce qui
 * est déjà payé : seuls les plans dont les DEUX niveaux (Acquisition et
 * Business OS) sont ≥ au plan actuel, avec au moins un niveau strictement
 * supérieur. Ça retombe naturellement sur les bundles Complete/Complete Max
 * quand on ajoute le module manquant à un plan Pro — jamais sur une
 * combinaison qui ferait perdre un niveau déjà acquis (ex. depuis Business
 * OS Advanced, "Complete" n'est jamais proposé : il repasserait le Business
 * OS en standard).
 *
 * Cas "free" : son `acquisitionLevel: "starter"` sert uniquement aux checks
 * `acquisitionAtLeast()` ("a accès à de la prospection, même limitée") — ses
 * limites réelles (15 prospects/mois) n'ont rien à voir avec le vrai plan
 * Acquisition Starter. La règle générique masquerait donc à tort cette
 * upsell ; free liste simplement tous les plans payants.
 */
export function upgradeOptions(current: Plan): Plan[] {
  const currentEnt = ENTITLEMENTS[current];
  if (currentEnt.priceMonthly === 0) return PLAN_ORDER.filter((id) => id !== "free");

  const acqRank: Record<AcquisitionLevel, number> = { none: 0, starter: 1, pro: 2 };
  const bosRank: Record<BusinessOsLevel, number> = { none: 0, standard: 1, advanced: 2 };
  return PLAN_ORDER.filter((id) => {
    if (id === current) return false;
    const candidate = ENTITLEMENTS[id];
    const acqOk = acqRank[candidate.acquisitionLevel] >= acqRank[currentEnt.acquisitionLevel];
    const bosOk = bosRank[candidate.businessOsLevel] >= bosRank[currentEnt.businessOsLevel];
    const strictlyMore =
      acqRank[candidate.acquisitionLevel] > acqRank[currentEnt.acquisitionLevel] ||
      bosRank[candidate.businessOsLevel] > bosRank[currentEnt.businessOsLevel];
    return acqOk && bosOk && strictlyMore;
  });
}
