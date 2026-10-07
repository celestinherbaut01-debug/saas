import type { ProspectionFilters } from "@/lib/prospecting-config";

/** Sous-ensemble des paramètres qui affecte réellement le résultat d'une recherche (envoyé à runProspectSearch). */
export interface SearchParamsSnapshot {
  targetIds: string[];
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  filters: ProspectionFilters;
}

/**
 * true si les paramètres de recherche actuels diffèrent de ceux de la
 * dernière recherche réellement lancée — sert à afficher "Paramètres
 * modifiés, relancez la recherche" plutôt que de laisser croire que les
 * résultats affichés correspondent encore à la sélection courante.
 * `targetIds` comparé en ensemble (l'ordre de sélection n'a pas de sens).
 */
export function haveSearchParamsChanged(current: SearchParamsSnapshot, last: SearchParamsSnapshot | null): boolean {
  if (!last) return false;
  if (current.lat !== last.lat || current.lng !== last.lng) return true;
  if (current.radiusKm !== last.radiusKm) return true;
  const a = [...current.targetIds].sort();
  const b = [...last.targetIds].sort();
  if (a.length !== b.length || a.some((id, i) => id !== b[i])) return true;
  if (JSON.stringify(current.filters) !== JSON.stringify(last.filters)) return true;
  return false;
}
