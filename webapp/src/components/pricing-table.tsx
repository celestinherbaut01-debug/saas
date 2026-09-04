"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ENTITLEMENTS, PLAN_ORDER, yearlyPrice } from "@/lib/entitlements";

export function PricingTable({ loggedIn = false }: { loggedIn?: boolean }) {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-10">
      <div className="flex items-center gap-1 rounded-full border border-line bg-panel p-1 text-[12.5px] font-semibold shadow-sm">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={cn("rounded-full px-4 py-1.5 transition-colors", !yearly ? "bg-ink text-bg" : "text-muted hover:text-ink")}
        >
          Mensuel
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={cn("rounded-full px-4 py-1.5 transition-colors", yearly ? "bg-ink text-bg" : "text-muted hover:text-ink")}
        >
          Annuel <span className="text-[10px] opacity-80">(2 mois offerts)</span>
        </button>
      </div>

      <div className="grid w-full gap-5 lg:grid-cols-4 lg:items-start">
        {PLAN_ORDER.map((planId) => {
          const plan = ENTITLEMENTS[planId];
          const price = plan.priceMonthly === 0 ? 0 : yearly ? yearlyPrice(planId) : plan.priceMonthly;
          const isPro = plan.highlighted;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-3xl border p-7 transition-shadow",
                isPro
                  ? "border-accent/40 bg-panel shadow-[0_8px_40px_-12px_var(--accent)] lg:-my-3 lg:py-10 lg:shadow-[0_16px_56px_-16px_var(--accent)]"
                  : "border-line bg-panel hover:shadow-md",
              )}
            >
              {isPro && (
                <span className="absolute -top-3 left-1/2 w-fit -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[10.5px] font-bold text-accent-ink shadow-sm">
                  Le plus populaire
                </span>
              )}

              <h3 className="font-display text-[17px] font-extrabold tracking-tight">{plan.label}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{plan.tagline}</p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-[34px] font-extrabold tracking-tight">
                  {price === 0 ? "0 €" : `${price} €`}
                </span>
                {price > 0 && <span className="text-[12.5px] font-medium text-faint">{yearly ? "/an" : "/mois"}</span>}
              </p>

              <Link
                href={loggedIn ? "/abonnement" : plan.priceMonthly === 0 ? "/signup" : `/signup?plan=${plan.id}`}
                className={cn(
                  "mt-6 rounded-xl px-4 py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90",
                  isPro ? "bg-accent text-accent-ink" : "border border-line bg-bg text-ink",
                )}
              >
                {loggedIn
                  ? "Gérer dans Abonnements"
                  : plan.priceMonthly === 0
                    ? "Démarrer gratuitement"
                    : `Choisir ${plan.label}`}
              </Link>

              <ul className="mt-7 flex flex-col gap-3 text-[12.5px] leading-relaxed text-muted">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                        isPro ? "bg-accent text-accent-ink" : "bg-soft text-accent",
                      )}
                    >
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11.5px] text-faint">
        {loggedIn
          ? "Les paiements en ligne (Stripe) ne sont pas encore branchés — gérez votre forfait actuel depuis Abonnements."
          : "Les paiements en ligne (Stripe) ne sont pas encore branchés — inscription gratuite disponible dès maintenant, changement de forfait payant à venir."}
      </p>
    </div>
  );
}
