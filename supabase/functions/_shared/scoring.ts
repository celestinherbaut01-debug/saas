import type { EnrichedProspect } from "./types.ts";

/**
 * Le score ne veut pas dire la même chose pour tout le monde : une agence
 * web veut des prospects SANS site (opportunité de refonte), une entreprise
 * de nettoyage veut au contraire des structures LARGES (plus de surface à
 * nettoyer — une chaîne ou un grand groupe y est un signal positif, pas
 * négatif). Le profil est déterminé par le métier + l'audience déclarés par
 * l'utilisateur (voir resolveScoringProfile côté index.ts), jamais par le
 * prospect lui-même.
 */
export type ScoringProfile =
  | "digital_opportunity" // agence web / prestataire informatique
  | "marketing_potential" // agence marketing / communication
  | "contract_potential" // nettoyage, sécurité, services récurrents sur site
  | "b2b_commercial" // vendeur B2B générique (fournisseur, grossiste...)
  | "generic";

export const SCORING_PROFILE_LABEL: Record<ScoringProfile, string> = {
  digital_opportunity: "Opportunité digitale",
  marketing_potential: "Potentiel marketing",
  contract_potential: "Potentiel contrat",
  b2b_commercial: "Potentiel commercial B2B",
  generic: "Score d'opportunité",
};

/**
 * Détermine le profil de scoring à partir du métier propre de l'utilisateur
 * (slug de business_categories, feuille) et de son audience déclarée —
 * jamais du prospect. Liste volontairement courte et honnête : seuls les
 * métiers explicitement couverts ont un profil dédié, tout le reste utilise
 * la formule générique plutôt qu'un profil deviné approximativement.
 */
export function resolveScoringProfile(
  ownSlug: string | null,
  audience: "b2b" | "b2c" | "both" | null,
): ScoringProfile {
  if (ownSlug === "web" || ownSlug === "it") return "digital_opportunity";
  if (ownSlug === "marketing" || ownSlug === "design") return "marketing_potential";
  if (ownSlug === "cleaning" || ownSlug === "security") return "contract_potential";
  if (audience === "b2b") return "b2b_commercial";
  return "generic";
}

/**
 * Tranches d'effectif INSEE utilisées comme proxy de "taille" pour les
 * profils qui valorisent les grandes structures (contract_potential,
 * b2b_commercial) — mêmes tranches que isLargeGroup (chains.ts), pas une
 * nouvelle échelle inventée.
 */
function hasSubstantialSize(effectifTranche: string | null): boolean {
  if (!effectifTranche) return false;
  const n = parseInt(effectifTranche, 10);
  return Number.isFinite(n) && n >= 21; // tranche 21 = "20 à 49 salariés" et au-delà
}

export function computeQualityScore(
  p: Omit<EnrichedProspect, "qualityScore" | "verificationSources">,
  profile: ScoringProfile = "generic",
): { score: number; sources: Record<string, boolean> } {
  let score = 40;
  const sources: Record<string, boolean> = {};

  // Statut opérationnel confirmé par Google = donnée fiable, pas une supposition.
  if (p.businessStatus === "OPERATIONAL") {
    score += 15;
    sources.google_operational = true;
  } else if (p.businessStatus === "CLOSED_PERMANENTLY") {
    score -= 40;
    sources.google_closed = true;
  } else if (p.businessStatus === "CLOSED_TEMPORARILY") {
    score -= 15;
    sources.google_temp_closed = true;
  }

  // Besoin digital — au cœur de l'opportunité pour digital_opportunity et
  // marketing_potential, un simple signal secondaire pour les autres profils.
  const webWeight = profile === "digital_opportunity" ? 1.4 : profile === "marketing_potential" ? 1.1 : 1;
  if (p.websiteQuality === "none") {
    score += Math.round(20 * webWeight);
    sources.no_website = true;
  } else if (p.websiteQuality === "weak") {
    score += Math.round(12 * webWeight);
    sources.weak_website = true;
  } else if (p.websiteQuality === "unknown") {
    score += 4;
    sources.website_unverified = true;
  }

  // Indépendance / taille de structure — signal INVERSÉ selon le profil :
  // une grande structure ou une chaîne est une meilleure opportunité de
  // CONTRAT (plus de surface, plus de volume d'achat) qu'une TPE
  // indépendante, contrairement à une offre de refonte de site.
  const sizeMattersMore = profile === "contract_potential" || profile === "b2b_commercial";
  if (sizeMattersMore) {
    if (p.isLargeGroup || hasSubstantialSize(p.effectifTranche)) {
      score += 15;
      sources.large_structure_opportunity = true;
    }
    if (p.isChain) {
      score += 8;
      sources.multi_site_opportunity = true;
    }
    if (p.isAssociation) {
      score -= 10;
      sources.association_or_public = true;
    }
  } else {
    if (!p.isChain && !p.isAssociation && !p.isLargeGroup) {
      score += 10;
      sources.independent_confirmed = true;
    }
    if (p.isChain) {
      score -= 25;
      sources.chain_detected = true;
    }
    if (p.isAssociation) {
      score -= 20;
      sources.association_or_public = true;
    }
    if (p.isLargeGroup) {
      score -= 20;
      sources.large_group = true;
    }
  }

  // Joignabilité.
  if (p.phone) {
    score += 8;
    sources.phone_verified = true;
  }

  // Présence Google active (avis) — signal fort pour marketing_potential
  // (visibilité locale déjà réelle, juste pas exploitée) et contract_potential
  // (établissement actif, probablement fréquenté).
  if ((profile === "marketing_potential" || profile === "contract_potential") && p.googleRatingCount) {
    score += p.googleRatingCount >= 50 ? 10 : 5;
    sources.google_reviews_signal = true;
  }

  // Proximité : plus c'est proche du point de départ, plus c'est actionnable.
  if (p.distanceKm <= 5) score += 5;
  else if (p.distanceKm <= 15) score += 2;

  return { score: Math.max(0, Math.min(100, Math.round(score))), sources };
}
