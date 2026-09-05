"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { QuotaStatus } from "@/lib/quota";
import { Card } from "@/components/ui/card";
import { UsageBar } from "@/components/ui/usage-bar";
import { cn } from "@/lib/utils";
import { setDevPlan } from "@/lib/actions/settings";
import { ENTITLEMENTS, PLAN_ORDER, bundleSavingsMonthly, upgradeOptions, type Plan } from "@/lib/entitlements";

/** Décrit en une phrase ce que le module ajoute — jamais un texte figé par plan, dérivé des deux axes réels. */
function describeUpgrade(current: Plan, candidate: Plan): string {
  const cur = ENTITLEMENTS[current];
  const cand = ENTITLEMENTS[candidate];
  const gains: string[] = [];
  if (cand.acquisitionLevel !== cur.acquisitionLevel) {
    gains.push(cur.acquisitionLevel === "none" ? "ajoute le module Acquisition" : "passe Acquisition au niveau Pro");
  }
  if (cand.businessOsLevel !== cur.businessOsLevel) {
    gains.push(cur.businessOsLevel === "none" ? "ajoute le module Business OS" : "passe Business OS au niveau avancé");
  }
  return gains.join(" et ") || "change de forfait";
}

export function SubscriptionView({
  workspaceId,
  currentPlan,
  usage,
  isDev,
  businessOsVerticalLabel,
}: {
  workspaceId: string;
  currentPlan: Plan;
  usage: { nova: QuotaStatus; prospects: QuotaStatus; searches: QuotaStatus };
  isDev: boolean;
  businessOsVerticalLabel?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function choosePlan(plan: Plan) {
    if (plan === currentPlan || pending) return;
    setPendingPlan(plan);
    setToast(null);
    startTransition(async () => {
      const result = await setDevPlan(workspaceId, plan);
      setPendingPlan(null);
      if (result.error) {
        // Jamais de faux succès : l'erreur réelle renvoyée par le serveur
        // s'affiche telle quelle (ex. Stripe pas branché en prod, secret
        // manquant en dev) — jamais masquée par un message générique.
        setToast({ kind: "err", text: result.error });
      } else {
        setToast({ kind: "ok", text: `Plan changé vers ${ENTITLEMENTS[plan].label}.` });
      }
    });
  }

  const entitlements = ENTITLEMENTS[currentPlan];
  const upgrades = upgradeOptions(currentPlan);

  const activeModules: { title: string; desc: string }[] = [];
  if (entitlements.acquisitionLevel !== "none") {
    activeModules.push({
      title: entitlements.acquisitionLevel === "pro" ? "Acquisition Pro" : "Acquisition Starter",
      desc: "Prospection, CRM, NOVA commercial",
    });
  }
  if (entitlements.businessOsLevel !== "none") {
    activeModules.push({
      title: businessOsVerticalLabel ? `Business OS — ${businessOsVerticalLabel}` : "Business OS",
      desc:
        entitlements.businessOsLevel === "advanced"
          ? "Avancé : équipe, alertes, automatisations, NOVA métier"
          : "Standard : clients, planning, stock, devis, factures",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Abonnement</h1>
        <p className="mt-1 text-[13px] text-muted">Vos modules actifs, votre usage, et les modules disponibles.</p>
      </div>

      <Card className="bg-gradient-to-br from-panel to-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Plan actuel</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{entitlements.label}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {entitlements.priceMonthly === 0 ? "Gratuit" : `${entitlements.priceMonthly} €/mois`}
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Paiement Stripe pas encore branché — bientôt disponible. Utilisez les modules ci-dessous pour changer de plan en développement."
            className="cursor-not-allowed rounded-lg border border-line bg-bg px-3.5 py-2 text-[12.5px] font-semibold text-faint"
          >
            Gérer mon abonnement (Stripe)
          </button>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Modules actifs</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {activeModules.length === 0 ? (
              <span className="text-[12.5px] text-faint">Aucun module payant actif.</span>
            ) : (
              activeModules.map((m) => (
                <span
                  key={m.title}
                  title={m.desc}
                  className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-bg px-3 py-1.5 text-[12px] font-semibold text-ink"
                >
                  <span className="text-accent">✓</span> {m.title}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h2 className="text-[12px] font-bold text-ink">Usage du mois</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <UsageBar label="Prospects" status={usage.prospects} />
            <UsageBar label="Recherches" status={usage.searches} />
            <UsageBar label="NOVA" status={usage.nova} />
          </div>
        </div>
      </Card>

      {toast && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium",
            toast.kind === "ok" ? "bg-green-bg text-green-fg" : "bg-red-bg text-red-fg",
          )}
        >
          {toast.text}
        </p>
      )}

      {!isDev && (
        <p className="text-[11.5px] text-faint">
          Le paiement en ligne (Stripe) n&apos;est pas encore branché en production — les changements ci-dessous
          sont désactivés ici et renverront une erreur explicite si vous forcez l&apos;appel.
        </p>
      )}

      {upgrades.length > 0 ? (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Modules disponibles</p>
          <p className="mt-1 text-[12px] text-muted">Ajoutez un module sans jamais perdre ce que vous avez déjà.</p>
          <div className="mt-3 flex flex-col gap-2">
            {upgrades.map((planId) => {
              const plan = ENTITLEMENTS[planId];
              const delta = plan.priceMonthly - entitlements.priceMonthly;
              const savings = bundleSavingsMonthly(planId);
              const isBusy = pending && pendingPlan === planId;
              return (
                <div
                  key={planId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-ink">+ {plan.label}</p>
                    <p className="text-[11.5px] text-muted">
                      {describeUpgrade(currentPlan, planId)}
                      {savings > 0 && ` — bundle : économie de ${savings} €/mois vs les deux modules séparés`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => choosePlan(planId)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-1.5 text-[12px] font-semibold text-ink transition-opacity hover:opacity-90"
                  >
                    {isBusy && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                    )}
                    +{delta} €/mois
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-[12.5px] text-muted">Vous avez déjà tous les modules, au niveau maximum.</p>
        </Card>
      )}

      {isDev && (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Dev — changer de plan directement</p>
          <p className="mt-1 text-[11px] text-faint">
            Modifie réellement <code className="text-[10.5px]">subscriptions.plan</code> en base sans Stripe, pour
            tester n&apos;importe quelle combinaison de modules. Désactivé automatiquement en production.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={currentPlan}
              disabled={pending}
              onChange={(e) => choosePlan(e.target.value as Plan)}
              className="rounded-lg border border-line bg-bg px-3 py-1.5 text-[12.5px] font-medium text-ink"
            >
              {PLAN_ORDER.map((id) => (
                <option key={id} value={id}>
                  {ENTITLEMENTS[id].label}
                </option>
              ))}
            </select>
            {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />}
          </div>
        </Card>
      )}

      <Link href="/tarifs" className="text-[13px] font-semibold text-accent">
        Voir la page tarifs complète (fonctionnalités détaillées) →
      </Link>
    </div>
  );
}
