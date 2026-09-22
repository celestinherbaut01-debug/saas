// STRATÉGIE DE CANAL — répond à une question que le moteur de recherche ne
// s'est jamais posée : "la recherche dans le registre SIRENE est-elle même
// le bon outil pour cette offre ?"
//
// search-prospects interroge un REGISTRE D'ENTREPRISES (SIRENE/RNE). Pour
// une offre dont les vrais clients sont des PARTICULIERS (un agent
// immobilier démarchant des propriétaires vendeurs, un garage sans offre
// flotte, un salon de coiffure...), ce registre est structurellement le
// mauvais outil : les particuliers n'y figurent pas. Présenter quand même
// une recherche B2B dans ce cas — même bien scorée, bien filtrée — reviendrait
// à fabriquer une promesse que le produit ne peut pas tenir.
//
// Ce module ne remplace ni resolveScoringProfile ni recommendedSlugsForOffer
// (qui répondent à "qui cibler DANS le registre") — il répond à la question
// en amont : "le registre est-il la bonne source pour cette offre ?"

import { resolveScoringProfile } from "@/lib/scoring-profile";
import { matchedOfferIntentRules } from "@/lib/target-recommendations";

export type ProspectingChannel = "b2b_registry_search" | "mixed_b2b_upsell" | "b2c_not_registry";

export interface ChannelAlternative {
  label: string;
  description: string;
}

export interface ChannelStrategy {
  channel: ProspectingChannel;
  headline: string;
  explanation: string;
  /** Non vide seulement pour "b2c_not_registry" et "mixed_b2b_upsell". */
  alternatives: ChannelAlternative[];
}

// Règles d'intention dont l'offre cible des ENTREPRISES structurées même
// quand l'audience déclarée globale de l'utilisateur est B2C (ex. un garage
// principalement B2C qui vend AUSSI de l'entretien de flotte). Ne contient
// jamais "web-presence" : ce cas est déjà couvert par digital_opportunity/
// marketing_potential ci-dessous, qui ignorent l'audience déclarée pour une
// raison différente (l'offre cible des entreprises locales COMME clientes
// finales, pas comme intermédiaire B2B).
const B2B_ORIENTED_EVEN_IF_B2C_AUDIENCE = new Set([
  "fleet-maintenance",
  "site-cleaning",
  "b2b-supplies",
  "pro-insurance",
  "corporate-catering",
]);

export const RETENTION_ALTERNATIVES: ChannelAlternative[] = [
  {
    label: "Réactiver vos clients existants",
    description: "Vos clients inactifs depuis plusieurs mois sont une cible connue, déjà qualifiée — voir Business Twin, objectif \"Réactiver des clients\".",
  },
  {
    label: "Campagne locale (réseaux sociaux, email, SMS)",
    description: "Toucher de nouveaux particuliers dans votre zone passe par la visibilité locale, pas par un registre d'entreprises.",
  },
  {
    label: "Fidélisation et avis clients",
    description: "Des avis Google récents et une fiche à jour pèsent plus, pour des particuliers, qu'une prospection directe.",
  },
];

/**
 * Détermine si le registre d'entreprises est le bon canal pour cette offre,
 * et si non, quelles alternatives proposer honnêtement à la place — jamais
 * en supprimant la recherche silencieusement, toujours en expliquant pourquoi.
 */
export function resolveChannelStrategy(
  ownSlug: string | null,
  audience: "b2b" | "b2c" | "both" | null,
  offerDescription: string,
): ChannelStrategy {
  const profile = resolveScoringProfile(ownSlug, audience);

  // digital_opportunity / marketing_potential : l'offre cible des
  // entreprises locales EN TANT QUE clientes finales (un restaurant a besoin
  // d'un site autant qu'un cabinet comptable) — le registre reste le bon
  // canal quelle que soit l'audience déclarée par l'utilisateur lui-même.
  if (profile === "digital_opportunity" || profile === "marketing_potential") {
    return {
      channel: "b2b_registry_search",
      headline: "Le registre d'entreprises est le bon canal pour cette offre",
      explanation: "Votre offre s'adresse à des entreprises locales en tant que clientes — la recherche dans le registre officiel reste pertinente, quelle que soit votre propre audience déclarée.",
      alternatives: [],
    };
  }

  if (audience === "b2b") {
    return {
      channel: "b2b_registry_search",
      headline: "Le registre d'entreprises est le bon canal pour cette offre",
      explanation: "Vous vendez à des entreprises — la recherche dans le registre officiel (SIRENE) est le bon canal d'acquisition.",
      alternatives: [],
    };
  }

  const matchedRules = matchedOfferIntentRules(offerDescription);
  const b2bUpsellRule = matchedRules.find((r) => B2B_ORIENTED_EVEN_IF_B2C_AUDIENCE.has(r.id));

  if (audience === "both") {
    return {
      channel: "mixed_b2b_upsell",
      headline: "Le registre d'entreprises ne couvre qu'une partie de votre clientèle",
      explanation: "Vous vendez à la fois à des entreprises et à des particuliers — cette recherche ne trouvera que la part professionnelle. Pour les particuliers, les canaux ci-dessous sont plus adaptés.",
      alternatives: RETENTION_ALTERNATIVES,
    };
  }

  // audience === "b2c" (ou non déclarée) à partir d'ici.
  if (b2bUpsellRule) {
    return {
      channel: "mixed_b2b_upsell",
      headline: `Le registre d'entreprises couvre votre offre "${b2bUpsellRule.label}"`,
      explanation: "Votre clientèle principale est composée de particuliers, mais cette offre précise s'adresse à des entreprises — la recherche ci-dessous cible spécifiquement cette diversification, pas votre clientèle grand public.",
      alternatives: RETENTION_ALTERNATIVES,
    };
  }

  return {
    channel: "b2c_not_registry",
    headline: "Le registre d'entreprises n'est pas le bon canal ici",
    explanation: "Vos clients sont des particuliers, absents du registre officiel des entreprises (SIRENE) — une recherche dans ce registre ne peut pas les trouver, quels que soient les filtres. Les canaux ci-dessous correspondent réellement à votre clientèle.",
    alternatives: RETENTION_ALTERNATIVES,
  };
}
