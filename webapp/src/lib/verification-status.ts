// Statut de vérification unique affiché à l'utilisateur — recalculé partout
// à partir des mêmes trois champs (jamais stocké séparément, jamais désynchro
// possible). Miroir exact de computeVerificationStatus dans
// supabase/functions/search-prospects/index.ts : les deux DOIVENT rester
// identiques, c'est pourquoi la logique est aussi courte et pure que possible.

export type VerificationStatus =
  | "REGISTRY_ONLY"
  | "GOOGLE_VERIFIED"
  | "NO_WEBSITE_CONFIRMED"
  | "WEBSITE_FOUND"
  | "WEBSITE_WEAK"
  | "WEBSITE_GOOD"
  | "UNKNOWN";

export function computeVerificationStatus(
  placeId: string | null,
  websiteUri: string | null,
  websiteQuality: "none" | "weak" | "ok" | "unknown",
): VerificationStatus {
  if (!placeId) return "REGISTRY_ONLY";
  if (!websiteUri) return "NO_WEBSITE_CONFIRMED";
  if (websiteQuality === "ok") return "WEBSITE_GOOD";
  if (websiteQuality === "weak") return "WEBSITE_WEAK";
  if (websiteQuality === "unknown") return "WEBSITE_FOUND";
  return "GOOGLE_VERIFIED";
}

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, { text: string; cls: string }> = {
  REGISTRY_ONLY: { text: "À vérifier", cls: "bg-soft text-muted" },
  GOOGLE_VERIFIED: { text: "Google vérifié", cls: "bg-green-bg text-green-fg" },
  NO_WEBSITE_CONFIRMED: { text: "Aucun site confirmé", cls: "bg-green-bg text-green-fg" },
  WEBSITE_FOUND: { text: "Site trouvé", cls: "bg-soft text-muted" },
  WEBSITE_WEAK: { text: "Site à améliorer", cls: "bg-amber-bg text-amber-fg" },
  WEBSITE_GOOD: { text: "Site correct", cls: "bg-soft text-muted" },
  UNKNOWN: { text: "Information inconnue", cls: "bg-soft text-faint" },
};
