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

export interface PlanEntitlements {
  id: Plan;
  label: string;
  tagline: string;
  priceMonthly: number; // en euros, 0 = gratuit
  seats: number; // utilisateurs inclus (1 = pas d'équipe)
  prospectMonthlyLimit: number;
  searchMonthlyLimit: number;
  novaMonthlyLimit: number;
  canUseNova: boolean;
  canDraftEmails: boolean;
  canUseCampaigns: boolean; // envoi/relances automatiques via Gmail
  canUseAutoFollowup: boolean;
  canUseBusinessOS: boolean;
  canUseTeam: boolean;
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
    prospectMonthlyLimit: 25,
    searchMonthlyLimit: 5,
    novaMonthlyLimit: 2 * 30, // affiché comme "2/jour" ; quota mensuel technique
    canUseNova: true,
    canDraftEmails: false,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    canUseBusinessOS: false,
    canUseTeam: false,
    features: [
      "1 utilisateur",
      "25 prospects vérifiés / mois",
      "5 recherches / mois",
      "CRM limité",
      "2 requêtes NOVA / jour",
      "Aucune automatisation",
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
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: false,
    canUseAutoFollowup: false,
    canUseBusinessOS: false,
    canUseTeam: false,
    features: [
      "1 utilisateur",
      "500 prospects vérifiés / mois",
      "Recherche avancée (zones, rayon, métiers)",
      "CRM complet + score d'opportunité",
      "100 requêtes NOVA / mois",
      "Génération d'emails (validation manuelle obligatoire)",
      "Analytics de base",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    tagline: "Pour automatiser le suivi commercial.",
    priceMonthly: 129,
    seats: 1,
    prospectMonthlyLimit: 2000,
    searchMonthlyLimit: 200,
    novaMonthlyLimit: 500,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    canUseBusinessOS: false,
    canUseTeam: false,
    highlighted: true,
    features: [
      "Tout Starter",
      "2 000 prospects vérifiés / mois",
      "500 requêtes NOVA / mois",
      "Campagnes email Gmail + relances automatiques",
      "Classification automatique des réponses",
      "Calendrier + récap quotidien",
      "Analytics avancées",
    ],
  },
  max: {
    id: "max",
    label: "Max",
    tagline: "Pour piloter le métier au complet.",
    priceMonthly: 249,
    seats: 5,
    prospectMonthlyLimit: 5000,
    searchMonthlyLimit: 1000,
    novaMonthlyLimit: 1500,
    canUseNova: true,
    canDraftEmails: true,
    canUseCampaigns: true,
    canUseAutoFollowup: true,
    canUseBusinessOS: true,
    canUseTeam: true,
    features: [
      "Tout Pro",
      "5 000+ prospects vérifiés / mois",
      "1 500 requêtes NOVA / mois",
      "Jusqu'à 5 utilisateurs",
      "Business OS complet adapté à votre métier",
      "NOVA connecté au Business OS",
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

export function isValidPlan(value: string): value is Plan {
  return (PLAN_ORDER as string[]).includes(value);
}
