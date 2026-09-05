// Recommandations heuristiques métier -> cibles, par slug de
// business_categories (le métier DE L'UTILISATEUR, pas ses cibles).
// Volontairement simple (pas d'IA) — sert de repli quand l'offre en texte
// libre ne correspond à aucune règle d'intention ci-dessous (voir
// OFFER_INTENT_RULES). Utilisé à la fois par l'onboarding et la page
// Prospection (même logique, jamais deux listes qui divergent).
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
  // Un garage démarche rarement d'autres garages : son offre B2B typique
  // (entretien de flotte, contrats pro) vise des sociétés qui possèdent des
  // véhicules sans être elles-mêmes du métier automobile.
  garages: ["transport", "moving", "cleaning", "security"],
  restaurants: ["realestate", "consulting"],
};

export function recommendedSlugsFor(ownSlug: string | null): string[] | undefined {
  return ownSlug ? TARGET_RECOMMENDATIONS[ownSlug] : undefined;
}

/**
 * Règle fondamentale de la refonte produit : le métier répond à "qui
 * êtes-vous", l'offre répond à "que vendez-vous" — et c'est L'OFFRE qui
 * doit déterminer les cibles pertinentes, pas seulement le métier. Un
 * garagiste qui vend de l'entretien de flotte ne cible pas les mêmes
 * entreprises qu'un garagiste qui vend de la réparation grand public.
 *
 * HONNÊTETÉ : ceci reste un appariement par MOTS-CLÉS sur le texte libre,
 * pas une compréhension sémantique par IA — volontairement, pour ne jamais
 * fabriquer une recommandation qu'on ne peut pas justifier. Si aucun
 * mot-clé ne correspond, on retombe sur TARGET_RECOMMENDATIONS (le métier).
 */
export interface OfferIntentRule {
  id: string;
  keywords: string[];
  /** Familles (slugs parents) recommandées en entier. */
  families?: string[];
  /** Métiers précis (slugs feuilles), y compris hors des familles ci-dessus. */
  leaves?: string[];
  label: string;
}

export const OFFER_INTENT_RULES: OfferIntentRule[] = [
  {
    id: "fleet-maintenance",
    keywords: [
      "flotte", "parc automobile", "parc de vehicules", "parc de véhicules",
      "entretien de vehicules", "entretien de véhicules", "entretien flotte",
      "vehicules d'entreprise", "véhicules d'entreprise", "vehicules professionnels", "véhicules professionnels",
    ],
    families: ["transport-logistique", "btp-artisans"],
    leaves: ["cleaning", "security", "moving", "taxi"],
    label: "Entretien de flotte / véhicules professionnels",
  },
  {
    id: "web-presence",
    keywords: [
      "creation de site", "création de site", "site internet", "site web",
      "refonte de site", "presence en ligne", "présence en ligne", "visibilite en ligne", "visibilité en ligne",
    ],
    leaves: ["restaurants", "hair", "beauty", "garages", "realestate", "dentists", "physio"],
    label: "Entreprises locales avec besoin de présence en ligne",
  },
  {
    id: "site-cleaning",
    keywords: ["bureaux", "hotel", "hôtel", "local commercial", "locaux", "nettoyage de locaux", "proprete", "propreté", "entretien de locaux"],
    leaves: ["hotels", "realestate", "supermarkets", "gyms"],
    label: "Sites physiques nécessitant un entretien régulier",
  },
  {
    id: "b2b-supplies",
    keywords: ["fourniture", "grossiste", "approvisionnement", "materiel professionnel", "matériel professionnel", "consommables professionnels"],
    families: ["btp-artisans", "services-b2b"],
    label: "Professionnels consommateurs de fournitures",
  },
  {
    id: "pro-insurance",
    keywords: ["assurance professionnelle", "assurance pro", "mutuelle entreprise", "protection juridique", "prevoyance", "prévoyance"],
    leaves: ["realestate", "garages", "restaurants"],
    label: "Professionnels avec besoin d'assurance pro",
  },
  {
    id: "corporate-catering",
    keywords: ["traiteur entreprise", "restauration collective", "evenementiel entreprise", "événementiel entreprise", "plateaux repas"],
    leaves: ["realestate"],
    families: ["services-b2b"],
    label: "Entreprises organisant des événements internes",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface OfferRecommendation {
  slugs: string[];
  matchedRules: string[]; // labels des règles d'intention déclenchées, pour affichage ("basé sur : ...")
  basedOnOffer: boolean; // false = repli sur le métier (aucun mot-clé d'offre reconnu)
}

export function recommendedSlugsForOffer(
  offerDescription: string,
  ownSlug: string | null,
  categories: { id: string; slug: string; parent_id: string | null }[],
): OfferRecommendation {
  const normalized = normalize(offerDescription || "");
  const matched = normalized.trim()
    ? OFFER_INTENT_RULES.filter((rule) => rule.keywords.some((kw) => normalized.includes(normalize(kw))))
    : [];

  if (matched.length > 0) {
    const slugs = new Set<string>();
    for (const rule of matched) {
      for (const familySlug of rule.families ?? []) {
        const family = categories.find((c) => c.slug === familySlug && c.parent_id === null);
        if (!family) continue;
        for (const child of categories.filter((c) => c.parent_id === family.id)) slugs.add(child.slug);
      }
      for (const leaf of rule.leaves ?? []) slugs.add(leaf);
    }
    return { slugs: [...slugs], matchedRules: matched.map((r) => r.label), basedOnOffer: true };
  }

  return { slugs: recommendedSlugsFor(ownSlug) ?? [], matchedRules: [], basedOnOffer: false };
}

/**
 * Affine les slugs recommandés selon le type de clientèle déclaré
 * (B2B/B2C/les deux) : une cible purement B2B n'a pas de sens à recommander
 * à un utilisateur qui vend exclusivement en B2C, et inversement. "both"
 * (des deux côtés) ne filtre jamais rien.
 */
export function filterSlugsByAudience<T extends { slug: string; business_type: "b2b" | "b2c" | "both" }>(
  slugs: string[] | undefined,
  categories: T[],
  audience: "b2b" | "b2c" | "both",
): string[] | undefined {
  if (!slugs || audience === "both") return slugs;
  const filtered = slugs.filter((slug) => {
    const cat = categories.find((c) => c.slug === slug);
    return !cat || cat.business_type === "both" || cat.business_type === audience;
  });
  return filtered.length > 0 ? filtered : slugs;
}
