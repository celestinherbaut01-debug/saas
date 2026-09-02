import type { SireneEtablissement } from "./types.ts";

const BASE_URL = "https://recherche-entreprises.api.gouv.fr/search";
const PER_PAGE = 25; // maximum accepté par l'API
const MAX_PAGES = 8; // garde-fou : 200 établissements bruts max par recherche
/** L'API ne cherche pas au-delà de 50 km autour d'un point GPS. */
const API_MAX_RADIUS_KM = 50;

export interface SireneQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  nafCodes: string[];
  operationalOnly: boolean;
}

interface RawEtablissement {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  activite_principale?: string;
  etat_administratif?: string;
  est_siege?: boolean;
}

interface RawResult {
  siren: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  tranche_effectif_salarie?: string;
  siege?: RawEtablissement;
  matching_etablissements?: RawEtablissement[];
}

interface RawResponse {
  results?: RawResult[];
  total_results?: number;
  total_pages?: number;
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function buildEstablishment(
  parent: RawResult,
  etab: RawEtablissement,
): SireneEtablissement | null {
  if (!etab.siret) return null;
  return {
    siren: parent.siren,
    siret: etab.siret,
    companyName: parent.nom_complet || parent.nom_raison_sociale || "Entreprise",
    nafCode: etab.activite_principale ?? null,
    street: etab.adresse ?? null,
    postalCode: etab.code_postal ?? null,
    city: etab.libelle_commune ?? null,
    lat: toNumber(etab.latitude),
    lng: toNumber(etab.longitude),
    etatAdministratif: etab.etat_administratif ?? null,
    natureJuridique: parent.nature_juridique ?? null,
    effectifTranche: parent.tranche_effectif_salarie ?? null,
  };
}

/**
 * Interroge le registre officiel des entreprises françaises (SIRENE/RNE via
 * recherche-entreprises.api.gouv.fr — API publique, gratuite, sans clé).
 *
 * Limite connue de l'API : le filtre géographique `lat`/`long`/`radius` ne
 * cherche pas au-delà de 50 km. Pour un rayon demandé plus large, on plafonne
 * la requête à 50 km : le filtrage exact par distance se fait ensuite côté
 * appelant avec `haversineKm` sur les coordonnées réelles de chaque
 * établissement, donc aucun résultat hors-rayon ne peut fuiter — mais un rayon
 * de 200 km ne ramènera que ce qu'il y a dans le disque de 50 km.
 */
export async function searchSirene(
  query: SireneQuery,
): Promise<SireneEtablissement[]> {
  const results: SireneEtablissement[] = [];
  const effectiveRadius = Math.min(query.radiusKm, API_MAX_RADIUS_KM);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      lat: String(query.lat),
      long: String(query.lng),
      radius: String(effectiveRadius),
      page: String(page),
      per_page: String(PER_PAGE),
      minimal: "false",
    });
    if (query.nafCodes.length > 0) {
      params.set("activite_principale", query.nafCodes.join(","));
    }
    if (query.operationalOnly) {
      params.set("etat_administratif", "A");
    }

    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `Registre entreprises indisponible (${res.status}) : ${await res
          .text()
          .catch(() => "")}`,
      );
    }
    const data = (await res.json()) as RawResponse;
    const pageResults = data.results ?? [];

    for (const company of pageResults) {
      const etabs =
        company.matching_etablissements && company.matching_etablissements.length > 0
          ? company.matching_etablissements
          : company.siege
          ? [company.siege]
          : [];
      for (const etab of etabs) {
        const built = buildEstablishment(company, etab);
        if (built) results.push(built);
      }
    }

    const totalPages = data.total_pages ?? 1;
    if (page >= totalPages || pageResults.length === 0) break;
  }

  return results;
}
