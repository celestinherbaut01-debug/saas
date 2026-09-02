/**
 * Filtres "indépendance" : associations/organismes publics, gros groupes,
 * chaînes et franchises connues. Heuristiques volontairement prudentes —
 * mieux vaut laisser passer un cas limite que d'exclure un vrai indépendant.
 */

/** Préfixes de code "nature juridique" INSEE couvrant associations et secteur public. */
const NON_COMMERCIAL_PREFIXES = [
  "92", // associations (déclarées, insertion, fondations d'entreprise...)
  "93", // fondations
  "71", // administrations de l'État
  "72", // collectivités territoriales
  "73", // établissements publics administratifs
  "74", // établissements publics à caractère industriel/commercial (souvent hors cible TPE)
];

export function isAssociationOrPublic(natureJuridique: string | null): boolean {
  if (!natureJuridique) return false;
  return NON_COMMERCIAL_PREFIXES.some((p) => natureJuridique.startsWith(p));
}

/** Tranches d'effectif INSEE à partir de 250 salariés (seuil ETI/grand groupe). */
const LARGE_GROUP_TRANCHES = new Set([
  "32", // 250-499
  "41", // 500-999
  "42", // 1000-1999
  "51", // 2000-4999
  "52", // 5000-9999
  "53", // 10000+
]);

export function isLargeGroup(effectifTranche: string | null): boolean {
  if (!effectifTranche) return false;
  return LARGE_GROUP_TRANCHES.has(effectifTranche);
}

/**
 * Liste de raisons sociales de chaînes/franchises nationales connues.
 * Comparaison sur le nom normalisé (minuscule, sans accents) en "contient".
 * À enrichir au fil de l'eau — c'est un denylist, pas une science exacte.
 */
const KNOWN_CHAINS = [
  "mcdonald", "burger king", "kfc", "quick", "subway", "domino's", "dominos pizza",
  "pizza hut", "o'tacos", "five guys", "starbucks", "brioche doree", "paul",
  "carrefour", "leclerc", "e.leclerc", "intermarche", "super u", "hyper u",
  "auchan", "casino", "monoprix", "franprix", "lidl", "aldi", "netto", "cora",
  "decathlon", "boulanger", "darty", "fnac", "leroy merlin", "castorama",
  "brico depot", "gamm vert", "jardiland", "botanic", "truffaut",
  "basic fit", "keep cool", "fitness park", "vitagym", "orange bank",
  "franchise", "reseau national",
  "yves rocher", "sephora", "marionnaud", "nocibe", "kiko",
  "speedy", "norauto", "feu vert", "midas", "point s", "euromaster",
  "century 21", "orpi", "laforet", "guy hoquet", "stephane plaza",
  "generale de coiffure", "camille albane", "franck provost", "saint algue",
  "pizza sprint", "class'croute", "sushi shop", "cojean", "exki",
  "ibis", "novotel", "mercure", "campanile", "b&b hotels", "premiere classe",
];

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

export function isKnownChain(companyName: string): boolean {
  const n = normalize(companyName);
  return KNOWN_CHAINS.some((chain) => n.includes(chain));
}
