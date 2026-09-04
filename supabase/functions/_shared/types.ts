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
  /** Slug (feuille) du métier PROPRE à l'utilisateur — détermine le profil de scoring, jamais le prospect. */
  ownCategorySlug?: string | null;
  /** Clientèle déclarée par l'utilisateur — affine le profil de scoring quand le métier seul ne suffit pas. */
  audience?: "b2b" | "b2c" | "both" | null;
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

/**
 * Statut de vérification unique affiché à l'utilisateur — dérivé de
 * placeId/websiteUri/websiteQuality, jamais un champ saisi séparément (une
 * seule source de vérité, calculée côté serveur, voir computeVerificationStatus
 * dans index.ts). Le registre (SIRENE) suffit à afficher un prospect ;
 * Google Places ne fait qu'enrichir ce statut quand disponible.
 */
export type VerificationStatus =
  | "REGISTRY_ONLY" // Google non consulté (pas de clé, ou plafond de vérifications atteint pour cette recherche)
  | "GOOGLE_VERIFIED" // Google confirme l'établissement, statut du site indéterminé
  | "NO_WEBSITE_CONFIRMED" // Google confirme l'absence de site
  | "WEBSITE_FOUND" // un site existe (Google le confirme) mais sa qualité n'a pas pu être analysée
  | "WEBSITE_WEAK"
  | "WEBSITE_GOOD"
  | "UNKNOWN";

export interface EnrichedProspect extends SireneEtablissement {
  distanceKm: number;
  isAssociation: boolean;
  isLargeGroup: boolean;
  isChain: boolean;

  placeId: string | null;
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "unverified";
  websiteUri: string | null;
  websiteQuality: "none" | "weak" | "ok" | "unknown";
  verificationStatus: VerificationStatus;
  phone: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  placesCheckedAt: string | null;
  /** Confirmation manuelle par l'utilisateur (jamais déduite automatiquement). */
  manuallyVerified?: boolean;

  qualityScore: number;
  verificationSources: Record<string, boolean>;
}
