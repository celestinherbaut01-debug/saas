// Normalisation et comparaison stricte des codes NAF — fonctions PURES,
// testables sans dépendance Deno (voir webapp/tests/v4.test.ts).
//
// AUDIT CONFIRMÉ (client réel : 87 "Boulangeries" trouvées à 10 km autour de
// Béthune, chiffre jugé suspect) : la documentation officielle de
// recherche-entreprises.api.gouv.fr précise que le paramètre
// `activite_principale` s'applique au niveau de l'UNITÉ LÉGALE (l'entreprise/
// SIREN), PAS à chaque établissement. `matching_etablissements` peut donc
// contenir des établissements dont le NAF propre diffère du filtre demandé
// (établissements secondaires d'une même entreprise, repli sur le `siège`
// quand `matching_etablissements` est vide — bug documenté de l'API). D'où
// la double sécurité : le filtre API reste envoyé (réduit le volume côté
// serveur), ET ce post-filtrage strict garantit que CHAQUE établissement
// affiché a réellement le NAF demandé.
const NON_ALNUM = /[^0-9A-Za-z]/g;

/** "10.71C" et "1071C" doivent être comparables : on retire tout caractère non alphanumérique et on met en majuscule. */
export function normalizeNaf(code: string | null | undefined): string {
  if (!code) return "";
  return code.replace(NON_ALNUM, "").toUpperCase();
}

/** true si aucun NAF n'est demandé (pas de filtre métier) ou si le NAF du candidat correspond réellement à l'un des NAF sélectionnés. */
export function matchesRequestedNaf(candidateNaf: string | null | undefined, selectedNafCodes: string[]): boolean {
  if (selectedNafCodes.length === 0) return true;
  const normalizedCandidate = normalizeNaf(candidateNaf);
  if (!normalizedCandidate) return false;
  return selectedNafCodes.some((code) => normalizeNaf(code) === normalizedCandidate);
}
