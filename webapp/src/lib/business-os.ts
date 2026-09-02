// Business OS : mêmes 3 modules réutilisables (clients, stock, rendez-vous)
// pour tous les métiers — seul le vocabulaire affiché change. Pas 300
// applications séparées, une config de libellés par famille de métier
// (slug du groupe parent dans business_categories, cf. 0003_seed_categories.sql).

export interface BusinessOsProfile {
  osName: string;
  icon: string;
  customersLabel: string;
  inventoryLabel: string;
  appointmentsLabel: string;
}

const DEFAULT_PROFILE: BusinessOsProfile = {
  osName: "Business OS",
  icon: "▣",
  customersLabel: "Clients",
  inventoryLabel: "Stock",
  appointmentsLabel: "Rendez-vous",
};

const PROFILES: Record<string, BusinessOsProfile> = {
  automobile: {
    osName: "Garage OS",
    icon: "🔧",
    customersLabel: "Clients",
    inventoryLabel: "Pièces",
    appointmentsLabel: "Ordres de réparation",
  },
  "beaute-bien-etre": {
    osName: "Salon OS",
    icon: "✂️",
    customersLabel: "Clients",
    inventoryLabel: "Produits",
    appointmentsLabel: "Rendez-vous",
  },
  restauration: {
    osName: "Restaurant OS",
    icon: "🍽",
    customersLabel: "Clients",
    inventoryLabel: "Ingrédients",
    appointmentsLabel: "Réservations",
  },
  "numerique-communication": {
    osName: "Agency OS",
    icon: "💻",
    customersLabel: "Clients",
    inventoryLabel: "Ressources / licences",
    appointmentsLabel: "Échéances projet",
  },
  "bien-etre-therapies": {
    osName: "Practice OS",
    icon: "🧘",
    customersLabel: "Clients",
    inventoryLabel: "Consommables",
    appointmentsLabel: "Séances",
  },
  "btp-artisans": {
    osName: "Chantier OS",
    icon: "🧱",
    customersLabel: "Clients",
    inventoryLabel: "Matériaux",
    appointmentsLabel: "Chantiers",
  },
};

export function getBusinessOsProfile(parentSlug: string | null): BusinessOsProfile {
  if (!parentSlug) return DEFAULT_PROFILE;
  return PROFILES[parentSlug] ?? DEFAULT_PROFILE;
}
