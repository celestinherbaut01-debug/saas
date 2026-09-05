// Business OS : le vocabulaire ET les modules changent selon le métier.
// Les 3 modules génériques (clients/stock/rendez-vous) restent le socle
// commun à tous les métiers ; les 4 familles ci-dessous ("vertical") gagnent
// en plus un ou deux modules propres à leur workflow réel (voir 0016) —
// les autres métiers restent sur le socle générique seul.
//
// RÈGLE IMPORTANTE (corrigée) : une verticale dédiée (garage/cleaning/
// agency/restaurant) ne doit être assignée qu'aux métiers dont le workflow
// RÉEL correspond — jamais à toute une famille par commodité. Exemple de
// bug corrigé : "numerique-communication" routait aussi bien un
// photographe ou un designer graphique vers l'Agency OS (domaines,
// hébergements, tickets) que vers une vraie agence web — aucun rapport
// avec leur activité. Même chose pour "automobile" : un loueur de voitures
// ou une auto-école n'ont pas d'ordres de réparation. Ces métiers gardent
// donc un profil (icône/libellés) au niveau famille, mais restent sur la
// verticale "generic" — seuls les métiers feuilles listés ci-dessous, dont
// le workflow correspond vraiment, déclenchent la verticale dédiée.

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

const GARAGE_PROFILE: BusinessOsProfile = {
  vertical: "garage",
  osName: "Garage OS",
  icon: "🔧",
  customersLabel: "Clients",
  inventoryLabel: "Pièces",
  appointmentsLabel: "Rendez-vous atelier",
};

const AGENCY_PROFILE: BusinessOsProfile = {
  vertical: "agency",
  osName: "Agency OS",
  icon: "💻",
  customersLabel: "Clients",
  inventoryLabel: "Ressources / licences",
  appointmentsLabel: "Échéances",
};

// Certains métiers ont besoin d'un vocabulaire différent de celui de toute
// leur famille (ex. "Sécurité privée" et "Cabinets comptables" partagent la
// famille "Services B2B" mais n'ont rien à voir) : ces profils, indexés par
// le slug du métier précis (feuille), sont vérifiés avant ceux par famille.
//
// Seuls les métiers dont le workflow réel correspond à la verticale
// obtiennent "garage"/"agency" ici — ex. "garages"/"bodyshop"/"tyres" font
// vraiment des ordres de réparation ; "dealers"/"carrental"/"drivingschool"
// n'en font pas et restent sur le profil de famille (generic, ci-dessous).
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
  garages: GARAGE_PROFILE,
  bodyshop: { ...GARAGE_PROFILE, osName: "Carrosserie OS" },
  tyres: { ...GARAGE_PROFILE, osName: "Centre auto OS" },
  web: AGENCY_PROFILE,
};

const PROFILES: Record<string, BusinessOsProfile> = {
  // Reste sur "generic" : un loueur de voitures, un concessionnaire, une
  // auto-école ou un lavage automobile ne font pas d'ordres de réparation
  // (seuls garages/bodyshop/tyres, ci-dessus, ont le vrai workflow garage).
  automobile: {
    vertical: "generic",
    osName: "Automobile OS",
    icon: "🚗",
    customersLabel: "Clients",
    inventoryLabel: "Stock",
    appointmentsLabel: "Rendez-vous",
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
  // Reste sur "generic" : un photographe, un designer ou une agence
  // marketing ne gèrent pas de domaines/hébergements clients (seule "web",
  // ci-dessus, a le vrai workflow agence web).
  "numerique-communication": {
    vertical: "generic",
    osName: "Studio OS",
    icon: "💻",
    customersLabel: "Clients",
    inventoryLabel: "Ressources",
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
