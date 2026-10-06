// Un établissement physique (un SIRET) ne doit jamais apparaître deux fois,
// qu'il soit revenu sur plusieurs pages de l'API registre, dans plusieurs
// résultats "entreprise", ou plusieurs fois dans `matching_etablissements` —
// fonction PURE, testable (voir webapp/tests/v4.test.ts). Garde la PREMIÈRE
// occurrence rencontrée (déjà la plus proche après le tri par distance,
// quand appelée après celui-ci — appelée avant ici, l'ordre entre doublons
// est alors celui de l'API, sans conséquence car leurs champs sont identiques).
export function dedupeBySiret<T extends { siret: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.siret)) continue;
    seen.add(item.siret);
    result.push(item);
  }
  return result;
}
