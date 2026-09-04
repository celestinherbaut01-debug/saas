"use server";

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { assertQuota, incrementUsage } from "@/lib/quota";
import { ENTITLEMENTS } from "@/lib/entitlements";

export interface SearchProspectsParams {
  lat: number;
  lng: number;
  radiusKm: number;
  nafCodes: string[];
  filters: Record<string, unknown>;
}

export interface SearchProspectsResult {
  ok: boolean;
  error?: string;
  /** Diagnostic complet (jamais inventé) — présent uniquement hors production. */
  devDetail?: string;
  data?: unknown;
}

const GENERIC_SEARCH_ERROR =
  "La recherche a échoué. Réessayez dans un instant — si le problème persiste, contactez le support.";

function isDev() {
  return process.env.NODE_ENV !== "production";
}

type ErrorOrigin = "auth" | "validation" | "external_api" | "supabase_infra" | "network" | "unknown";

const ORIGIN_LABEL: Record<ErrorOrigin, string> = {
  auth: "Authentification (session invalide côté Edge Function)",
  validation: "Requête invalide (paramètres rejetés par la fonction)",
  external_api: "API externe en échec (registre entreprises et/ou Google Places)",
  supabase_infra: "Infrastructure Supabase (fonction introuvable ou relais indisponible)",
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
    return { status: null, bodyText: error.message, serverMessage: null, origin: "supabase_infra" };
  }
  if (error instanceof FunctionsFetchError) {
    return { status: null, bodyText: error.message, serverMessage: null, origin: "network" };
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
    return { ok: false, error: e instanceof Error ? e.message : "Quota atteint." };
  }

  const { data, error } = await supabase.functions.invoke("search-prospects", { body: params });

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

  await incrementUsage(workspaceId, "searches");
  return { ok: true, data };
}
