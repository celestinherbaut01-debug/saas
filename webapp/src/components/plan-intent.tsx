"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { isValidPlan, ENTITLEMENTS, type Plan } from "@/lib/entitlements";

const STORAGE_KEY = "prospectflow_intended_plan";

function noopSubscribe() {
  return () => {};
}
function readStoredPlan(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function readStoredPlanServer(): string | null {
  return null;
}

/** Enregistre en local (navigateur) le plan choisi sur /tarifs avant l'inscription. */
export function PlanIntentCapture({ plan }: { plan: string | null }) {
  useEffect(() => {
    if (plan && isValidPlan(plan) && plan !== "free") {
      try {
        localStorage.setItem(STORAGE_KEY, plan);
      } catch {
        // Stockage indisponible (navigation privée stricte) : tant pis, pas bloquant.
      }
    }
  }, [plan]);

  return null;
}

/**
 * Rappelle sur le dashboard le plan choisi avant inscription — n'active
 * JAMAIS le plan tout seul (Stripe n'est pas branché, aucun paiement n'a eu
 * lieu) : uniquement un rappel avec un lien vers Paramètres pour l'activer
 * manuellement (dev) ou plus tard payer (prod).
 */
export function PlanIntentBanner({ currentPlan }: { currentPlan: Plan }) {
  const stored = useSyncExternalStore(noopSubscribe, readStoredPlan, readStoredPlanServer);
  const [dismissed, setDismissed] = useState(false);
  const intended = stored && isValidPlan(stored) ? stored : null;

  if (!intended || intended === currentPlan || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-soft px-3.5 py-2.5 text-[12.5px]">
      <span>
        Vous aviez choisi le plan <b>{ENTITLEMENTS[intended].label}</b> avant de vous inscrire.{" "}
        <Link href="/parametres" className="font-semibold text-accent">
          Passer à ce plan
        </Link>
      </span>
      <button type="button" onClick={dismiss} className="shrink-0 text-faint hover:text-muted">
        ✕
      </button>
    </div>
  );
}
