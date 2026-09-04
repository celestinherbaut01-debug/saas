// Miroir exact de supabase/functions/_shared/scoring.ts (resolveScoringProfile
// + SCORING_PROFILE_LABEL) — les deux DOIVENT rester identiques pour que le
// libellé affiché côté client corresponde au calcul réellement fait côté
// serveur (la fiche CRM recalcule juste le LIBELLÉ à partir du même métier +
// audience, jamais le score lui-même qui reste celui figé à l'ajout).

export type ScoringProfile =
  | "digital_opportunity"
  | "marketing_potential"
  | "contract_potential"
  | "b2b_commercial"
  | "generic";

export const SCORING_PROFILE_LABEL: Record<ScoringProfile, string> = {
  digital_opportunity: "Opportunité digitale",
  marketing_potential: "Potentiel marketing",
  contract_potential: "Potentiel contrat",
  b2b_commercial: "Potentiel commercial B2B",
  generic: "Score d'opportunité",
};

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
