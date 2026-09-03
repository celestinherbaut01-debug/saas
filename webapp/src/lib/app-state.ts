import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Plan } from "@/lib/entitlements";

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

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle(),
    supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).maybeSingle(),
  ]);

  const workspaceId = membership?.workspace_id ?? null;

  let plan: Plan = "free";
  let businessProfileExists = false;
  let ownCategoryId: string | null = null;

  if (workspaceId) {
    const [{ data: subscription }, { data: businessProfile }] = await Promise.all([
      supabase.from("subscriptions").select("plan, status").eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("business_profiles").select("own_category_id").eq("workspace_id", workspaceId).maybeSingle(),
    ]);
    if (subscription && subscription.status !== "canceled" && subscription.status !== "past_due") {
      plan = subscription.plan;
    }
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
