"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ENTITLEMENTS, bundleSavingsMonthly, yearlyPrice, type Plan } from "@/lib/entitlements";

// Architecture modulaire : deux modules indépendants (Acquisition /
// Business OS), chacun activable seul, plus deux bundles qui coûtent
// toujours moins cher que les deux modules pris séparément (voir
// bundleSavingsMonthly — jamais un chiffre affiché sans être dérivé des
// vrais prix des deux plans qui composent le bundle).
const ACQUISITION_PLANS: Plan[] = ["acquisition_starter", "acquisition_pro"];
const BUSINESS_OS_PLANS: Plan[] = ["business_os", "business_os_advanced"];
const BUNDLE_PLANS: Plan[] = ["complete", "complete_max"];

export function PricingTable({ loggedIn = false }: { loggedIn?: boolean }) {
  const [yearly, setYearly] = useState(false);

  function renderCard(planId: Plan) {
    const plan = ENTITLEMENTS[planId];
    const price = plan.priceMonthly === 0 ? 0 : yearly ? yearlyPrice(planId) : plan.priceMonthly;
    const savings = bundleSavingsMonthly(planId);
    const savingsDisplay = yearly ? savings * 10 : savings;
    const isPro = plan.highlighted;

    return (
      <div
        key={plan.id}
        className={cn(
          "relative flex flex-col rounded-3xl border p-7 transition-shadow",
          isPro
            ? "border-accent/40 bg-panel shadow-[0_8px_40px_-12px_var(--accent)]"
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
        {savingsDisplay > 0 && (
          <p className="mt-1 text-[11.5px] font-semibold text-accent">
            Économisez {savingsDisplay} €{yearly ? "/an" : "/mois"} vs les deux modules séparés
          </p>
        )}

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
  }

  return (
    <div className="flex w-full flex-col items-center gap-12">
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

      <div className="flex flex-col items-center gap-2.5 text-center">
        <p className="max-w-md text-[13px] leading-relaxed text-muted">
          ProspectFlow, c&apos;est <b className="text-ink">deux modules indépendants</b> — activez celui dont vous
          avez besoin, ou combinez les deux moins cher qu&apos;en les prenant séparément.
        </p>
        <Link
          href={loggedIn ? "/abonnement" : "/signup"}
          className="rounded-full border border-line bg-panel px-4 py-1.5 text-[12px] font-semibold text-ink hover:bg-soft"
        >
          0 € — Découvrir avec le plan Free
        </Link>
      </div>

      <div className="grid w-full gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-[15px] font-extrabold uppercase tracking-wide text-ink">
              Module Acquisition
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">Trouver des clients : prospection, CRM, NOVA commercial.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{ACQUISITION_PLANS.map(renderCard)}</div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-[15px] font-extrabold uppercase tracking-wide text-ink">
              Module Business OS
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Gérer l&apos;entreprise : clients, planning, stock, devis, factures.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{BUSINESS_OS_PLANS.map(renderCard)}</div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-4">
        <div className="text-center">
          <h2 className="font-display text-[15px] font-extrabold uppercase tracking-wide text-ink">
            Les deux modules
          </h2>
          <p className="mt-1 text-[12.5px] text-muted">Toujours moins cher que les deux modules achetés séparément.</p>
        </div>
        <div className="grid w-full gap-5 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">{BUNDLE_PLANS.map(renderCard)}</div>
      </div>

      <p className="text-center text-[11.5px] text-faint">
        {loggedIn
          ? "Les paiements en ligne (Stripe) ne sont pas encore branchés — gérez votre forfait actuel depuis Abonnements."
          : "Les paiements en ligne (Stripe) ne sont pas encore branchés — inscription gratuite disponible dès maintenant, changement de forfait payant à venir."}
      </p>
    </div>
  );
}
