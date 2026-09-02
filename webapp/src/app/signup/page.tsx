import Link from "next/link";
import { Card } from "@/components/ui/card";
import { GoogleButton } from "@/components/google-button";
import { AuthForm } from "@/components/auth-form";
import { signUpWithPassword } from "@/lib/actions/auth";

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm shadow-sm">
        <h1 className="font-display text-xl font-extrabold">Créer un compte</h1>
        <p className="mt-1 text-[13px] text-muted">
          Gratuit pour commencer — pas de carte bancaire requise.
        </p>

        <div className="mt-6">
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
      </Card>
    </main>
  );
}
