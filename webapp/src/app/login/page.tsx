import Link from "next/link";
import { Card } from "@/components/ui/card";
import { GoogleButton } from "@/components/google-button";
import { AuthForm } from "@/components/auth-form";
import { RememberCheckbox } from "@/components/remember-checkbox";
import { SessionGate } from "@/components/session-gate";
import { signInWithPassword } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let continueHref = next ?? "/dashboard";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    continueHref = profile?.onboarding_completed ? next ?? "/dashboard" : "/onboarding";
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm shadow-sm">
        <h1 className="font-display text-xl font-extrabold">Se connecter</h1>
        <p className="mt-1 text-[13px] text-muted">
          {user ? "Choisissez comment continuer." : "Connectez-vous pour accéder à votre espace."}
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
              <GoogleButton next={next} />
            </div>

            <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-faint">
              <span className="h-px flex-1 bg-line" />
              ou
              <span className="h-px flex-1 bg-line" />
            </div>

            <AuthForm action={signInWithPassword} submitLabel="Se connecter" />

            <p className="mt-5 text-center text-[13px] text-muted">
              Pas encore de compte ?{" "}
              <Link href="/signup" className="font-semibold text-accent">
                Créer un compte
              </Link>
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
