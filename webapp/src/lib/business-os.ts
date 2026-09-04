// Business OS : le vocabulaire ET les modules changent selon le métier.
// Les 3 modules génériques (clients/stock/rendez-vous) restent le socle
// commun à tous les métiers ; les 4 familles ci-dessous ("vertical") gagnent
// en plus un ou deux modules propres à leur workflow réel (voir 0016) —
// les autres métiers restent sur le socle générique seul.

export type BusinessOsVertical = "garage" | "cleaning" | "agency" | "restaurant" | "generic";

export interface BusinessOsProfile {
  vertical: BusinessOsVertical;
  osName: string;
  icon: string;
  customersLabel: string;
  inventoryLabel: string;
  appointmentsLabel: string;
}

const DEFAULT_PROFILE: BusinessOsProfile = {
  vertical: "generic",
  osName: "Business OS",
  icon: "▣",
  customersLabel: "Clients",
  inventoryLabel: "Stock",
  appointmentsLabel: "Rendez-vous",
};

// Certains métiers ont besoin d'un vocabulaire différent de celui de toute
// leur famille (ex. "Sécurité privée" et "Cabinets comptables" partagent la
// famille "Services B2B" mais n'ont rien à voir) : ces profils, indexés par
// le slug du métier précis (feuille), sont vérifiés avant ceux par famille.
const LEAF_PROFILES: Record<string, BusinessOsProfile> = {
  cleaning: {
    vertical: "cleaning",
    osName: "Nettoyage OS",
    icon: "🧹",
    customersLabel: "Clients",
    inventoryLabel: "Consommables & matériel",
    appointmentsLabel: "Interventions",
  },
  security: {
    vertical: "generic",
    osName: "Sécurité OS",
    icon: "🔒",
    customersLabel: "Sites sous contrat",
    inventoryLabel: "Équipements",
    appointmentsLabel: "Planning agents",
  },
};

const PROFILES: Record<string, BusinessOsProfile> = {
  automobile: {
    vertical: "garage",
    osName: "Garage OS",
    icon: "🔧",
    customersLabel: "Clients",
    inventoryLabel: "Pièces",
    appointmentsLabel: "Rendez-vous atelier",
  },
  "beaute-bien-etre": {
    vertical: "generic",
    osName: "Salon OS",
    icon: "✂️",
    customersLabel: "Clients",
    inventoryLabel: "Produits",
    appointmentsLabel: "Rendez-vous",
  },
  restauration: {
    vertical: "restaurant",
    osName: "Restaurant OS",
    icon: "🍽",
    customersLabel: "Clients",
    inventoryLabel: "Ingrédients",
    appointmentsLabel: "Réservations",
  },
  "numerique-communication": {
    vertical: "agency",
    osName: "Agency OS",
    icon: "💻",
    customersLabel: "Clients",
    inventoryLabel: "Ressources / licences",
    appointmentsLabel: "Échéances",
  },
  "bien-etre-therapies": {
    vertical: "generic",
    osName: "Practice OS",
    icon: "🧘",
    customersLabel: "Clients",
    inventoryLabel: "Consommables",
    appointmentsLabel: "Séances",
  },
  "btp-artisans": {
    vertical: "generic",
    osName: "Chantier OS",
    icon: "🧱",
    customersLabel: "Clients",
    inventoryLabel: "Matériaux",
    appointmentsLabel: "Chantiers",
  },
};

export function getBusinessOsProfile(parentSlug: string | null, leafSlug: string | null = null): BusinessOsProfile {
  if (leafSlug && LEAF_PROFILES[leafSlug]) return LEAF_PROFILES[leafSlug];
  if (!parentSlug) return DEFAULT_PROFILE;
  return PROFILES[parentSlug] ?? DEFAULT_PROFILE;
}
