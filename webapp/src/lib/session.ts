import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBusinessOsProfile, type BusinessOsProfile } from "@/lib/business-os";

// Primitives mémorisées par requête (React `cache()`) pour l'utilisateur
// connecté et son workspace. Avant ce fichier, chaque page ET AppShell
// appelaient chacun `supabase.auth.getUser()` (un aller-retour réseau réel
// — Supabase revérifie le JWT auprès du serveur Auth, ce n'est pas un
// simple décodage local) et la requête workspace_members, doublant ces deux
// appels sur CHAQUE navigation. `cache()` fait qu'un deuxième appel avec les
// mêmes arguments, dans la même requête, renvoie le résultat déjà obtenu au
// lieu de refaire l'aller-retour — sans rien changer au comportement.
export const getCachedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export interface Membership {
  workspace_id: string;
}

export const getCachedMembership = cache(async (userId: string): Promise<Membership | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data;
});

export interface CachedBusinessProfile {
  own_category_id: string | null;
  offer_description: string;
  audience: "b2b" | "b2c" | "both";
  product_mode: "acquisition" | "business_os" | "both";
}

/**
 * Pilote la navigation/le dashboard (product_mode) — lu par AppShell sur
 * CHAQUE page protégée, donc mémorisé par requête comme le reste de ce
 * fichier plutôt que refait à chaque composant qui en a besoin.
 */
export const getCachedBusinessProfile = cache(async (workspaceId: string): Promise<CachedBusinessProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_profiles")
    .select("own_category_id, offer_description, audience, product_mode")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data;
});

export interface AutomationSettings {
  appointment_reminder_24h: boolean;
  appointment_reminder_2h: boolean;
  custom_reminder_hours_before: number | null;
  low_stock_alert: boolean;
  renewal_alert: boolean;
}

/**
 * Valeurs par défaut quand aucune ligne n'existe encore (aucune migration
 * de backfill : la ligne n'est créée qu'au premier enregistrement depuis
 * /automatisations, voir lib/actions/automation.ts) — jamais un null qui
 * obligerait chaque lecteur à deviner le comportement par défaut.
 */
const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  appointment_reminder_24h: true,
  appointment_reminder_2h: false,
  custom_reminder_hours_before: null,
  low_stock_alert: true,
  renewal_alert: true,
};

/** Lu par la page Automatisations ET par chaque page Business OS (insights NOVA) — mémorisé par requête. */
export const getCachedAutomationSettings = cache(async (workspaceId: string): Promise<AutomationSettings> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_settings")
    .select("appointment_reminder_24h, appointment_reminder_2h, custom_reminder_hours_before, low_stock_alert, renewal_alert")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data ?? DEFAULT_AUTOMATION_SETTINGS;
});

/**
 * Résout la verticale Business OS (garage/cleaning/agency/restaurant/
 * generic) d'un workspace à partir de son métier déclaré — même résolution
 * parent/feuille utilisée par /business-os, /abonnement et /automatisations
 * (auparavant dupliquée dans chacune de ces pages ; centralisée ici,
 * mémorisée par requête comme le reste de ce fichier).
 */
export const getCachedBusinessOsProfile = cache(async (workspaceId: string): Promise<BusinessOsProfile> => {
  const supabase = await createClient();
  const businessProfile = await getCachedBusinessProfile(workspaceId);

  let parentSlug: string | null = null;
  let leafSlug: string | null = null;
  if (businessProfile?.own_category_id) {
    const { data: ownCategory } = await supabase
      .from("business_categories")
      .select("slug, parent_id")
      .eq("id", businessProfile.own_category_id)
      .maybeSingle();
    leafSlug = ownCategory?.slug ?? null;
    if (ownCategory?.parent_id) {
      const { data: parent } = await supabase
        .from("business_categories")
        .select("slug")
        .eq("id", ownCategory.parent_id)
        .maybeSingle();
      parentSlug = parent?.slug ?? null;
    }
  }
  return getBusinessOsProfile(parentSlug, leafSlug);
});
