import { offerMatchesIntentRule } from "@/lib/target-recommendations";

export interface ProspectingFilterProfile {
  /** "Besoin digital" (statut de site web) — pertinent seulement pour une offre réellement liée au web/digital. */
  showWebCriteria: boolean;
}

// Le métier déclaré peut, à lui seul, rendre le critère web pertinent
// (une agence web/marketing démarche presque toujours sur le prétexte du
// site) — mais ce n'est plus le SEUL signal (voir le bug corrigé : un
// vendeur de matériel industriel avec audience non déclarée "b2b" tombait
// sur le scoringProfile "generic", qui affichait quand même ces filtres).
const DIGITAL_OWN_SLUGS = new Set(["web", "it", "marketing", "design"]);

/**
 * Décide quels groupes de filtres de qualité afficher en Prospection.
 * Aujourd'hui, un seul groupe est conditionnel : "Besoin digital" (site web
 * sans/faible/à vérifier), pertinent uniquement quand l'OFFRE elle-même
 * porte sur la présence en ligne — jamais lié à l'audience B2B/B2C ni au
 * profil de scoring commercial (un garagiste vendant un contrat de flotte à
 * des professionnels n'a toujours rien à faire du statut du site de ses
 * cibles, même si son audience est "b2b" comme une agence web).
 *
 * Règle : offre correspondant à la règle d'intention "web-presence"
 * (mêmes mots-clés que les recommandations de cibles, voir
 * target-recommendations.ts) OU métier déclaré du numérique/marketing.
 */
export function getProspectingFilterProfile(offerDescription: string, ownSlug: string | null): ProspectingFilterProfile {
  const showWebCriteria = DIGITAL_OWN_SLUGS.has(ownSlug ?? "") || offerMatchesIntentRule(offerDescription, "web-presence");
  return { showWebCriteria };
}
