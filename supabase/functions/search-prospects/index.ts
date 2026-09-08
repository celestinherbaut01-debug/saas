// Edge Function : moteur de qualité des prospects (plan Starter).
//
// Pipeline : Registre (SIRENE/RNE) → distance GPS exacte (Haversine) →
// filtres indépendance (chaînes / associations / gros groupes) →
// Google Places (statut, site, téléphone, avis) → analyse du site →
// score d'opportunité. Ne persiste rien dans le CRM : le client ajoute
// lui-même les résultats retenus via un insert `prospects` classique
// (protégé par RLS avec le JWT de l'utilisateur).
//
// Règle agent : un prospect dont le statut Google n'a pas pu être vérifié
// reste marqué "unverified" / "unknown" — jamais reclassé "opérationnel"
// ou "site correct" par supposition.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { haversineKm } from "../_shared/haversine.ts";
import { searchSirene } from "../_shared/sirene.ts";
import { isAssociationOrPublic, isKnownChain, isLargeGroup } from "../_shared/chains.ts";
import { verifyWithGooglePlaces } from "../_shared/placesApi.ts";
import { analyseWebsiteQuality } from "../_shared/websiteQuality.ts";
import { computeQualityScore, resolveScoringProfile, SCORING_PROFILE_LABEL } from "../_shared/scoring.ts";
import { computeRelevance } from "../_shared/relevance.ts";
import type { EnrichedProspect, SearchRequest, VerificationStatus } from "../_shared/types.ts";

const DEFAULT_MAX_PLACES_LOOKUPS = 25;
const HARD_MAX_PLACES_LOOKUPS = 60;
const CACHE_TTL_DAYS = 30;
/** Vérifications Google Places en direct traitées en parallèle par lot. */
const GOOGLE_LOOKUP_CONCURRENCY = 6;

function badRequest(message: string) {
  return jsonResponse({ error: message }, 400);
}

/**
 * Exécute `fn` sur chaque item de `items`, avec au plus `limit` exécutions en
 * parallèle. Remplace une boucle séquentielle : jusqu'à 25 candidats × 2
 * appels externes (Google Places + analyse du site, 8s/6s de timeout chacun)
 * traités un par un pouvaient prendre 30s+ de temps d'exécution total et
 * risquer le timeout de la fonction — cause la plus probable des recherches
 * qui échouent sans erreur claire. Chaque `fn` reste responsable d'isoler ses
 * propres erreurs : un échec sur un item ne doit jamais interrompre les
 * autres.
 */
async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Dérive le statut de vérification unique affiché à l'utilisateur — jamais
 * saisi séparément, toujours recalculé depuis les mêmes données que le
 * badge affiché (placeId/websiteUri/websiteQuality). Voir VerificationStatus
 * dans _shared/types.ts pour la signification de chaque valeur.
 */
function computeVerificationStatus(
  placeId: string | null,
  websiteUri: string | null,
  websiteQuality: EnrichedProspect["websiteQuality"],
): VerificationStatus {
  if (!placeId) return "REGISTRY_ONLY";
  if (!websiteUri) return "NO_WEBSITE_CONFIRMED";
  if (websiteQuality === "ok") return "WEBSITE_GOOD";
  if (websiteQuality === "weak") return "WEBSITE_WEAK";
  if (websiteQuality === "unknown") return "WEBSITE_FOUND";
  return "GOOGLE_VERIFIED";
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non supportée" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

  // 1. Authentifier l'appelant avec son propre JWT (pas de recherche anonyme).
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) {
    return jsonResponse({ error: "Authentification requise" }, 401);
  }

  // 2. Valider la requête.
  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return badRequest("Corps de requête JSON invalide");
  }

  const { lat, lng, radiusKm, filters } = body;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return badRequest("Coordonnées GPS manquantes ou invalides — validez l'adresse avant de lancer la recherche");
  }
  if (!Number.isFinite(radiusKm) || radiusKm < 0.5 || radiusKm > 250) {
    return badRequest("Rayon invalide (0.5 à 250 km)");
  }
  if (!filters) return badRequest("Filtres manquants");

  const nafCodes = Array.isArray(body.nafCodes) ? body.nafCodes.filter(Boolean) : [];
  const maxPlacesLookups = Math.min(
    body.maxPlacesLookups ?? DEFAULT_MAX_PLACES_LOOKUPS,
    HARD_MAX_PLACES_LOOKUPS,
  );
  const scoringProfile = resolveScoringProfile(body.ownCategorySlug ?? null, body.audience ?? null);

  // Log temporaire de diagnostic (stage 1/8 : requête reçue) — visible
  // uniquement dans les logs Supabase Edge Functions, jamais renvoyé au
  // client. À retirer une fois le pipeline confirmé stable en réel.
  console.log(
    `[search-prospects] requête : lat=${lat} lng=${lng} radius=${radiusKm}km ` +
      `nafCodes=[${nafCodes.join(",")}] audience=${body.audience ?? "?"} ownCategorySlug=${
        body.ownCategorySlug ?? "?"
      } maxPlacesLookups=${maxPlacesLookups} scoringProfile=${scoringProfile}`,
  );

  // Service role : nécessaire pour lire/écrire le cache de vérification
  // mutualisé (verification_cache n'autorise pas l'écriture depuis le client).
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 3. Registre officiel des entreprises + catalogue (pour la pertinence :
    // le business_type de la catégorie du NAF de CHAQUE candidat, comparé à
    // l'audience déclarée — voir _shared/relevance.ts).
    const [raw, { data: categoryRows }] = await Promise.all([
      searchSirene({
        lat,
        lng,
        radiusKm,
        nafCodes,
        operationalOnly: filters.operationalOnly,
        maxEstablishmentsPerSiren: filters.maxEstablishmentsPerSiren,
      }),
      admin.from("business_categories").select("naf_codes, business_type, exclusion_keywords").order("sort_order"),
    ]);

    const nafToBusinessType = new Map<string, "b2b" | "b2c" | "both">();
    const nafToExclusionKeywords = new Map<string, string[]>();
    for (const cat of categoryRows ?? []) {
      for (const code of cat.naf_codes as string[]) {
        if (!nafToBusinessType.has(code)) nafToBusinessType.set(code, cat.business_type as "b2b" | "b2c" | "both");
        const exclusions = (cat.exclusion_keywords as string[] | null) ?? [];
        if (exclusions.length > 0) {
          const existing = nafToExclusionKeywords.get(code) ?? [];
          nafToExclusionKeywords.set(code, [...existing, ...exclusions]);
        }
      }
    }

    // 4. Distance exacte + filtres registre (indépendance, statut).
    const perSirenCount = new Map<string, number>();
    let candidates = raw
      .map((e) => {
        if (e.lat === null || e.lng === null) return null;
        const distanceKm = haversineKm(lat, lng, e.lat, e.lng);
        return { ...e, distanceKm };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null && e.distanceKm <= radiusKm);

    if (filters.operationalOnly) {
      candidates = candidates.filter((e) => e.etatAdministratif === "A");
    }

    candidates = candidates.filter((e) => {
      const assoc = isAssociationOrPublic(e.natureJuridique);
      const large = isLargeGroup(e.effectifTranche);
      const chain = isKnownChain(e.companyName);
      if (filters.excludeAssociations && assoc) return false;
      if (filters.excludeLargeGroups && large) return false;
      if (filters.excludeChains && chain) return false;
      return true;
    });

    if (filters.maxEstablishmentsPerSiren > 0) {
      candidates = candidates.filter((e) => {
        const n = (perSirenCount.get(e.siren) ?? 0) + 1;
        perSirenCount.set(e.siren, n);
        return n <= filters.maxEstablishmentsPerSiren;
      });
    }

    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    const totalMatched = candidates.length;

    // Stage 2/8 + 3/8 : résultats registre bruts puis après normalisation
    // (distance exacte + filtres indépendance).
    console.log(
      `[search-prospects] registre : ${raw.length} établissements bruts reçus → ${totalMatched} après ` +
        `filtre distance/indépendance`,
    );

    // 5. Vérification Google Places (avec cache par SIRET) + qualité du site.
    //
    // RÈGLE PRODUIT : le registre suffit à afficher un prospect. Google
    // Places ENRICHIT, il ne conditionne JAMAIS la présence d'un résultat.
    // Auparavant, seuls les `maxPlacesLookups` premiers candidats étaient
    // même ajoutés aux résultats — les autres (au-delà du plafond de coût
    // Google) disparaissaient silencieusement. Maintenant, TOUS les
    // candidats du registre sont retournés ; seule la vérification Google
    // (payante à l'appel) reste plafonnée par `maxPlacesLookups`, et le
    // cache (gratuit, une lecture DB) est consulté pour tout le monde en un
    // seul aller-retour groupé plutôt qu'une requête par candidat.
    const cacheTtlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const { data: cachedRows } = await admin
      .from("verification_cache")
      .select("*")
      .in("siret", candidates.map((c) => c.siret));
    const cacheBySiret = new Map((cachedRows ?? []).map((r) => [r.siret, r]));

    type VerificationOutcome = {
      placesResult: {
        placeId: string | null;
        businessStatus: EnrichedProspect["businessStatus"];
        websiteUri: string | null;
        phone: string | null;
        rating: number | null;
        ratingCount: number | null;
      };
      websiteQuality: EnrichedProspect["websiteQuality"];
      checkedAt: string | null;
      fromCache: boolean;
      googleConsulted: boolean;
    };

    // Pas de clé Google configurée, plafond de vérifications payantes
    // atteint, ou vérification live qui a échoué : on ne fabrique aucune
    // donnée, le prospect reste explicitement "à vérifier" — mais reste
    // affiché (le registre suffit, Google ne fait qu'enrichir).
    const noDataOutcome = (): VerificationOutcome => ({
      placesResult: { placeId: null, businessStatus: "unverified", websiteUri: null, phone: null, rating: null, ratingCount: null },
      websiteQuality: "unknown",
      checkedAt: null,
      fromCache: false,
      googleConsulted: false,
    });

    // Phase 1 (synchrone) : décider, dans l'ordre de distance, qui vient du
    // cache et qui a besoin d'un appel Google en direct — le budget
    // `maxPlacesLookups` est consommé exactement dans cet ordre, comme avant.
    const outcomes: VerificationOutcome[] = new Array(candidates.length);
    const liveLookupIndexes: number[] = [];
    let liveBudgetLeft = maxPlacesLookups;

    candidates.forEach((c, i) => {
      const cached = cacheBySiret.get(c.siret);
      if (cached && Date.now() - new Date(cached.checked_at).getTime() < cacheTtlMs) {
        outcomes[i] = {
          placesResult: {
            placeId: cached.place_id,
            businessStatus: cached.business_status ?? "unverified",
            websiteUri: cached.website_uri,
            phone: cached.phone,
            rating: cached.google_rating,
            ratingCount: cached.google_rating_count,
          },
          websiteQuality: cached.website_quality ?? "unknown",
          checkedAt: cached.checked_at,
          fromCache: true,
          googleConsulted: true,
        };
      } else if (googleApiKey && liveBudgetLeft > 0) {
        liveBudgetLeft--;
        liveLookupIndexes.push(i);
        outcomes[i] = noDataOutcome(); // provisoire, remplacé après la vérification live (phase 2)
      } else {
        outcomes[i] = noDataOutcome();
      }
    });

    // Phase 2 : vérifications Google en direct exécutées en parallèle par
    // lots bornés (voir runWithConcurrency) au lieu d'une par une. Chaque
    // échec reste isolé à SON candidat — verifyWithGooglePlaces et
    // analyseWebsiteQuality ne lèvent déjà jamais (voir _shared/placesApi.ts
    // et _shared/websiteQuality.ts), le try/catch ici est un filet de
    // sécurité supplémentaire — jamais une erreur globale sur la recherche.
    await runWithConcurrency(liveLookupIndexes, GOOGLE_LOOKUP_CONCURRENCY, async (i) => {
      const c = candidates[i];
      try {
        const address = [c.street, c.postalCode, c.city].filter(Boolean).join(", ");
        const placesResult = await verifyWithGooglePlaces(c.companyName, address, googleApiKey!);
        const websiteQuality = await analyseWebsiteQuality(placesResult.websiteUri);
        const checkedAt = new Date().toISOString();
        outcomes[i] = { placesResult, websiteQuality, checkedAt, fromCache: false, googleConsulted: true };

        const { error: upsertError } = await admin.from("verification_cache").upsert({
          siret: c.siret,
          place_id: placesResult.placeId,
          business_status: placesResult.businessStatus,
          website_uri: placesResult.websiteUri,
          phone: placesResult.phone,
          google_rating: placesResult.rating,
          google_rating_count: placesResult.ratingCount,
          website_quality: websiteQuality,
          checked_at: checkedAt,
        });
        if (upsertError) console.error("[search-prospects] échec écriture cache verification_cache", c.siret, upsertError);
      } catch (err) {
        console.error("[search-prospects] vérification Google en échec pour un candidat — affiché sans enrichissement", c.siret, err);
        outcomes[i] = noDataOutcome();
      }
    });

    // Stage 4/8 + 5/8 : résultats registre retenus / résultats Google reçus.
    console.log(
      `[search-prospects] vérification Google : ${liveLookupIndexes.length} appels live, ` +
        `${outcomes.filter((o) => o.fromCache).length} depuis le cache, ` +
        `${outcomes.filter((o) => !o.googleConsulted).length} non vérifiés (pas de clé ou plafond atteint)`,
    );

    const enriched: EnrichedProspect[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const { placesResult, websiteQuality, checkedAt, fromCache, googleConsulted } = outcomes[i];
      const isChain = isKnownChain(c.companyName);
      const isAssociation = isAssociationOrPublic(c.natureJuridique);
      const isLarge = isLargeGroup(c.effectifTranche);

      // Filtres qui dépendent de la vérification Places — uniquement
      // appliqués si Google a réellement été consulté (sinon on ne sait
      // pas si l'établissement est fermé, donc on ne l'exclut jamais sur
      // une simple absence de donnée).
      if (googleConsulted) {
        if (filters.operationalOnly && placesResult.businessStatus === "CLOSED_PERMANENTLY") continue;
        if (filters.excludeTempClosed && placesResult.businessStatus === "CLOSED_TEMPORARILY") continue;
      }

      const verificationStatus = computeVerificationStatus(placesResult.placeId, placesResult.websiteUri, websiteQuality);

      const base = {
        ...c,
        isAssociation,
        isLargeGroup: isLarge,
        isChain,
        placeId: placesResult.placeId,
        businessStatus: placesResult.businessStatus,
        websiteUri: placesResult.websiteUri,
        websiteQuality,
        verificationStatus,
        phone: placesResult.phone,
        googleRating: placesResult.rating,
        googleRatingCount: placesResult.ratingCount,
        placesCheckedAt: checkedAt,
      };

      const { score, sources } = computeQualityScore(base, scoringProfile);
      if (fromCache) sources.cached = true;

      const relevance = computeRelevance(
        c.nafCode,
        body.audience ?? null,
        nafToBusinessType,
        scoringProfile,
        c.companyName,
        nafToExclusionKeywords,
      );

      enriched.push({
        ...base,
        qualityScore: score,
        verificationSources: sources,
        relevanceScore: relevance.score,
        relevanceTier: relevance.tier,
        relevanceReasons: relevance.reasons,
      });
    }

    // Stage 6/8 : résultats après normalisation/scoring (avant filtre web).
    console.log(`[search-prospects] après scoring/pertinence : ${enriched.length} prospects enrichis`);

    // 6. Filtre "besoin digital" — optionnel, "all" par défaut côté client :
    // ne doit jamais, à lui seul, faire disparaître un prospect du registre.
    let results = enriched;
    if (filters.webFilter !== "all") {
      const wanted: Record<string, EnrichedProspect["websiteQuality"][]> = {
        no_or_weak: ["none", "weak"],
        none: ["none"],
        weak: ["weak"],
        unknown: ["unknown"],
      };
      const allowed = wanted[filters.webFilter];
      if (allowed) results = results.filter((r) => allowed.includes(r.websiteQuality));
      console.log(`[search-prospects] après filtre web (${filters.webFilter}) : ${results.length} résultats`);
    }

    // 7. Tri : la pertinence (primary avant secondary) prime toujours sur le
    // score commercial — un prospect très rentable mais hors-cible reste
    // affiché, mais jamais devant les prospects réellement pertinents.
    const tierRank = (t: EnrichedProspect["relevanceTier"]) => (t === "primary" ? 0 : 1);
    if (filters.needContact) {
      results = [...results].sort((a, b) => {
        const aHas = a.phone || a.websiteUri ? 1 : 0;
        const bHas = b.phone || b.websiteUri ? 1 : 0;
        return tierRank(a.relevanceTier) - tierRank(b.relevanceTier) || bHas - aHas || b.qualityScore - a.qualityScore;
      });
    } else {
      results.sort((a, b) => tierRank(a.relevanceTier) - tierRank(b.relevanceTier) || b.qualityScore - a.qualityScore);
    }

    const primaryCount = results.filter((r) => r.relevanceTier === "primary").length;

    // Stage 8/8 : résultats réellement affichés au client.
    console.log(
      `[search-prospects] affichés : ${results.length} (primary=${primaryCount}, ` +
        `secondary=${results.length - primaryCount})`,
    );

    return jsonResponse({
      totalMatchedInRegistry: totalMatched,
      totalReturned: results.length,
      primaryCount,
      secondaryCount: results.length - primaryCount,
      noPrimaryResults: results.length > 0 && primaryCount === 0,
      googleVerifiedCount: results.filter((r) => r.placeId !== null).length,
      googlePlacesConfigured: Boolean(googleApiKey),
      scoringProfile,
      scoringProfileLabel: SCORING_PROFILE_LABEL[scoringProfile],
      results,
    });
  } catch (err) {
    console.error("search-prospects error", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      502,
    );
  }
});
