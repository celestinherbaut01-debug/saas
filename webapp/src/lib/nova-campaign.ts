import type { BusinessOsVertical } from "@/lib/business-os";

// Générateur de templates de campagne 100% déterministe (aucun appel
// Anthropic) — répond aux exemples garage/agence/nettoyage/restaurant de la
// refonte NOVA Growth Autopilot (créneaux à remplir, prospects pertinents,
// campagne locale...) sans jamais inventer une offre, un prix ou une
// performance. Le prix/l'offre commerciale reste TOUJOURS un champ à
// remplir par l'utilisateur (`offerPrompt`) : ProspectFlow n'a aucune donnée
// fiable sur les tarifs réels pratiqués (pas de table "services/tarifs"
// dans le schéma actuel), donc écrire "Vidange à 69€" à sa place serait une
// invention, même si l'exemple produit en donne un pour illustrer l'usage.
export interface CampaignTemplate {
  headline: string;
  /** Ce que l'utilisateur doit préciser lui-même — jamais un prix ou une offre inventés. */
  offerPrompt: string;
  targetDescription: string;
  facebookText: string;
  instagramText: string;
  visualIdea: string;
  smsText: string;
  emailText: string;
  estimatedContacts:
    | { known: true; count: number; source: string }
    | { known: false; reason: string };
}

const VISUAL_IDEA: Record<BusinessOsVertical, string> = {
  garage: "Photo d'un véhicule en atelier ou de l'équipe au travail, avec le créneau disponible en gros texte.",
  cleaning: "Photo avant/après d'une prestation récente, avec la zone couverte en texte.",
  agency: "Visuel épuré avec votre logo + celui d'un client existant (avec son accord), et l'offre en une phrase.",
  restaurant: "Photo d'un plat ou de la salle au moment ciblé (ex. mercredi soir), avec l'offre en surimpression.",
  generic: "Une photo réelle de votre activité (jamais une image générique) avec l'offre en texte court.",
};

const AUDIENCE_LABEL: Record<BusinessOsVertical, string> = {
  garage: "vos clients passés et les automobilistes de votre zone",
  cleaning: "les entreprises et copropriétés de votre zone qui n'ont pas encore de contrat récurrent",
  agency: "les entreprises de votre zone dont le site ou la présence en ligne est daté",
  restaurant: "vos clients passés et les habitants/salariés à proximité",
  generic: "vos clients passés et les prospects de votre zone",
};

/**
 * `context` est le libellé de la source de l'opportunité (ex. "Atelier",
 * "Planning interventions", "Réservations") — c'est tout ce que l'action
 * href actuelle transmet (voir askNovaHref/detectUnderbooking dans
 * lib/nova-opportunities.ts). `pastCustomerCount` vient d'une vraie requête
 * `customers` : `null` si l'appelant n'a pas pu le déterminer, jamais un
 * chiffre par défaut arbitraire.
 */
export function generateCampaignTemplate(input: {
  companyName: string;
  vertical: BusinessOsVertical;
  context: string;
  city: string;
  pastCustomerCount: number | null;
}): CampaignTemplate {
  const { companyName, vertical, context, city } = input;
  const cityPart = city ? ` à ${city}` : "";
  const audience = AUDIENCE_LABEL[vertical];

  const headline = `Campagne pour remplir "${context}"`;
  const offerPrompt = `Précisez votre offre du moment (ex. une prestation, un tarif, une durée limitée) — ProspectFlow ne connaît pas vos tarifs réels et n'en invente aucun.`;
  const targetDescription = `${audience}${cityPart}.`;

  const facebookText =
    `${companyName} a de la disponibilité prochainement (${context}).\n` +
    `[Votre offre ici — voir offerPrompt]\n` +
    `Contactez-nous pour réserver votre créneau.`;

  const instagramText = `📍${companyName}${cityPart}\n${context} : quelques places encore disponibles.\n[Votre offre ici]\nEn message privé pour réserver.`;

  const smsText = `${companyName} : il reste de la disponibilité (${context}). [Votre offre ici]. Répondez pour réserver.`;

  const emailText =
    `Objet : Une disponibilité chez ${companyName}\n\n` +
    `Bonjour,\n\n` +
    `Nous avons de la disponibilité prochainement (${context}). [Votre offre ici].\n\n` +
    `Répondez à cet email ou contactez-nous pour réserver.\n\n` +
    `${companyName}`;

  const visualIdea = VISUAL_IDEA[vertical];

  const estimatedContacts: CampaignTemplate["estimatedContacts"] =
    input.pastCustomerCount != null
      ? { known: true, count: input.pastCustomerCount, source: "Nombre de clients enregistrés dans votre Business OS" }
      : { known: false, reason: "Pas assez de données clients pour estimer un nombre de personnes à contacter." };

  return { headline, offerPrompt, targetDescription, facebookText, instagramText, visualIdea, smsText, emailText, estimatedContacts };
}
