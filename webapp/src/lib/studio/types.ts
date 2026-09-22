// STUDIO IA — types partagés. Voir generator.ts pour la discipline centrale :
// le générateur ne fait JAMAIS que composer les champs de StudioInput
// (remplis par l'utilisateur) + BrandKit + l'identité de l'entreprise —
// il n'invente jamais un prix, une caractéristique ou une performance.

export type StudioVertical = "garage" | "restaurant" | "salon" | "artisan" | "agency" | "cleaning" | "commerce" | "realestate" | "generic";

export type OfferType = "produit" | "service" | "bien" | "realisation" | "evenement" | "promotion";

export type BrandTone = "professionnel" | "chaleureux" | "dynamique" | "premium";

export interface BrandKit {
  tone: BrandTone;
  primaryColor: string;
  accentColor: string;
  tagline: string | null;
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  tone: "professionnel",
  primaryColor: "#111111",
  accentColor: "#2563eb",
  tagline: null,
};

/**
 * Champs communs à toute création, + champs spécifiques à `bien` (immobilier,
 * seul type avec un formulaire vraiment dédié — voir cahier des charges).
 * Tous optionnels sauf `title` : un champ non rempli est un champ dont le
 * générateur ne parle jamais, jamais une valeur devinée.
 */
export interface StudioInput {
  title: string;
  description: string;
  /** Points forts en texte libre, un par ligne — jamais déduits automatiquement. */
  highlights: string[];
  price: string | null;
  callToAction: string | null;

  // Spécifique offer_type = "bien" (immobilier).
  propertyType: string | null; // maison, appartement, terrain...
  surfaceM2: number | null;
  rooms: number | null;
  bedrooms: number | null;
  city: string | null;
  neighborhood: string | null;
  dpe: string | null; // lettre A-G, laissé vide si non fourni

  // Spécifique offer_type = "evenement".
  eventDate: string | null;
  eventLocation: string | null;

  // Spécifique offer_type = "promotion".
  validUntil: string | null;
}

export const EMPTY_STUDIO_INPUT: StudioInput = {
  title: "",
  description: "",
  highlights: [],
  price: null,
  callToAction: null,
  propertyType: null,
  surfaceM2: null,
  rooms: null,
  bedrooms: null,
  city: null,
  neighborhood: null,
  dpe: null,
  eventDate: null,
  eventLocation: null,
  validUntil: null,
};

export interface GeneratedContent {
  instagram: string;
  facebook: string;
  sms: string;
  email: { subject: string; body: string };
  site: { headline: string; body: string; cta: string };
}

export type StudioStatus = "draft" | "ready" | "published" | "archived";

/** Reconstruit un StudioInput sûr depuis du jsonb potentiellement incomplet (voir business_profiles.search_filters pour le même principe). */
export function parseStudioInput(raw: unknown): StudioInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...EMPTY_STUDIO_INPUT,
    ...r,
    highlights: Array.isArray(r.highlights) ? r.highlights.filter((h): h is string => typeof h === "string") : [],
  } as StudioInput;
}

const EMPTY_GENERATED_CONTENT: GeneratedContent = {
  instagram: "",
  facebook: "",
  sms: "",
  email: { subject: "", body: "" },
  site: { headline: "", body: "", cta: "" },
};

export function parseGeneratedContent(raw: unknown): GeneratedContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<GeneratedContent>;
  return {
    instagram: r.instagram ?? "",
    facebook: r.facebook ?? "",
    sms: r.sms ?? "",
    email: r.email ?? EMPTY_GENERATED_CONTENT.email,
    site: r.site ?? EMPTY_GENERATED_CONTENT.site,
  };
}

export interface StudioCreation {
  id: string;
  workspaceId: string;
  vertical: StudioVertical;
  offerType: OfferType;
  title: string;
  input: StudioInput;
  content: GeneratedContent;
  status: StudioStatus;
  sourceMissionId: string | null;
  createdAt: string;
  updatedAt: string;
}
