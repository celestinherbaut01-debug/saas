// CATALOGUE D'OBJECTIFS DE PROSPECTION — cœur de la refonte : remplace le
// choix "texte libre + catalogue de 140 métiers" par une question fermée
// ("Que souhaitez-vous développer ?") dont la réponse déclenche à elle
// seule une stratégie complète (cibles, signaux, canal). Le métier de
// l'utilisateur vient TOUJOURS du profil (business_profiles.own_category_id),
// jamais retapé en texte libre ici — voir resolveProspectingObjectives.
//
// HONNÊTETÉ : les signaux listés ici ne sont jamais garantis. "Activité
// compatible avec déplacements" est un signal PROBABLE dérivé de la
// catégorie NAF choisie (une entreprise de nettoyage utilise probablement
// des véhicules), jamais une donnée confirmée sur l'entreprise elle-même —
// voir SignalDef.confidence et son affichage dans la stratégie recommandée.
//
// RECOMMANDATIONS EN CHIPS (jamais une liste géante) — bug corrigé : une
// première version résolvait des familles ENTIÈRES (parfois 15-20 métiers
// feuilles) et les affichait toutes, nommément, dans une seule phrase —
// donnant l'impression exactement inverse de "ProspectFlow comprend mon
// activité". Chaque objectif porte maintenant 5 à 8 CHIPS curés à la main
// (ex. "Artisans" représente un sous-ensemble représentatif de métiers du
// bâtiment, jamais tous), sélectionnés par défaut mais désélectionnables
// individuellement. Le catalogue complet reste accessible via "Explorer
// d'autres secteurs" (voir prospecting-wizard.tsx) — rien n'est supprimé,
// seule la présentation par défaut change.

export type SignalConfidence = "confirmed" | "probable" | "unknown";

export interface SignalDef {
  id: string;
  label: string;
  confidence: SignalConfidence;
}

export interface RecommendationChip {
  id: string;
  label: string;
  icon: string;
  /** Slugs de catégories FEUILLES réelles que ce chip représente (jamais une famille entière listée nommément). */
  leafSlugs: string[];
}

export interface ProspectingObjective {
  id: string;
  /** Libellé du choix ("Entretien de flottes professionnelles"). */
  label: string;
  /** "Pour cette offre, nous allons privilégier..." — affiché dans l'étape Stratégie. */
  strategyExplanation: string;
  audience: "b2b" | "b2c";
  /** Recommandations par défaut — 5 à 8 chips maximum, jamais une liste exhaustive. */
  recommendations: RecommendationChip[];
  signals: SignalDef[];
  /** true seulement pour les objectifs digitaux — seul cas où le statut du site est un signal pertinent. */
  showWebSignal: boolean;
}

const PROXIMITY_SIGNAL: SignalDef = { id: "proximity", label: "Proximité géographique", confidence: "confirmed" };
const CONTACT_SIGNAL: SignalDef = { id: "contact", label: "Coordonnées disponibles (téléphone/fiche)", confidence: "confirmed" };
const SIZE_SIGNAL: SignalDef = { id: "size", label: "Taille de la structure (si connue)", confidence: "unknown" };
const MULTI_SITE_SIGNAL: SignalDef = { id: "multi_site", label: "Multi-établissements", confidence: "confirmed" };
const ACTIVITY_VEHICLES_SIGNAL: SignalDef = { id: "activity_vehicles", label: "Activité impliquant probablement des déplacements/véhicules", confidence: "probable" };
const ESTABLISHMENTS_SIGNAL: SignalDef = { id: "establishments", label: "Nombre d'établissements", confidence: "confirmed" };
const ACTIVE_PRESENCE_SIGNAL: SignalDef = { id: "active_presence", label: "Présence Google active (avis récents)", confidence: "probable" };

// --- Chips réutilisés tels quels par plusieurs objectifs (jamais redéfinis deux fois différemment) ---
const CHIP_TRANSPORT: RecommendationChip = { id: "transport", label: "Transport / livraison", icon: "🚚", leafSlugs: ["transport", "moving", "freight", "taxi", "vanrental"] };
const CHIP_BTP: RecommendationChip = { id: "btp", label: "BTP", icon: "🏗", leafSlugs: ["carpentry", "masonry", "electric", "plumbing", "roofing", "painting"] };
const CHIP_CLEANING: RecommendationChip = { id: "cleaning", label: "Nettoyage", icon: "🧹", leafSlugs: ["cleaning"] };
const CHIP_SECURITY: RecommendationChip = { id: "security", label: "Sécurité", icon: "🛡", leafSlugs: ["security"] };
const CHIP_MAINTENANCE: RecommendationChip = { id: "maintenance", label: "Maintenance", icon: "🔧", leafSlugs: ["repair"] };
const CHIP_HOME_SERVICES: RecommendationChip = { id: "home_services", label: "Services à domicile", icon: "🏠", leafSlugs: ["landscape", "petgroom", "laundry"] };
const CHIP_RESTAURANTS: RecommendationChip = { id: "restaurants", label: "Restaurants", icon: "🍽", leafSlugs: ["restaurants", "pizzeria", "fastfood"] };
const CHIP_GARAGES: RecommendationChip = { id: "garages", label: "Garages", icon: "🚗", leafSlugs: ["garages", "bodyshop", "tyres"] };
const CHIP_ARTISANS: RecommendationChip = { id: "artisans", label: "Artisans", icon: "🛠", leafSlugs: ["carpentry", "masonry", "electric", "plumbing", "painting"] };
const CHIP_SALONS: RecommendationChip = { id: "salons", label: "Salons", icon: "💇", leafSlugs: ["hair", "beauty", "barbers", "nails", "spa"] };
const CHIP_LOCAL_SHOPS: RecommendationChip = { id: "local_shops", label: "Commerces locaux", icon: "🛍", leafSlugs: ["clothing", "bookstores", "florists", "jewelry", "shoes", "hardware"] };
const CHIP_INDEPENDENT_OFFICES: RecommendationChip = { id: "offices", label: "Cabinets indépendants", icon: "💼", leafSlugs: ["accounting", "law", "consulting", "architects"] };
const CHIP_FOOD_SHOPS: RecommendationChip = { id: "food_shops", label: "Commerces alimentaires", icon: "🥖", leafSlugs: ["bakery", "butcher", "greengrocer", "cheese", "wine"] };
const CHIP_DECOR_SHOPS: RecommendationChip = { id: "decor_shops", label: "Décoration / mobilier", icon: "🛋", leafSlugs: ["furniture", "decor", "florists"] };
const CHIP_HOTELS: RecommendationChip = { id: "hotels", label: "Hôtels", icon: "🏨", leafSlugs: ["hotels", "gites", "campings"] };
const CHIP_SUPERMARKETS: RecommendationChip = { id: "supermarkets", label: "Supermarchés", icon: "🛒", leafSlugs: ["supermarkets", "convenience"] };
const CHIP_REALESTATE_PROS: RecommendationChip = { id: "realestate_pros", label: "Immobilier / syndics", icon: "🏢", leafSlugs: ["realestate", "propertymgmt"] };
const CHIP_WAREHOUSES: RecommendationChip = { id: "warehouses", label: "Entrepôts / logistique", icon: "📦", leafSlugs: ["warehousing", "freight", "transport"] };
const CHIP_EVENTS: RecommendationChip = { id: "events", label: "Événementiel", icon: "🎉", leafSlugs: ["events"] };
const CHIP_INSURANCE_DEALERS: RecommendationChip = { id: "insurance_dealers", label: "Assurances / concessionnaires", icon: "🤝", leafSlugs: ["insurance", "dealers", "carrental"] };

const GARAGE_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "garage_fleet",
    label: "Entretien de flottes professionnelles",
    strategyExplanation: "Pour cette offre, toutes les entreprises ne sont pas pertinentes. Nous allons privilégier les activités susceptibles d'utiliser plusieurs véhicules.",
    audience: "b2b",
    recommendations: [CHIP_TRANSPORT, CHIP_BTP, CHIP_CLEANING, CHIP_SECURITY, CHIP_MAINTENANCE, CHIP_HOME_SERVICES],
    signals: [ACTIVITY_VEHICLES_SIGNAL, SIZE_SIGNAL, ESTABLISHMENTS_SIGNAL, PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "garage_pro_repair",
    label: "Réparation de véhicules professionnels",
    strategyExplanation: "Nous allons privilégier les entreprises dont l'activité repose probablement sur des véhicules utilitaires ou professionnels.",
    audience: "b2b",
    recommendations: [CHIP_TRANSPORT, CHIP_BTP, CHIP_CLEANING, CHIP_SECURITY],
    signals: [ACTIVITY_VEHICLES_SIGNAL, PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "garage_pro_tyres",
    label: "Pneus professionnels",
    strategyExplanation: "Les flottes professionnelles renouvellent leurs pneus régulièrement — nous privilégions les activités à forte utilisation de véhicules.",
    audience: "b2b",
    recommendations: [CHIP_TRANSPORT, CHIP_BTP, CHIP_HOME_SERVICES],
    signals: [ACTIVITY_VEHICLES_SIGNAL, SIZE_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "garage_contract",
    label: "Contrat d'entretien pour entreprises",
    strategyExplanation: "Nous privilégions les entreprises susceptibles de vouloir externaliser l'entretien de leurs véhicules sur la durée.",
    audience: "b2b",
    recommendations: [CHIP_TRANSPORT, CHIP_BTP, CHIP_CLEANING, CHIP_SECURITY, CHIP_MAINTENANCE],
    signals: [ACTIVITY_VEHICLES_SIGNAL, SIZE_SIGNAL, ESTABLISHMENTS_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "garage_b2b_partnerships",
    label: "Partenariats entreprises (assurances, concessionnaires...)",
    strategyExplanation: "Nous recherchons des professionnels qui orientent régulièrement leurs propres clients vers un garage de confiance.",
    audience: "b2b",
    recommendations: [CHIP_INSURANCE_DEALERS],
    signals: [PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "garage_used_cars",
    label: "Vente de véhicules d'occasion",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "garage_b2c",
    label: "Entretien / réparation pour particuliers",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
];

const DIGITAL_SIGNALS: SignalDef[] = [
  { id: "no_website", label: "Aucun site détecté", confidence: "probable" },
  { id: "weak_website", label: "Site existant à analyser (faible/daté)", confidence: "probable" },
  { id: "gmb_no_site", label: "Fiche Google sans site détecté", confidence: "probable" },
  { id: "new_business", label: "Nouvelle entreprise", confidence: "confirmed" },
  { id: "reviews_no_web", label: "Beaucoup d'avis mais présence web faible", confidence: "probable" },
  { id: "independent", label: "Indépendants (hors chaînes/franchises)", confidence: "confirmed" },
];

const AGENCY_WEB_RECOMMENDATIONS = [CHIP_RESTAURANTS, CHIP_GARAGES, CHIP_ARTISANS, CHIP_SALONS, CHIP_LOCAL_SHOPS, CHIP_INDEPENDENT_OFFICES];

const AGENCY_WEB_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "web_creation",
    label: "Création de site internet",
    strategyExplanation: "Pour cette offre, l'absence de site (ou un site très faible) est le signal le plus pertinent — nous privilégions les commerces et artisans locaux.",
    audience: "b2b",
    recommendations: AGENCY_WEB_RECOMMENDATIONS,
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
  {
    id: "web_refonte",
    label: "Refonte de site",
    strategyExplanation: "Nous privilégions les entreprises avec un site déjà existant mais daté ou peu qualitatif.",
    audience: "b2b",
    recommendations: AGENCY_WEB_RECOMMENDATIONS,
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
  {
    id: "web_ecommerce",
    label: "E-commerce",
    strategyExplanation: "Nous privilégions les commerces vendant des produits physiques, sans boutique en ligne détectée.",
    audience: "b2b",
    recommendations: [CHIP_LOCAL_SHOPS, CHIP_FOOD_SHOPS, CHIP_DECOR_SHOPS],
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
  {
    id: "web_seo",
    label: "SEO / référencement",
    strategyExplanation: "Nous privilégions les entreprises avec une présence web existante mais peu optimisée.",
    audience: "b2b",
    recommendations: AGENCY_WEB_RECOMMENDATIONS,
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
  {
    id: "web_maintenance",
    label: "Maintenance de site",
    strategyExplanation: "Nous privilégions les entreprises ayant déjà un site (donc un contrat de maintenance possible).",
    audience: "b2b",
    recommendations: AGENCY_WEB_RECOMMENDATIONS,
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
  {
    id: "web_digital_acquisition",
    label: "Acquisition digitale (SEA/social ads)",
    strategyExplanation: "Nous privilégions les entreprises avec une présence en ligne existante mais peu de visibilité payante détectable.",
    audience: "b2b",
    recommendations: AGENCY_WEB_RECOMMENDATIONS,
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
];

const MARKETING_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "marketing_visibility",
    label: "Visibilité locale / réseaux sociaux",
    strategyExplanation: "Nous privilégions les commerces avec une présence en ligne faible malgré une activité réelle (avis, fiche Google).",
    audience: "b2b",
    recommendations: [CHIP_RESTAURANTS, CHIP_SALONS, CHIP_LOCAL_SHOPS, CHIP_REALESTATE_PROS],
    signals: DIGITAL_SIGNALS,
    showWebSignal: true,
  },
  {
    id: "marketing_campaigns",
    label: "Campagnes publicitaires",
    strategyExplanation: "Nous privilégions les commerces locaux avec une clientèle grand public.",
    audience: "b2b",
    recommendations: [CHIP_RESTAURANTS, CHIP_SALONS, CHIP_LOCAL_SHOPS],
    signals: [ACTIVE_PRESENCE_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
];

const CLEANING_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "cleaning_offices",
    label: "Nettoyage de bureaux",
    strategyExplanation: "Nous privilégions les entreprises et cabinets disposant de locaux professionnels réguliers — jamais un critère de site web, sans rapport avec ce besoin.",
    audience: "b2b",
    recommendations: [CHIP_INDEPENDENT_OFFICES, CHIP_REALESTATE_PROS],
    signals: [ESTABLISHMENTS_SIGNAL, SIZE_SIGNAL, PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "cleaning_commerce",
    label: "Nettoyage de commerces",
    strategyExplanation: "Nous privilégions les commerces et supermarchés avec un passage régulier.",
    audience: "b2b",
    recommendations: [CHIP_LOCAL_SHOPS, CHIP_SUPERMARKETS],
    signals: [ESTABLISHMENTS_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "cleaning_hotels",
    label: "Nettoyage d'hôtels",
    strategyExplanation: "Nous privilégions les hébergements avec un besoin de nettoyage quotidien.",
    audience: "b2b",
    recommendations: [CHIP_HOTELS],
    signals: [SIZE_SIGNAL, MULTI_SITE_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "cleaning_copro",
    label: "Nettoyage de copropriétés",
    strategyExplanation: "Nous privilégions les gestionnaires immobiliers et syndics susceptibles de mandater un prestataire.",
    audience: "b2b",
    recommendations: [CHIP_REALESTATE_PROS],
    signals: [ESTABLISHMENTS_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "cleaning_warehouses",
    label: "Nettoyage d'entrepôts",
    strategyExplanation: "Nous privilégions les acteurs de la logistique avec de grandes surfaces à entretenir.",
    audience: "b2b",
    recommendations: [CHIP_WAREHOUSES],
    signals: [SIZE_SIGNAL, ESTABLISHMENTS_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "cleaning_construction",
    label: "Nettoyage après chantier",
    strategyExplanation: "Nous privilégions les artisans et entreprises du bâtiment susceptibles de sous-traiter le nettoyage de fin de chantier.",
    audience: "b2b",
    recommendations: [CHIP_BTP],
    signals: [PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "cleaning_b2c",
    label: "Nettoyage pour particuliers",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
];

const RESTAURANT_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "restaurant_local",
    label: "Clientèle locale (service à table)",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "restaurant_corporate",
    label: "Traiteur entreprise / restauration collective",
    strategyExplanation: "Nous privilégions les entreprises susceptibles d'organiser des événements internes ou des repas de groupe réguliers.",
    audience: "b2b",
    recommendations: [CHIP_INDEPENDENT_OFFICES, CHIP_REALESTATE_PROS, CHIP_EVENTS],
    signals: [SIZE_SIGNAL, PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "restaurant_delivery",
    label: "Livraison / vente à emporter",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
];

const SALON_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "salon_b2c",
    label: "Clientèle particuliers",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "salon_corporate",
    label: "Partenariats entreprises (CE, événementiel)",
    strategyExplanation: "Nous privilégions les entreprises susceptibles d'organiser des prestations bien-être pour leurs équipes.",
    audience: "b2b",
    recommendations: [CHIP_INDEPENDENT_OFFICES, CHIP_REALESTATE_PROS, CHIP_EVENTS],
    signals: [SIZE_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
];

const ARTISAN_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "artisan_b2c",
    label: "Chantiers pour particuliers",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "artisan_subcontracting",
    label: "Sous-traitance pour professionnels du bâtiment",
    strategyExplanation: "Nous privilégions les autres corps de métier du bâtiment susceptibles de sous-traiter une partie de leurs chantiers.",
    audience: "b2b",
    recommendations: [CHIP_BTP, CHIP_REALESTATE_PROS],
    signals: [PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "artisan_corporate",
    label: "Grandes entreprises / marchés professionnels",
    strategyExplanation: "Nous privilégions les entreprises et gestionnaires de locaux avec des besoins de travaux réguliers.",
    audience: "b2b",
    recommendations: [CHIP_INDEPENDENT_OFFICES, CHIP_REALESTATE_PROS],
    signals: [SIZE_SIGNAL, ESTABLISHMENTS_SIGNAL],
    showWebSignal: false,
  },
];

const REALESTATE_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "realestate_sellers",
    label: "Trouver des propriétaires vendeurs",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "realestate_buyers",
    label: "Trouver des acquéreurs",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "realestate_rental",
    label: "Location",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
  {
    id: "realestate_investors",
    label: "Investisseurs",
    strategyExplanation: "Nous privilégions les professionnels conseillant ou accompagnant des investisseurs immobiliers.",
    audience: "b2b",
    recommendations: [{ id: "advisors", label: "Cabinets conseil / gestion de patrimoine", icon: "📊", leafSlugs: ["accounting", "consulting", "expertise"] }],
    signals: [PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "realestate_commercial",
    label: "Immobilier commercial / bureaux pour entreprises",
    strategyExplanation: "Nous privilégions les entreprises susceptibles de rechercher ou céder des locaux professionnels.",
    audience: "b2b",
    recommendations: [CHIP_INDEPENDENT_OFFICES, CHIP_LOCAL_SHOPS],
    signals: [SIZE_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "realestate_partners",
    label: "Partenaires professionnels (notaires, courtiers...)",
    strategyExplanation: "Nous recherchons des professionnels qui orientent régulièrement leurs propres clients.",
    audience: "b2b",
    recommendations: [{ id: "notaries", label: "Notaires / courtiers", icon: "🤝", leafSlugs: ["notary", "insurance"] }],
    signals: [PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
];

const SUPPLIER_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "supplier_b2b",
    label: "Fourniture de matériel / consommables professionnels",
    strategyExplanation: "Nous privilégions les entreprises structurées avec un volume d'achat professionnel régulier.",
    audience: "b2b",
    recommendations: [CHIP_BTP, CHIP_TRANSPORT, CHIP_LOCAL_SHOPS, CHIP_GARAGES],
    signals: [SIZE_SIGNAL, ESTABLISHMENTS_SIGNAL, PROXIMITY_SIGNAL],
    showWebSignal: false,
  },
];

/** Repli générique — métiers non couverts explicitement par le catalogue ci-dessus. Reste honnête : moins précis, jamais un blocage. */
const GENERIC_OBJECTIVES: ProspectingObjective[] = [
  {
    id: "generic_b2b",
    label: "Développer ma clientèle professionnelle (B2B)",
    strategyExplanation: "Décrivez votre offre pour affiner les cibles recommandées — en attendant, nous partons sur un ciblage professionnel généraliste.",
    audience: "b2b",
    recommendations: [],
    signals: [SIZE_SIGNAL, PROXIMITY_SIGNAL, CONTACT_SIGNAL],
    showWebSignal: false,
  },
  {
    id: "generic_b2c",
    label: "Développer ma clientèle particuliers (B2C)",
    strategyExplanation: "",
    audience: "b2c",
    recommendations: [],
    signals: [],
    showWebSignal: false,
  },
];

const OBJECTIVES_BY_LEAF_SLUG: Record<string, ProspectingObjective[]> = {
  garages: GARAGE_OBJECTIVES,
  bodyshop: GARAGE_OBJECTIVES,
  tyres: GARAGE_OBJECTIVES,
  web: AGENCY_WEB_OBJECTIVES,
  it: AGENCY_WEB_OBJECTIVES,
  marketing: MARKETING_OBJECTIVES,
  design: MARKETING_OBJECTIVES,
  cleaning: CLEANING_OBJECTIVES,
  security: CLEANING_OBJECTIVES,
  realestate: REALESTATE_OBJECTIVES,
  wholesale: SUPPLIER_OBJECTIVES,
  autoparts: SUPPLIER_OBJECTIVES,
};

const OBJECTIVES_BY_FAMILY_SLUG: Record<string, ProspectingObjective[]> = {
  restauration: RESTAURANT_OBJECTIVES,
  "beaute-bien-etre": SALON_OBJECTIVES,
  "btp-artisans": ARTISAN_OBJECTIVES,
};

/**
 * Résout les objectifs disponibles pour "Que souhaitez-vous développer ?" à
 * partir du métier PROPRE de l'utilisateur (jamais retapé) — leaf slug
 * d'abord, famille ensuite, repli générique sinon. `audience` (déclarée
 * dans business_profiles) filtre le repli générique (pas de sens à proposer
 * "développer ma clientèle B2B" à qui a déclaré vendre exclusivement B2C).
 */
export function resolveProspectingObjectives(leafSlug: string | null, parentSlug: string | null): ProspectingObjective[] {
  if (leafSlug && OBJECTIVES_BY_LEAF_SLUG[leafSlug]) return OBJECTIVES_BY_LEAF_SLUG[leafSlug];
  if (parentSlug && OBJECTIVES_BY_FAMILY_SLUG[parentSlug]) return OBJECTIVES_BY_FAMILY_SLUG[parentSlug];
  return GENERIC_OBJECTIVES;
}

export function findObjective(leafSlug: string | null, parentSlug: string | null, objectiveId: string): ProspectingObjective | null {
  return resolveProspectingObjectives(leafSlug, parentSlug).find((o) => o.id === objectiveId) ?? null;
}

// Objectifs qui valorisent la taille/le nombre d'établissements plutôt que
// le statut du site (contrat, volume d'achat, sous-traitance) — même
// logique que "contract_potential" côté scoring.ts, mais décidée par
// l'OBJECTIF plutôt que par le métier propre de l'utilisateur : la MÊME
// entreprise "Nord Clean Services" doit pouvoir scorer différemment selon
// que l'utilisateur cherche à lui vendre un site (digital_opportunity) ou
// à lui sous-traiter du nettoyage de flotte (contract_potential).
const CONTRACT_OBJECTIVE_IDS = new Set([
  "garage_fleet",
  "garage_pro_repair",
  "garage_pro_tyres",
  "garage_contract",
  "cleaning_offices",
  "cleaning_commerce",
  "cleaning_hotels",
  "cleaning_copro",
  "cleaning_warehouses",
  "artisan_corporate",
  "artisan_subcontracting",
  "supplier_b2b",
  "restaurant_corporate",
  "salon_corporate",
  "realestate_commercial",
]);

/**
 * relevance_score_for_offer : le profil de scoring dépend de l'OBJECTIF
 * choisi, pas seulement du métier/audience de l'utilisateur — voir
 * resolveScoringProfile (scoring.ts) qui accepte cet override.
 */
export function scoringProfileForObjective(objective: ProspectingObjective): "digital_opportunity" | "marketing_potential" | "contract_potential" | "b2b_commercial" | "generic" {
  if (objective.showWebSignal) {
    return objective.id.startsWith("marketing_") ? "marketing_potential" : "digital_opportunity";
  }
  if (CONTRACT_OBJECTIVE_IDS.has(objective.id)) return "contract_potential";
  if (objective.audience === "b2b") return "b2b_commercial";
  return "generic";
}

/** Résout les slugs de catégories réelles représentés par un chip. */
export function resolveChipTargetSlugs(chip: RecommendationChip): string[] {
  return chip.leafSlugs;
}

/**
 * Union des chips SÉLECTIONNÉS (tous par défaut) en slugs de catégories
 * réelles — jamais une famille entière listée nommément (voir l'en-tête de
 * ce fichier). `selectedChipIds` omis = tous les chips de l'objectif.
 */
export function resolveObjectiveTargetSlugs(objective: ProspectingObjective, selectedChipIds?: Set<string>): string[] {
  const slugs = new Set<string>();
  for (const chip of objective.recommendations) {
    if (selectedChipIds && !selectedChipIds.has(chip.id)) continue;
    for (const slug of chip.leafSlugs) slugs.add(slug);
  }
  return [...slugs];
}
