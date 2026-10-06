// Filtre "besoin digital" (statut du site) — fonction PURE, isolée pour
// pouvoir être testée sans dépendance Deno (voir
// supabase/functions/_shared/__tests__/webFilter.test.ts, exécutable avec
// `node --experimental-strip-types`).
//
// BUG CORRIGÉ (rapporté par un client réel : "162 trouvé(s) dans le
// registre, 0 affiché(s)") : l'ancienne version comparait directement
// `websiteQuality` ("none"/"weak"/"ok"/"unknown") à des listes qui
// n'incluaient jamais "unknown". Or SANS clé Google Places configurée (ou
// dès que le plafond de vérifications payantes est atteint), websiteQuality
// vaut TOUJOURS "unknown" pour tout le monde — jamais "none" (qui exige que
// Google ait confirmé l'absence de site). Résultat : les filtres "Aucun
// site détecté" / "Site à analyser" / "Site absent ou faible" excluaient
// MÉCANIQUEMENT 100% des candidats dès que Google Places n'était pas
// disponible, même avec 162 boulangeries actives dans le registre.
//
// Règle produit (jamais Google obligatoire à l'existence d'un prospect) :
// un candidat jamais vérifié par Google (verificationStatus REGISTRY_ONLY)
// doit rester visible sous "Aucun site détecté", "Site absent ou faible" et
// "Tous les statuts" — ces filtres décrivent une OPPORTUNITÉ ("pas de site
// confirmé de qualité"), jamais une certitude. Seuls "Site à analyser" et
// "Fiche Google active" décrivent une donnée qui EXIGE une vérification
// Google réelle (on ne peut pas dire "ce site est faible" ou "cette fiche
// Google existe" sans l'avoir vérifié) : ceux-ci restent strictement
// dépendants de Google, mais le serveur renvoie alors un avertissement
// explicite plutôt qu'un silence (voir index.ts, warnings).
// Reprend le type VerificationStatus de _shared/types.ts plutôt que d'en
// redéfinir un second — "UNKNOWN" n'est aujourd'hui jamais produit par
// computeVerificationStatus (index.ts), mais est traité ci-dessous comme
// REGISTRY_ONLY (prudence : jamais exclu d'un filtre permissif sur la seule
// base d'une valeur qu'on ne devrait jamais voir).
export type VerificationStatus =
  | "REGISTRY_ONLY"
  | "GOOGLE_VERIFIED"
  | "NO_WEBSITE_CONFIRMED"
  | "WEBSITE_FOUND"
  | "WEBSITE_WEAK"
  | "WEBSITE_GOOD"
  | "UNKNOWN";

export type WebFilter = "all" | "no_or_weak" | "none" | "weak" | "unknown";

/** webFilter dont le résultat dépend intégralement d'une vérification Google réelle. */
export const GOOGLE_DEPENDENT_WEB_FILTERS: WebFilter[] = ["weak", "unknown"];

const ALLOWED: Record<Exclude<WebFilter, "all">, VerificationStatus[]> = {
  // "Aucun site détecté" : confirmé par Google (NO_WEBSITE_CONFIRMED) OU
  // jamais vérifié (REGISTRY_ONLY/UNKNOWN — on n'a identifié aucun site, ce
  // qui est littéralement vrai dans les deux cas).
  none: ["REGISTRY_ONLY", "UNKNOWN", "NO_WEBSITE_CONFIRMED"],
  // "Site à analyser" : nécessite qu'un site ait été confirmé par Google
  // (faible, ou trouvé sans analyse concluante) — ne peut pas inclure
  // REGISTRY_ONLY sans inventer une donnée.
  weak: ["WEBSITE_WEAK", "WEBSITE_FOUND"],
  // "Site absent ou faible" : union des deux groupes ci-dessus.
  no_or_weak: ["REGISTRY_ONLY", "UNKNOWN", "NO_WEBSITE_CONFIRMED", "WEBSITE_WEAK", "WEBSITE_FOUND"],
  // "Fiche Google active" : exige une fiche Google confirmée (donc jamais
  // REGISTRY_ONLY), mais exclut un site déjà confirmé bon (rien à compléter).
  unknown: ["GOOGLE_VERIFIED", "NO_WEBSITE_CONFIRMED", "WEBSITE_WEAK", "WEBSITE_FOUND"],
};

export function matchesWebFilter(status: VerificationStatus, filter: WebFilter): boolean {
  if (filter === "all") return true;
  return ALLOWED[filter].includes(status);
}
