// Recommandations heuristiques métier -> cibles, par slug de
// business_categories (le métier DE L'UTILISATEUR, pas ses cibles).
// Volontairement simple (pas d'IA) — affiné plus tard avec un vrai moteur
// basé sur l'offre décrite en texte libre. Utilisé à la fois par
// l'onboarding et la page Prospection (même logique, jamais deux listes
// qui divergent).
export const TARGET_RECOMMENDATIONS: Record<string, string[]> = {
  web: ["restaurants", "garages", "hair", "realestate", "dentists"],
  it: ["restaurants", "garages", "hair", "realestate"],
  marketing: ["restaurants", "hair", "beauty", "realestate"],
  design: ["restaurants", "hair", "beauty"],
  photo: ["hair", "beauty", "realestate"],
  cleaning: ["hotels", "gyms", "realestate", "dentists"],
  security: ["realestate", "supermarkets"],
  accounting: ["restaurants", "garages", "hair", "realestate"],
  law: ["realestate", "dealers"],
  consulting: ["realestate", "accounting"],
  insurance: ["realestate", "garages"],
};

export function recommendedSlugsFor(ownSlug: string | null): string[] | undefined {
  return ownSlug ? TARGET_RECOMMENDATIONS[ownSlug] : undefined;
}
