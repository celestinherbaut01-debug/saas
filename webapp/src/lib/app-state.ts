import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Plan } from "@/lib/entitlements";
import { getCachedMembership } from "@/lib/session";
import { getWorkspacePlan } from "@/lib/plan";

// Source UNIQUE de calcul de l'état applicatif d'un utilisateur connecté.
// proxy.ts, le dashboard, la prospection, Business OS lisent tous CETTE
// fonction plutôt que de refaire chacun leur propre requête légèrement
// différente — c'était une vraie source de bugs (routing qui "invente" un
// état à partir d'une lecture différente de celle du reste de l'app).
//
// Accepte un client déjà créé (plutôt que de le créer elle-même) car le
// middleware Next.js et les Server Components/Actions doivent créer leur
// client Supabase différemment (gestion des cookies incompatible entre les
// deux runtimes) — la logique de calcul, elle, reste unique.
export interface AppState {
  authenticated: boolean;
  userId: string | null;
  onboardingCompleted: boolean;
  workspaceId: string | null;
  plan: Plan;
  businessProfileExists: boolean;
  ownCategoryId: string | null;
}

const EMPTY_STATE: AppState = {
  authenticated: false,
  userId: null,
  onboardingCompleted: false,
  workspaceId: null,
  plan: "free",
  businessProfileExists: false,
  ownCategoryId: null,
};

export async function getUserAppState(
  supabase: SupabaseClient<Database>,
  userId: string | null,
): Promise<AppState> {
  if (!userId) return EMPTY_STATE;

  // getCachedMembership / getWorkspacePlan sont mémorisées par requête
  // (React `cache()`) : si AppShell ou la page ont déjà appelé ces mêmes
  // fonctions, ceci ne refait aucun aller-retour Supabase — voir
  // lib/session.ts et lib/plan.ts.
  const [{ data: profile }, membership] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle(),
    getCachedMembership(userId),
  ]);

  const workspaceId = membership?.workspace_id ?? null;

  let plan: Plan = "free";
  let businessProfileExists = false;
  let ownCategoryId: string | null = null;

  if (workspaceId) {
    const [planResult, { data: businessProfile }] = await Promise.all([
      getWorkspacePlan(workspaceId),
      supabase.from("business_profiles").select("own_category_id").eq("workspace_id", workspaceId).maybeSingle(),
    ]);
    plan = planResult;
    businessProfileExists = businessProfile !== null;
    ownCategoryId = businessProfile?.own_category_id ?? null;
  }

  return {
    authenticated: true,
    userId,
    onboardingCompleted: profile?.onboarding_completed === true,
    workspaceId,
    plan,
    businessProfileExists,
    ownCategoryId,
  };
}
