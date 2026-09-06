// Forme normalisée des filtres de recherche Prospection — stockés en jsonb
// (business_profiles.search_filters, volontairement permissif en base) donc
// jamais fait confiance sans passer par normalizeProspectionFilters() : un
// ancien enregistrement, une valeur corrompue ou une évolution future du
// schéma ne doivent jamais faire planter la page ni fabriquer une valeur
// absurde (voir le même principe pour les plans dans lib/entitlements.ts).
export interface ProspectionFilters {
  operationalOnly: boolean;
  excludeTempClosed: boolean;
  excludeChains: boolean;
  excludeAssociations: boolean;
  excludeLargeGroups: boolean;
  needContact: boolean;
  maxEstablishmentsPerSiren: number;
  webFilter: "all" | "no_or_weak" | "none" | "weak" | "unknown";
  phoneOnly: boolean;
  googleFicheOnly: boolean;
}

export const DEFAULT_PROSPECTION_FILTERS: ProspectionFilters = {
  operationalOnly: true,
  excludeTempClosed: true,
  excludeChains: true,
  excludeAssociations: true,
  excludeLargeGroups: true,
  needContact: false,
  maxEstablishmentsPerSiren: 8,
  // "all" par défaut : le registre suffit à afficher un prospect, Google
  // Places ne fait qu'enrichir — un filtre par défaut plus restrictif
  // masquerait tout tant que Google Places n'est pas configuré.
  webFilter: "all",
  phoneOnly: false,
  googleFicheOnly: false,
};

const WEB_FILTER_VALUES: ProspectionFilters["webFilter"][] = ["all", "no_or_weak", "none", "weak", "unknown"];

export function normalizeProspectionFilters(raw: unknown): ProspectionFilters {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (key: keyof ProspectionFilters) => (typeof r[key] === "boolean" ? (r[key] as boolean) : DEFAULT_PROSPECTION_FILTERS[key] as boolean);
  return {
    operationalOnly: bool("operationalOnly"),
    excludeTempClosed: bool("excludeTempClosed"),
    excludeChains: bool("excludeChains"),
    excludeAssociations: bool("excludeAssociations"),
    excludeLargeGroups: bool("excludeLargeGroups"),
    needContact: bool("needContact"),
    maxEstablishmentsPerSiren:
      typeof r.maxEstablishmentsPerSiren === "number" && r.maxEstablishmentsPerSiren > 0
        ? r.maxEstablishmentsPerSiren
        : DEFAULT_PROSPECTION_FILTERS.maxEstablishmentsPerSiren,
    webFilter: WEB_FILTER_VALUES.includes(r.webFilter as ProspectionFilters["webFilter"])
      ? (r.webFilter as ProspectionFilters["webFilter"])
      : DEFAULT_PROSPECTION_FILTERS.webFilter,
    phoneOnly: bool("phoneOnly"),
    googleFicheOnly: bool("googleFicheOnly"),
  };
}
