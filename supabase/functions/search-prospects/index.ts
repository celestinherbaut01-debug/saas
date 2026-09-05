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

function badRequest(message: string) {
  return jsonResponse({ error: message }, 400);
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
      admin.from("business_categories").select("naf_codes, business_type").order("sort_order"),
    ]);

    const nafToBusinessType = new Map<string, "b2b" | "b2c" | "both">();
    for (const cat of categoryRows ?? []) {
      for (const code of cat.naf_codes as string[]) {
        if (!nafToBusinessType.has(code)) nafToBusinessType.set(code, cat.business_type as "b2b" | "b2c" | "both");
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

    const enriched: EnrichedProspect[] = [];
    let liveGoogleCallsUsed = 0;

    for (const c of candidates) {
      const isChain = isKnownChain(c.companyName);
      const isAssociation = isAssociationOrPublic(c.natureJuridique);
      const isLarge = isLargeGroup(c.effectifTranche);

      let placesResult: {
        placeId: string | null;
        businessStatus: EnrichedProspect["businessStatus"];
        websiteUri: string | null;
        phone: string | null;
        rating: number | null;
        ratingCount: number | null;
      };
      let websiteQuality: EnrichedProspect["websiteQuality"] = "unknown";
      let checkedAt: string | null = null;
      let fromCache = false;
      let googleConsulted = false;

      const cached = cacheBySiret.get(c.siret);

      if (cached && Date.now() - new Date(cached.checked_at).getTime() < cacheTtlMs) {
        placesResult = {
          placeId: cached.place_id,
          businessStatus: cached.business_status ?? "unverified",
          websiteUri: cached.website_uri,
          phone: cached.phone,
          rating: cached.google_rating,
          ratingCount: cached.google_rating_count,
        };
        websiteQuality = cached.website_quality ?? "unknown";
        checkedAt = cached.checked_at;
        fromCache = true;
        googleConsulted = true;
      } else if (googleApiKey && liveGoogleCallsUsed < maxPlacesLookups) {
        liveGoogleCallsUsed++;
        const address = [c.street, c.postalCode, c.city].filter(Boolean).join(", ");
        placesResult = await verifyWithGooglePlaces(c.companyName, address, googleApiKey);
        websiteQuality = await analyseWebsiteQuality(placesResult.websiteUri);
        checkedAt = new Date().toISOString();
        googleConsulted = true;

        await admin.from("verification_cache").upsert({
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
      } else {
        // Pas de clé Google configurée, ou plafond de vérifications payantes
        // atteint pour cette recherche : on ne fabrique aucune donnée, le
        // prospect reste explicitement "à vérifier" — mais reste affiché.
        placesResult = {
          placeId: null,
          businessStatus: "unverified",
          websiteUri: null,
          phone: null,
          rating: null,
          ratingCount: null,
        };
        websiteQuality = "unknown";
      }

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

      const relevance = computeRelevance(c.nafCode, body.audience ?? null, nafToBusinessType, scoringProfile);

      enriched.push({
        ...base,
        qualityScore: score,
        verificationSources: sources,
        relevanceScore: relevance.score,
        relevanceTier: relevance.tier,
        relevanceReasons: relevance.reasons,
      });
    }

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
