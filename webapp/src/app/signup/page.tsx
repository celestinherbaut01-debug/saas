import Link from "next/link";
import { Card } from "@/components/ui/card";
import { GoogleButton } from "@/components/google-button";
import { AuthForm } from "@/components/auth-form";
import { signUpWithPassword } from "@/lib/actions/auth";
import { RememberCheckbox } from "@/components/remember-checkbox";
import { SessionGate } from "@/components/session-gate";
import { PlanIntentCapture } from "@/components/plan-intent";
import { ENTITLEMENTS, isValidPlan } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const planParam = typeof params.plan === "string" ? params.plan : null;
  const selectedPlan = planParam && isValidPlan(planParam) && planParam !== "free" ? planParam : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let continueHref = "/dashboard";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    continueHref = profile?.onboarding_completed ? "/dashboard" : "/onboarding";
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      {!user && <PlanIntentCapture plan={selectedPlan} />}
      <Card className="w-full max-w-sm shadow-sm">
        <h1 className="font-display text-xl font-extrabold">Créer un compte</h1>
        <p className="mt-1 text-[13px] text-muted">
          {user
            ? "Choisissez comment continuer."
            : selectedPlan
              ? `Plan choisi : ${ENTITLEMENTS[selectedPlan].label}. Créez votre compte pour continuer.`
              : "Gratuit pour commencer — pas de carte bancaire requise."}
        </p>

        {user ? (
          <div className="mt-6">
            <SessionGate email={user.email ?? "compte connecté"} continueHref={continueHref} />
          </div>
        ) : (
          <>
            <div className="mt-4">
              <RememberCheckbox />
            </div>

            <div className="mt-4">
              <GoogleButton />
            </div>

            <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-faint">
              <span className="h-px flex-1 bg-line" />
              ou
              <span className="h-px flex-1 bg-line" />
            </div>

            <AuthForm action={signUpWithPassword} submitLabel="Créer mon compte" />

            <p className="mt-5 text-center text-[13px] text-muted">
              Déjà un compte ?{" "}
              <Link href="/login" className="font-semibold text-accent">
                Se connecter
              </Link>
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
