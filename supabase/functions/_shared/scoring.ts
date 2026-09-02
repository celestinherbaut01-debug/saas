import type { EnrichedProspect } from "./types.ts";

/**
 * Score d'opportunité 0-100. Plus un prospect est confirmé indépendant,
 * joignable, opérationnel et faible/absent sur le web, plus il est
 * intéressant pour une offre de prospection/refonte de site.
 * La formule est volontairement lisible plutôt que "magique" : chaque
 * bonus/malus est explicite et traçable dans verification_sources.
 */
export function computeQualityScore(
  p: Omit<EnrichedProspect, "qualityScore" | "verificationSources">,
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

  // Besoin digital = le cœur de l'opportunité commerciale.
  if (p.websiteQuality === "none") {
    score += 20;
    sources.no_website = true;
  } else if (p.websiteQuality === "weak") {
    score += 12;
    sources.weak_website = true;
  } else if (p.websiteQuality === "unknown") {
    score += 4;
    sources.website_unverified = true;
  }

  // Indépendance réelle (registre officiel).
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

  // Joignabilité.
  if (p.phone) {
    score += 8;
    sources.phone_verified = true;
  }

  // Proximité : plus c'est proche du point de départ, plus c'est actionnable.
  if (p.distanceKm <= 5) score += 5;
  else if (p.distanceKm <= 15) score += 2;

  return { score: Math.max(0, Math.min(100, Math.round(score))), sources };
}
