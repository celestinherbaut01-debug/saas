"use client";

import { useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "prospectflow_onboarding_banner_dismissed";

/**
 * Rappel non bloquant : l'utilisateur peut explorer tout le SaaS sans avoir
 * terminé l'onboarding, mais certaines actions (rechercher de vrais
 * prospects) ont besoin d'une adresse de départ. "Plus tard" masque le
 * bandeau pour la session en cours (sessionStorage) — il revient à la
 * prochaine connexion tant que la configuration n'est pas terminée.
 */
export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Stockage indisponible (navigation privée stricte) : tant pis, pas bloquant.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-soft px-3.5 py-3 text-[12.5px]">
      <div>
        <p className="font-semibold text-ink">Votre espace n&apos;est pas encore configuré</p>
        <p className="mt-0.5 text-muted">
          Terminez votre configuration (métier, cibles, adresse) pour commencer à prospecter.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/onboarding"
          className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-bg"
        >
          Continuer la configuration
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
