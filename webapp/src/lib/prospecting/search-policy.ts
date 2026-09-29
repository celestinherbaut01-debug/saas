import type { ProspectionFilters } from "../prospecting-config";
import type { ProspectingObjective } from "./offer-catalog";
import type { ProspectionResult } from "../../components/prospection/result-card";

/** One policy for the form and the server. Changing an offer resets its web criteria. */
export function defaultWebFilter(
  objective: ProspectingObjective,
): ProspectionFilters["webFilter"] {
  if (objective.id === "web_creation") return "none";
  if (objective.id === "web_refonte") return "weak";
  if (
    ["web_maintenance", "web_seo", "web_digital_acquisition"].includes(
      objective.id,
    )
  )
    return "existing";
  return "all";
}

export function filtersForObjective(
  objective: ProspectingObjective,
  filters: ProspectionFilters,
): ProspectionFilters {
  return {
    ...filters,
    webFilter: objective.showWebSignal ? filters.webFilter : "all",
  };
}

type WebsiteEvidence = Pick<
  ProspectionResult,
  "placeId" | "websiteUri" | "websiteQuality"
>;

/** Missing data never proves that a business has no website. Even Google can only say no site is listed. */
export function matchesWebsiteFilter(
  result: WebsiteEvidence,
  filter: ProspectionFilters["webFilter"],
): boolean {
  const hasSite = Boolean(result.websiteUri?.trim());
  const noListedSite =
    Boolean(result.placeId) && !hasSite && result.websiteQuality === "none";
  switch (filter) {
    case "none":
      return noListedSite;
    case "weak":
      return hasSite && result.websiteQuality === "weak";
    case "existing":
      return hasSite;
    case "no_or_weak":
      return noListedSite || (hasSite && result.websiteQuality === "weak");
    case "unknown":
      return !hasSite && !noListedSite;
    default:
      return true;
  }
}

export function offerReason(objective: ProspectingObjective): string {
  if (objective.id === "web_creation")
    return "Secteur sélectionné pour votre offre de création de site ; besoin à confirmer au contact.";
  if (objective.id === "web_refonte")
    return "Site existant avec des signaux techniques à examiner avant de proposer une refonte.";
  if (objective.id.startsWith("cleaning_"))
    return "Activité compatible avec votre prestation de nettoyage ; locaux, contrat actuel et besoin à qualifier.";
  if (objective.id.startsWith("security_"))
    return "Activité compatible avec une prestation de sécurité ; site et besoin à qualifier.";
  if (objective.id.startsWith("garage_"))
    return "Activité pouvant impliquer des véhicules professionnels ; flotte et entretien à confirmer.";
  return "Activité dans les secteurs que vous avez sélectionnés ; intérêt pour votre offre à confirmer.";
}

/** Hard constraints are rechecked after the independently deployed search service responds. */
export function matchesSearchCriteria(
  result: ProspectionResult,
  nafCodes: string[],
  radiusKm: number,
  filters: ProspectionFilters,
): boolean {
  return Boolean(
    result.nafCode &&
    nafCodes.includes(result.nafCode) &&
    Number.isFinite(result.distanceKm) &&
    result.distanceKm >= 0 &&
    result.distanceKm <= radiusKm &&
    (!filters.operationalOnly ||
      (result.etatAdministratif === "A" &&
        result.businessStatus !== "CLOSED_PERMANENTLY")) &&
    (!filters.excludeTempClosed ||
      result.businessStatus !== "CLOSED_TEMPORARILY") &&
    (!filters.excludeChains || !result.isChain) &&
    (!filters.excludeAssociations || !result.isAssociation) &&
    (!filters.excludeLargeGroups || !result.isLargeGroup) &&
    (!filters.phoneOnly || Boolean(result.phone)) &&
    (!filters.googleFicheOnly || Boolean(result.placeId)) &&
    matchesWebsiteFilter(result, filters.webFilter),
  );
}
