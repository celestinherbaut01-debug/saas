import type { OfferType, StudioVertical } from "./types";

// Dérive la verticale STUDIO (vocabulaire marketing) du métier propre de
// l'utilisateur — même arbre de catégories que business-os.ts, mais un
// vocabulaire différent : la Verticale Business OS répond à "quel workflow
// interne ?", celle-ci répond à "quel type de contenu marketing a du sens ?"
// (ex. un artisan et une agence web n'ont pas le même Business OS, mais
// partagent le même besoin de "Réalisation" en Studio).
const LEAF_VERTICAL: Record<string, StudioVertical> = {
  garages: "garage",
  bodyshop: "garage",
  tyres: "garage",
  cleaning: "cleaning",
  web: "agency",
  realestate: "realestate",
};

const FAMILY_VERTICAL: Record<string, StudioVertical> = {
  restauration: "restaurant",
  "beaute-bien-etre": "salon",
  "btp-artisans": "artisan",
  "numerique-communication": "agency",
  commerce: "commerce",
};

export function resolveStudioVertical(leafSlug: string | null, parentSlug: string | null): StudioVertical {
  if (leafSlug && LEAF_VERTICAL[leafSlug]) return LEAF_VERTICAL[leafSlug];
  if (parentSlug && FAMILY_VERTICAL[parentSlug]) return FAMILY_VERTICAL[parentSlug];
  return "generic";
}

export const STUDIO_VERTICAL_LABEL: Record<StudioVertical, string> = {
  garage: "Garage",
  restaurant: "Restaurant",
  salon: "Salon / institut",
  artisan: "Artisan / BTP",
  agency: "Agence",
  cleaning: "Nettoyage",
  commerce: "Commerce",
  realestate: "Immobilier",
  generic: "Général",
};

export const OFFER_TYPE_LABEL: Record<OfferType, string> = {
  produit: "Produit",
  service: "Service",
  bien: "Bien immobilier",
  realisation: "Réalisation",
  evenement: "Événement",
  promotion: "Promotion",
};

// Types d'offre pertinents par verticale — jamais tous proposés partout
// (un garage ne vend pas de "bien", un agent immobilier généraliste ne
// vend pas de "produit").
const OFFER_TYPES_BY_VERTICAL: Record<StudioVertical, OfferType[]> = {
  garage: ["service", "promotion", "realisation"],
  restaurant: ["produit", "evenement", "promotion"],
  salon: ["service", "promotion", "realisation"],
  artisan: ["realisation", "service", "promotion"],
  agency: ["realisation", "service", "promotion"],
  cleaning: ["service", "promotion"],
  commerce: ["produit", "promotion", "evenement"],
  realestate: ["bien", "evenement", "promotion"],
  generic: ["produit", "service", "evenement", "promotion", "realisation"],
};

export function offerTypesForVertical(vertical: StudioVertical): OfferType[] {
  return OFFER_TYPES_BY_VERTICAL[vertical];
}
