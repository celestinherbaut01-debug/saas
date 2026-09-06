import type { ProspectionResult } from "@/components/prospection/result-card";

/**
 * Structure STABLE renvoyée au client — jamais le JSON brut de l'Edge
 * Function. Chaque champ est explicitement défauté ici, une seule fois,
 * pour que l'UI n'affiche jamais "undefined" et ne perde jamais de
 * résultats silencieusement (voir normalizeSearchResponse ci-dessous pour
 * le pourquoi de chaque défaut).
 */
export interface ProspectionSearchResponse {
  registryFound: number;
  displayed: number;
  googleVerified: number;
  googlePlacesConfigured: boolean;
  scoringProfileLabel: string;
  results: ProspectionResult[];
  warnings: string[];
}

/**
 * Frontière de confiance entre l'Edge Function (un service déployé
 * SÉPARÉMENT du webapp — rien ne garantit qu'elle tourne la même version
 * que le code de ce dépôt) et le client React. Un déploiement de l'Edge
 * Function en retard sur ce repo (ex. avant l'introduction du moteur de
 * pertinence) renverrait un JSON sans `relevanceTier`/`totalReturned`/etc.
 * — sans cette normalisation, le typage TypeScript (une simple PROMESSE,
 * jamais vérifiée à l'exécution) laisserait ces `undefined` se propager
 * jusqu'à l'affichage ("undefined affiché(s)") ou pire, jusqu'à faire
 * disparaître silencieusement TOUS les résultats : `r.relevanceTier ===
 * "primary"` ET `r.relevanceTier === "secondary"` valent tous les deux
 * `false` quand `relevanceTier` est absent, donc aucun résultat n'atterrit
 * dans ni l'un ni l'autre groupe alors que `results` en contient bien —
 * exactement le bug rapporté ("Résultats (25)" sans aucune carte).
 *
 * Règle de repli : un résultat sans `relevanceTier` (ancienne version de
 * la fonction, avant le moteur de pertinence) est traité comme "primary"
 * — comportement d'avant ce moteur, jamais un résultat masqué pour la
 * seule raison qu'un champ récent manque.
 */
export function normalizeSearchResponse(raw: unknown): ProspectionSearchResponse {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const warnings: string[] = [];

  const rawResults = Array.isArray(r.results) ? (r.results as Record<string, unknown>[]) : [];
  if (!Array.isArray(r.results)) {
    warnings.push("La réponse du serveur ne contenait pas de liste de résultats exploitable.");
  }

  let missingRelevanceTier = 0;
  const results: ProspectionResult[] = rawResults.map((item) => {
    const tier = item.relevanceTier === "primary" || item.relevanceTier === "secondary" ? item.relevanceTier : "primary";
    if (tier === "primary" && item.relevanceTier !== "primary") missingRelevanceTier++;
    return {
      ...item,
      relevanceScore: typeof item.relevanceScore === "number" ? item.relevanceScore : 70,
      relevanceTier: tier,
      relevanceReasons: Array.isArray(item.relevanceReasons) ? (item.relevanceReasons as string[]) : [],
    } as ProspectionResult;
  });
  if (missingRelevanceTier > 0) {
    warnings.push(
      `${missingRelevanceTier} résultat(s) sans information de pertinence — traités comme pertinents par défaut ` +
        `(la fonction de recherche déployée est peut-être en retard sur une mise à jour récente).`,
    );
  }

  const registryFound = typeof r.totalMatchedInRegistry === "number" ? r.totalMatchedInRegistry : results.length;
  const displayed = typeof r.totalReturned === "number" ? r.totalReturned : results.length;
  const googleVerified =
    typeof r.googleVerifiedCount === "number" ? r.googleVerifiedCount : results.filter((res) => res.placeId !== null).length;

  if (typeof r.totalReturned !== "number" || typeof r.googleVerifiedCount !== "number") {
    warnings.push("Certains compteurs n'étaient pas fournis par le serveur — recalculés côté client à partir des résultats reçus.");
  }

  return {
    registryFound,
    displayed,
    googleVerified,
    googlePlacesConfigured: r.googlePlacesConfigured === true,
    scoringProfileLabel: typeof r.scoringProfileLabel === "string" ? r.scoringProfileLabel : "Score d'opportunité",
    results,
    warnings,
  };
}
