"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ENTITLEMENTS, PLAN_ORDER, yearlyPrice } from "@/lib/entitlements";

export function PricingTable() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex items-center gap-3 rounded-full border border-line bg-panel p-1 text-[12.5px] font-semibold">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={cn("rounded-full px-3.5 py-1.5", !yearly ? "bg-ink text-bg" : "text-muted")}
        >
          Mensuel
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={cn("rounded-full px-3.5 py-1.5", yearly ? "bg-ink text-bg" : "text-muted")}
        >
          Annuel <span className="text-[10px] opacity-80">(2 mois offerts)</span>
        </button>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const plan = ENTITLEMENTS[planId];
          const price = plan.priceMonthly === 0 ? 0 : yearly ? yearlyPrice(planId) : plan.priceMonthly;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border p-5",
                plan.highlighted ? "border-ink bg-soft shadow-sm" : "border-line bg-panel",
              )}
            >
              {plan.highlighted && (
                <span className="mb-2 w-fit rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-bg">
                  LE PLUS CHOISI
                </span>
              )}
              <h3 className="font-display text-[15px] font-extrabold">{plan.label}</h3>
              <p className="mt-1 text-[11.5px] text-muted">{plan.tagline}</p>
              <p className="mt-4 font-display text-[26px] font-extrabold">
                {price === 0 ? "0€" : `${price}€`}
                <span className="text-[12px] font-medium text-faint">{yearly ? "/an" : "/mois"}</span>
              </p>
              <Link
                href="/signup"
                className={cn(
                  "mt-4 rounded-lg px-3 py-2 text-center text-[12.5px] font-semibold",
                  plan.highlighted ? "bg-ink text-bg" : "border border-line bg-bg text-ink",
                )}
              >
                {plan.priceMonthly === 0 ? "Démarrer gratuitement" : "Essayer"}
              </Link>
              <ul className="mt-5 flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11.5px] text-faint">
        Les paiements en ligne (Stripe) ne sont pas encore branchés — inscription gratuite disponible dès
        maintenant, changement de forfait payant à venir.
      </p>
    </div>
  );
}
