// Moteur de pertinence — s'exécute AVANT le scoring commercial
// (computeQualityScore). Répond à une question différente : "ce prospect
// a-t-il un rapport réel avec ce que je vends ?", pas "est-ce une belle
// opportunité ?". Un prospect peut avoir un relevanceScore bas et, s'il
// passe quand même le seuil, un qualityScore élevé (ou l'inverse).
//
// HONNÊTETÉ : ceci n'est PAS un classement sémantique par IA — juste une
// vérification structurelle (le NAF du candidat correspond-il à une
// catégorie du catalogue compatible avec l'audience déclarée par le
// client ?). C'est délibérément plus modeste qu'une vraie compréhension du
// texte libre de l'offre, pour ne jamais fabriquer un jugement qu'on ne
// peut pas justifier avec de vraies données.

import type { ScoringProfile } from "./scoring.ts";

export type RelevanceTier = "primary" | "secondary";

export interface RelevanceResult {
  score: number; // 0-100
  tier: RelevanceTier;
  reasons: string[];
}

const SECONDARY_THRESHOLD = 45;

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function normalize(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/**
 * "Je veux éviter les correspondances grossières" : un candidat qui matche
 * le NAF d'une catégorie mais dont le nom contient un motif d'exclusion de
 * cette catégorie (ex. "grossiste" pour Garages automobiles) n'est pas un
 * faux négatif à cacher — c'est une correspondance de mauvaise qualité,
 * rétrogradée en "secondary" avec la raison explicite, jamais supprimée
 * silencieusement (le client doit pouvoir la voir et juger lui-même).
 */
function matchesExclusion(companyName: string, exclusionKeywords: string[]): string | null {
  if (exclusionKeywords.length === 0) return null;
  const name = normalize(companyName);
  for (const kw of exclusionKeywords) {
    if (kw.trim() && name.includes(normalize(kw))) return kw;
  }
  return null;
}

// A selected business is a B2B prospect even when its own customers are consumers.
// The seller's audience cannot be compared with the buyer's audience: hotels,
// shops and restaurants can all purchase professional services.
export function computeRelevance(
  candidateNafCode: string | null,
  _audience: "b2b" | "b2c" | "both" | null,
  _nafBusinessType: Map<string, "b2b" | "b2c" | "both">,
  _scoringProfile: ScoringProfile,
  companyName?: string,
  nafExclusionKeywords?: Map<string, string[]>,
): RelevanceResult {
  const reasons: string[] = [];
  let score = 70; // Base : le candidat correspond à une catégorie explicitement sélectionnée par le client.

  const exclusionKeywords = candidateNafCode ? nafExclusionKeywords?.get(candidateNafCode) ?? [] : [];
  const exclusionMatch = companyName ? matchesExclusion(companyName, exclusionKeywords) : null;
  if (exclusionMatch) {
    score -= 45;
    reasons.push(`Correspondance imprécise probable (motif d'exclusion « ${exclusionMatch} » détecté dans le nom)`);
  }

  score = Math.max(0, Math.min(100, score));
  const tier: RelevanceTier = score < SECONDARY_THRESHOLD ? "secondary" : "primary";
  return { score, tier, reasons };
}
