"use server";

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { assertQuota, incrementUsage } from "@/lib/quota";
import { ENTITLEMENTS } from "@/lib/entitlements";
import {
  normalizeSearchResponse,
  type ProspectionSearchResponse,
} from "@/lib/search-response";
import { normalizeProspectionFilters } from "@/lib/prospecting-config";
import {
  findObjective,
  scoringProfileForObjective,
} from "@/lib/prospecting/offer-catalog";
import {
  filtersForObjective,
  matchesSearchCriteria,
  offerReason,
} from "@/lib/prospecting/search-policy";
import {
  computeQualityScore,
  SCORING_PROFILE_LABEL,
} from "../../../../supabase/functions/_shared/scoring";
import { computeRelevance } from "../../../../supabase/functions/_shared/relevance";

export type { ProspectionSearchResponse };

export interface SearchProspectsParams {
  objectiveId: string;
  targetCategoryIds: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  nafCodes: string[];
  filters: Record<string, unknown>;
  /** Détermine le profil de scoring (voir lib/scoring-profile.ts) — jamais lié au prospect. */
  ownCategorySlug?: string | null;
  audience?: "b2b" | "b2c" | "both" | null;
  /** Objectif de prospection choisi (voir lib/prospecting/offer-catalog.ts scoringProfileForObjective) — prioritaire sur ownCategorySlug/audience pour le score. */
  scoringProfileOverride?: string | null;
}

export interface SearchProspectsResult {
  ok: boolean;
  error?: string;
  /** Diagnostic complet (jamais inventé) — présent uniquement hors production. */
  devDetail?: string;
  data?: ProspectionSearchResponse;
}

const GENERIC_SEARCH_ERROR =
  "La recherche a échoué. Réessayez dans un instant — si le problème persiste, contactez le support.";

function isDev() {
  return process.env.NODE_ENV !== "production";
}

type ErrorOrigin =
  | "auth"
  | "validation"
  | "external_api"
  | "supabase_infra"
  | "network"
  | "unknown";

const ORIGIN_LABEL: Record<ErrorOrigin, string> = {
  auth: "Authentification (session invalide côté Edge Function)",
  validation: "Requête invalide (paramètres rejetés par la fonction)",
  external_api:
    "API externe en échec (registre entreprises et/ou Google Places)",
  supabase_infra:
    "Infrastructure Supabase (fonction introuvable ou relais indisponible)",
  network: "Réseau (impossible de joindre l'Edge Function)",
  unknown: "Cause non identifiée",
};

// Messages sûrs à afficher tels quels à l'utilisateur pour les origines où
// notre propre fonction a déjà rédigé un message français destiné à
// l'affichage (voir supabase/functions/search-prospects/index.ts). Pour les
// autres origines (API externe, infra, réseau), le message brut peut
// contenir du texte d'API tiers non destiné à l'utilisateur final — on
// affiche un message générique sûr et on garde le détail réel en devDetail.
const SAFE_TO_DISPLAY_ORIGINS: ErrorOrigin[] = ["auth", "validation"];

/**
 * `supabase.functions.invoke()` masque le vrai problème derrière un message
 * TOUJOURS IDENTIQUE ("Edge Function returned a non-2xx status code") pour
 * n'importe quelle erreur HTTP — vérifié dans
 * node_modules/@supabase/functions-js : FunctionsHttpError a un message
 * codé en dur, la vraie réponse (status + body JSON renvoyé par notre
 * fonction) est dans `error.context`, un Response que le SDK ne lit
 * jamais. C'est la cause exacte du bug rapporté : le message affiché ne
 * varie jamais, qu'il s'agisse d'une session invalide, d'un rayon
 * invalide, ou du registre SIRENE en panne. On décode ce Response
 * explicitement ci-dessous.
 */
async function describeFunctionError(error: unknown): Promise<{
  status: number | null;
  bodyText: string;
  serverMessage: string | null;
  origin: ErrorOrigin;
}> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const status = res.status;
    let bodyText = "";
    let serverMessage: string | null = null;
    try {
      bodyText = await res.text();
      const parsed = JSON.parse(bodyText) as { error?: string };
      serverMessage = typeof parsed.error === "string" ? parsed.error : null;
    } catch {
      // Corps non-JSON (ex. page d'erreur brute renvoyée par le gateway
      // Supabase avant même d'atteindre notre code) — bodyText garde ce qui
      // a pu être lu, serverMessage reste null plutôt que d'inventer un texte.
    }
    const origin: ErrorOrigin =
      status === 401
        ? "auth"
        : status === 400
          ? "validation"
          : status === 404
            ? "supabase_infra" // fonction non déployée, ou mauvais nom de fonction
            : status >= 500
              ? "external_api" // notre catch-all (index.ts) renvoie 502 pour SIRENE/Places en échec
              : "unknown";
    return { status, bodyText, serverMessage, origin };
  }
  if (error instanceof FunctionsRelayError) {
    return {
      status: null,
      bodyText: error.message,
      serverMessage: null,
      origin: "supabase_infra",
    };
  }
  if (error instanceof FunctionsFetchError) {
    return {
      status: null,
      bodyText: error.message,
      serverMessage: null,
      origin: "network",
    };
  }
  return {
    status: null,
    bodyText: error instanceof Error ? error.message : String(error),
    serverMessage: null,
    origin: "unknown",
  };
}

/**
 * Passe par une Server Action (plutôt qu'un appel direct depuis le
 * navigateur) pour que le quota "recherches/mois" du plan et la limite de
 * rayon du plan soient vérifiés côté serveur avant de consommer l'edge
 * function — jamais uniquement côté client, qui ne protège rien.
 */
export async function runProspectSearch(
  workspaceId: string,
  params: SearchProspectsParams,
): Promise<SearchProspectsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership)
    return { ok: false, error: "Vous n’avez pas accès à cet espace." };

  const [{ data: profile }, { data: categories }] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("own_category_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase.from("business_categories").select("*"),
  ]);
  const ownCategory = categories?.find(
    (c) => c.id === profile?.own_category_id,
  );
  const parent = categories?.find((c) => c.id === ownCategory?.parent_id);
  const objective = findObjective(
    ownCategory?.slug ?? null,
    parent?.slug ?? null,
    params.objectiveId,
  );
  if (!objective || objective.audience !== "b2b") {
    return {
      ok: false,
      error:
        "Choisissez une offre destinée aux entreprises. Pour vos clients particuliers, ouvrez la gestion métier.",
    };
  }
  if (
    !Number.isFinite(params.lat) ||
    Math.abs(params.lat) > 90 ||
    !Number.isFinite(params.lng) ||
    Math.abs(params.lng) > 180 ||
    !Number.isFinite(params.radiusKm) ||
    params.radiusKm < 0.5
  ) {
    return {
      ok: false,
      error: "Validez une adresse et un rayon de recherche valides.",
    };
  }
  const selectedIds = Array.isArray(params.targetCategoryIds)
    ? params.targetCategoryIds
    : [];
  const selectedCategories = (categories ?? []).filter(
    (c) => c.parent_id && selectedIds.includes(c.id),
  );
  const nafCodes = [...new Set(selectedCategories.flatMap((c) => c.naf_codes))];
  if (!nafCodes.length)
    return {
      ok: false,
      error: "Sélectionnez au moins un secteur à prospecter.",
    };
  const searchFilters = filtersForObjective(
    objective,
    normalizeProspectionFilters(params.filters),
  );
  const scoringProfile = scoringProfileForObjective(objective);

  const plan = await getWorkspacePlan(workspaceId);

  const maxRadiusKm = ENTITLEMENTS[plan].maxRadiusKm;
  if (params.radiusKm > maxRadiusKm) {
    return {
      ok: false,
      error: `Rayon trop grand pour votre forfait ${ENTITLEMENTS[plan].label} (max ${maxRadiusKm} km). Passez à un forfait supérieur dans Abonnements.`,
    };
  }

  try {
    await assertQuota(workspaceId, "searches", plan);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Quota atteint.",
    };
  }

  // Log temporaire de diagnostic (stage "requête envoyée") — uniquement en
  // dev, jamais en production. À retirer une fois le pipeline confirmé
  // stable en conditions réelles.
  if (isDev()) {
    console.log("[search-prospects][server-action] requête envoyée :", {
      workspaceId,
      plan,
      radiusKm: params.radiusKm,
      nafCodes: params.nafCodes,
      audience: params.audience,
      ownCategorySlug: params.ownCategorySlug,
    });
  }

  // Retrieve candidates with no web filter; apply the current policy here even
  // when the independently deployed Edge Function is on an older version.
  const { data, error } = await supabase.functions.invoke("search-prospects", {
    body: {
      lat: params.lat,
      lng: params.lng,
      radiusKm: params.radiusKm,
      nafCodes,
      filters: { ...searchFilters, webFilter: "all" },
      ownCategorySlug: ownCategory?.slug ?? null,
      audience: "both", // A buyer's own customer audience does not determine whether it can buy our service.
      scoringProfileOverride: scoringProfile,
    },
  });

  if (error) {
    const info = await describeFunctionError(error);

    // Toujours logué serveur, même en production : c'est ici (pas dans le
    // message affiché) que la cause réelle doit rester traçable.
    console.error("[search-prospects] appel échoué", {
      workspaceId,
      plan,
      radiusKm: params.radiusKm,
      nafCodes: params.nafCodes,
      status: info.status,
      origin: info.origin,
      body: info.bodyText,
    });

    const devDetail = [
      `Fonction appelée : search-prospects`,
      `Statut HTTP : ${info.status ?? "aucun (erreur avant réception d'une réponse HTTP)"}`,
      `Origine détectée : ${ORIGIN_LABEL[info.origin]}`,
      `Message serveur (JSON) : ${info.serverMessage ?? "(aucun message JSON exploitable)"}`,
      `Corps brut de la réponse : ${info.bodyText || "(vide)"}`,
      `workspace_id : ${workspaceId}`,
      `plan : ${plan}`,
      `rayon demandé : ${params.radiusKm} km (max autorisé pour ce forfait : ${maxRadiusKm} km)`,
      `catégories sélectionnées (codes NAF) : ${params.nafCodes.length > 0 ? params.nafCodes.join(", ") : "(aucune)"}`,
    ].join("\n");

    return {
      ok: false,
      error:
        info.serverMessage && SAFE_TO_DISPLAY_ORIGINS.includes(info.origin)
          ? info.serverMessage
          : GENERIC_SEARCH_ERROR,
      devDetail: isDev() ? devDetail : undefined,
    };
  }

  if (data?.error) {
    return { ok: false, error: data.error };
  }

  const normalized = normalizeSearchResponse(data);
  const exclusions = new Map<string, string[]>();
  for (const category of selectedCategories) {
    for (const code of category.naf_codes)
      exclusions.set(code, [
        ...(exclusions.get(code) ?? []),
        ...(category.exclusion_keywords ?? []),
      ]);
  }
  const seen = new Set<string>();
  const candidates = normalized.results;
  normalized.results = candidates
    .filter((r) => {
      if (
        !r.siret ||
        seen.has(r.siret) ||
        !matchesSearchCriteria(r, nafCodes, params.radiusKm, searchFilters)
      )
        return false;
      seen.add(r.siret);
      return true;
    })
    .map((r) => {
      const { score, sources } = computeQualityScore(r, scoringProfile);
      const relevance = computeRelevance(
        r.nafCode,
        null,
        new Map(),
        scoringProfile,
        r.companyName,
        exclusions,
      );
      return {
        ...r,
        qualityScore: score,
        verificationSources: {
          ...sources,
          cached: r.verificationSources?.cached === true,
        },
        relevanceScore: relevance.score,
        relevanceTier: relevance.tier,
        relevanceReasons: [...relevance.reasons, offerReason(objective)],
      };
    })
    .sort(
      (a, b) =>
        Number(a.relevanceTier === "secondary") -
          Number(b.relevanceTier === "secondary") ||
        b.qualityScore - a.qualityScore,
    );
  normalized.displayed = normalized.results.length;
  normalized.googleVerified = normalized.results.filter(
    (r) => r.placeId,
  ).length;
  normalized.scoringProfileLabel = SCORING_PROFILE_LABEL[scoringProfile];
  if (searchFilters.webFilter !== "all") {
    const unknownCount = candidates.filter(
      (r) => !r.placeId && !r.websiteUri,
    ).length;
    if (unknownCount)
      normalized.warnings.push(
        `${unknownCount} entreprise(s) avec un statut de site inconnu ne sont pas retenues par votre filtre web. Une absence d’information ne prouve pas une absence de site.`,
      );
  }

  // Log temporaire de diagnostic (stage "résultats après normalisation") —
  // uniquement en dev. Montre exactement ce que l'UI va recevoir, y compris
  // les éventuels avertissements de dégradation (voir lib/search-response.ts).
  if (isDev()) {
    console.log("[search-prospects][server-action] résultat normalisé :", {
      registryFound: normalized.registryFound,
      displayed: normalized.displayed,
      googleVerified: normalized.googleVerified,
      resultsCount: normalized.results.length,
      warnings: normalized.warnings,
    });
  }

  await incrementUsage(workspaceId, "searches");
  return { ok: true, data: normalized };
}
