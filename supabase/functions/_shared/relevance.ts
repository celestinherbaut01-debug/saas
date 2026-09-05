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

// Le champ business_type d'une catégorie répond à "qui SONT ses clients
// habituels" (un restaurant sert des particuliers) — PAS à "qui peut la
// démarcher". Pour une offre de présence digitale/marketing
// (digital_opportunity, marketing_potential), n'importe quelle entreprise
// locale, qu'elle soit elle-même B2B ou B2C, est un client valable : un
// restaurant (B2C) a autant besoin d'un site qu'un cabinet comptable (B2B).
// Le filtre B2B/B2C ne doit s'appliquer QUE quand l'offre elle-même est un
// service pensé pour des entreprises structurées (flotte, contrat de
// nettoyage pro...) — contract_potential/b2b_commercial/generic.
//
// Bug corrigé : sans cette distinction, une agence web (offre = présence
// en ligne, audience déclarée "b2b" puisqu'elle vend À des entreprises)
// voyait TOUTES ses cibles recommandées — restaurants, coiffeurs,
// garages... — pénalisées de -40 points et reléguées en "secondaire",
// alors que ce sont exactement les bonnes cibles pour cette offre.
const PROFILES_IGNORING_AUDIENCE_MATCH: ScoringProfile[] = ["digital_opportunity", "marketing_potential"];

export function computeRelevance(
  candidateNafCode: string | null,
  audience: "b2b" | "b2c" | "both" | null,
  nafBusinessType: Map<string, "b2b" | "b2c" | "both">,
  scoringProfile: ScoringProfile,
): RelevanceResult {
  const reasons: string[] = [];
  let score = 70; // Base : le candidat correspond à une catégorie explicitement sélectionnée par le client.

  const candidateType = candidateNafCode ? nafBusinessType.get(candidateNafCode) : undefined;
  const audienceMatchApplies = !PROFILES_IGNORING_AUDIENCE_MATCH.includes(scoringProfile);

  if (
    audienceMatchApplies &&
    audience &&
    audience !== "both" &&
    candidateType &&
    candidateType !== "both" &&
    candidateType !== audience
  ) {
    score -= 40;
    reasons.push(
      audience === "b2b"
        ? "Ce type d'établissement est habituellement B2C — vous ciblez les professionnels"
        : "Ce type d'établissement est habituellement B2B — vous ciblez les particuliers",
    );
  } else if (
    audienceMatchApplies &&
    audience &&
    audience !== "both" &&
    candidateType &&
    (candidateType === "both" || candidateType === audience)
  ) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));
  const tier: RelevanceTier = score < SECONDARY_THRESHOLD ? "secondary" : "primary";
  return { score, tier, reasons };
}
