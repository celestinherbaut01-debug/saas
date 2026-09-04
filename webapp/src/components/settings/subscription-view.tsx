"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { QuotaStatus } from "@/lib/quota";
import { Card } from "@/components/ui/card";
import { UsageBar } from "@/components/ui/usage-bar";
import { cn } from "@/lib/utils";
import { setDevPlan } from "@/lib/actions/settings";
import { ENTITLEMENTS, PLAN_ORDER, type Plan } from "@/lib/entitlements";

export function SubscriptionView({
  workspaceId,
  currentPlan,
  usage,
  isDev,
}: {
  workspaceId: string;
  currentPlan: Plan;
  usage: { nova: QuotaStatus; prospects: QuotaStatus; searches: QuotaStatus };
  isDev: boolean;
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Abonnement</h1>
        <p className="mt-1 text-[13px] text-muted">Votre forfait, votre usage, et les mises à niveau possibles.</p>
      </div>

      <Card className="bg-gradient-to-br from-panel to-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Plan actuel</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{entitlements.label}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {entitlements.priceMonthly === 0 ? "Gratuit" : `${entitlements.priceMonthly} €/mois`} — rayon de
              prospection jusqu&apos;à {entitlements.maxRadiusKm} km
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Paiement Stripe pas encore branché — bientôt disponible. Utilisez les cartes ci-dessous pour changer de plan en développement."
            className="cursor-not-allowed rounded-lg border border-line bg-bg px-3.5 py-2 text-[12.5px] font-semibold text-faint"
          >
            Gérer mon abonnement (Stripe)
          </button>
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
          Le paiement en ligne (Stripe) n&apos;est pas encore branché en production — les mises à niveau ci-dessous
          sont désactivées ici et renverront une erreur explicite si vous forcez l&apos;appel.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const plan = ENTITLEMENTS[planId];
          const isCurrent = planId === currentPlan;
          const isBusy = pending && pendingPlan === planId;
          return (
            <Card
              key={planId}
              className={cn(
                "flex flex-col",
                isCurrent && "border-accent/50 ring-2 ring-accent/20",
                plan.highlighted && !isCurrent && "border-accent/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[15px] font-extrabold">{plan.label}</h3>
                {plan.highlighted && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-bold text-accent-ink">
                    Populaire
                  </span>
                )}
              </div>
              <p className="mt-2 font-display text-[22px] font-extrabold">
                {plan.priceMonthly === 0 ? "0 €" : `${plan.priceMonthly} €`}
                {plan.priceMonthly > 0 && <span className="text-[11px] font-medium text-faint">/mois</span>}
              </p>
              <ul className="mt-3 flex flex-1 flex-col gap-1.5 text-[11.5px] leading-relaxed text-muted">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-accent">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isCurrent || pending}
                onClick={() => choosePlan(planId)}
                className={cn(
                  "mt-4 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-opacity",
                  isCurrent
                    ? "cursor-default bg-soft text-faint"
                    : plan.highlighted
                      ? "bg-accent text-accent-ink hover:opacity-90"
                      : "border border-line bg-bg text-ink hover:opacity-90",
                )}
              >
                {isBusy && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                )}
                {isCurrent ? "Plan actuel" : `Passer à ${plan.label}`}
              </button>
            </Card>
          );
        })}
      </div>

      {isDev && (
        <p className="text-[11px] text-faint">
          Dev uniquement : ces boutons changent réellement <code className="text-[10.5px]">workspaces.plan</code>{" "}
          en base sans Stripe, pour vérifier quotas / rayon / Business OS à chaque forfait. Désactivé
          automatiquement en production.
        </p>
      )}

      <Link href="/tarifs" className="text-[13px] font-semibold text-accent">
        Voir la page tarifs complète (fonctionnalités détaillées) →
      </Link>
    </div>
  );
}
