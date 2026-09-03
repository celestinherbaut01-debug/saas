"use client";

import Link from "next/link";
import { GoogleButton } from "@/components/google-button";
import { signOut } from "@/lib/actions/auth";

/**
 * Affiché sur /login et /signup quand une session existe déjà, au lieu
 * d'une redirection automatique et invisible. L'utilisateur choisit
 * explicitement quoi faire — ne casse pas la session existante tant qu'il
 * n'a pas cliqué "Se déconnecter" ou "Changer de compte".
 */
export function SessionGate({ email, continueHref }: { email: string; continueHref: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-soft px-4 py-3.5">
        <p className="text-[13px] font-bold text-ink">Vous êtes déjà connecté sur cet appareil.</p>
        <p className="mt-0.5 text-[12.5px] text-muted">{email}</p>
      </div>

      <Link
        href={continueHref}
        className="rounded-lg bg-ink px-4 py-2.5 text-center text-[13.5px] font-semibold text-bg shadow-sm transition hover:opacity-90"
      >
        Continuer vers ProspectFlow
      </Link>

      <GoogleButton label="Changer de compte Google" forceAccountSelection />

      <form action={signOut}>
        <button
          type="submit"
          className="w-full text-center text-[12.5px] font-medium text-muted transition hover:text-ink hover:underline"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
