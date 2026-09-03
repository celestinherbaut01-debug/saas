// Source UNIQUE de vérité pour ce que chaque plan autorise. La page /tarifs,
// la page Paramètres et toute vérification serveur de quota lisent ce
// fichier — jamais de liste de features dupliquée ailleurs dans le code.
//
// Les limites ci-dessous sont volontairement modifiables ici uniquement :
// changer un chiffre dans ce fichier suffit à changer le comportement réel
// (affichage ET application serveur), sans toucher au reste du code.

export type Plan = "free" | "starter" | "pro" | "max";

export const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "max"];
const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, pro: 2, max: 3 };

// PRO donne un Business OS déjà sérieux (les 3 modules génériques, utilisables
// au quotidien). MAX ajoute la couche "intelligente" : NOVA connectée aux
// données métier, alertes de stock bas. C'est la vraie différence Pro/Max —
// pas juste plus de quota.
export type BusinessOsLevel = "none" | "standard" | "advanced";

export interface PlanEntitlements {
  id: Plan;
  label: string;
  tagline: string;
  priceMonthly: number; // en euros, 0 = gratuit
  seats: number; // utilisateurs inclus (1 = pas d'équipe)
  prospectMonthlyLimit: number;
  searchMonthlyLimit: number;
  novaMonthlyLimit: number;
  novaDailyLimit: number | null; // null = pas de plafond journalier séparé
  canUseNova: boolean;
  canDraftEmails: boolean;
  canUseCampaigns: boolean; // envoi/relances automatiques via Gmail
  canUseAutoFollowup: boolean;
  businessOsLevel: BusinessOsLevel;
  canUseTeam: boolean;
  teamMemberLimit: number;
  highlighted?: boolean;
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
    novaMonthlyLimit: 60,
    novaDailyLimit: 2,
    canUseNova: true,
    canDraftEmails: false,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    businessOsLevel: "none",
    canUseTeam: false,
    teamMemberLimit: 1,
    features: [
      "1 utilisateur",
      "15 prospects vérifiés / mois",
      "3 recherches / mois",
      "CRM très limité",
      "2 requêtes NOVA / jour",
      "Aucune automatisation, aucun Business OS",
    ],
  },
  starter: {
    id: "starter",
    label: "Starter",
    tagline: "Pour lancer une vraie prospection.",
    priceMonthly: 59,
    seats: 1,
    prospectMonthlyLimit: 500,
    searchMonthlyLimit: 60,
    novaMonthlyLimit: 100,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    businessOsLevel: "none",
    canUseTeam: false,
    teamMemberLimit: 1,
    features: [
      "1 utilisateur",
      "500 prospects vérifiés / mois",
      "Recherche avancée (zones, rayon, métiers)",
      "CRM complet + score d'opportunité",
      "100 requêtes NOVA / mois",
      "Génération d'emails (validation manuelle obligatoire)",
      "Analytics simples",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    tagline: "Le logiciel de gestion de votre métier commence ici.",
    priceMonthly: 149,
    seats: 1,
    prospectMonthlyLimit: 2000,
    searchMonthlyLimit: 200,
    novaMonthlyLimit: 500,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    businessOsLevel: "standard",
    canUseTeam: false,
    teamMemberLimit: 1,
    highlighted: true,
    features: [
      "Tout Starter",
      "2 000 prospects vérifiés / mois",
      "500 requêtes NOVA / mois",
      "Campagnes email Gmail + relances automatiques",
      "Classification automatique des réponses",
      "Calendrier + analytics avancées",
      "Business OS STANDARD adapté à votre métier",
    ],
  },
  max: {
    id: "max",
    label: "Max",
    tagline: "Le Business OS complet, avec NOVA en plus.",
    priceMonthly: 249,
    seats: 5,
    prospectMonthlyLimit: 5000,
    searchMonthlyLimit: 1000,
    novaMonthlyLimit: 1500,
    novaDailyLimit: null,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    businessOsLevel: "advanced",
    canUseTeam: true,
    teamMemberLimit: 5,
    features: [
      "Tout Pro",
      "5 000+ prospects vérifiés / mois",
      "1 500 requêtes NOVA / mois",
      "Jusqu'à 5 utilisateurs (équipe)",
      "Business OS AVANCÉ : alertes stock, workflows métier",
      "NOVA connectée aux données Business OS",
      "Automatisations et analytics avancées",
      "Support prioritaire",
    ],
  },
};

/** ~2 mois offerts à l'année : calculé, jamais un chiffre inventé. */
export function yearlyPrice(plan: Plan): number {
  return Math.round(ENTITLEMENTS[plan].priceMonthly * 10);
}

export function getEntitlements(plan: Plan): PlanEntitlements {
  return ENTITLEMENTS[plan];
}

export function planAtLeast(plan: Plan, min: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

export function businessOsAtLeast(plan: Plan, min: BusinessOsLevel): boolean {
  const rank: Record<BusinessOsLevel, number> = { none: 0, standard: 1, advanced: 2 };
  return rank[ENTITLEMENTS[plan].businessOsLevel] >= rank[min];
}

export function isValidPlan(value: string): value is Plan {
  return (PLAN_ORDER as string[]).includes(value);
}
