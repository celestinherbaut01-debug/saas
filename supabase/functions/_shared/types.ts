// Types partagés par les Edge Functions du moteur de prospection.

export interface SearchFilters {
  operationalOnly: boolean;
  excludeTempClosed: boolean;
  excludeChains: boolean;
  excludeAssociations: boolean;
  excludeLargeGroups: boolean;
  needContact: boolean;
  maxEstablishmentsPerSiren: number;
  webFilter: "all" | "no_or_weak" | "none" | "weak" | "unknown";
}

export interface SearchRequest {
  lat: number;
  lng: number;
  radiusKm: number;
  nafCodes: string[];
  categoryId?: string;
  filters: SearchFilters;
  /** Plafond de candidats vérifiés via Google Places (contrôle du coût). */
  maxPlacesLookups?: number;
}

/** Établissement brut renvoyé par l'API SIRENE / RNE (recherche-entreprises.api.gouv.fr). */
export interface SireneEtablissement {
  siren: string;
  siret: string;
  companyName: string;
  nafCode: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  etatAdministratif: "A" | "F" | string | null; // A = actif, F = fermé
  natureJuridique: string | null;
  effectifTranche: string | null;
}

export interface EnrichedProspect extends SireneEtablissement {
  distanceKm: number;
  isAssociation: boolean;
  isLargeGroup: boolean;
  isChain: boolean;

  placeId: string | null;
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "unverified";
  websiteUri: string | null;
  websiteQuality: "none" | "weak" | "ok" | "unknown";
  phone: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  placesCheckedAt: string | null;

  qualityScore: number;
  verificationSources: Record<string, boolean>;
}
