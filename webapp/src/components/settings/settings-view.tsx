"use client";

import { useActionState } from "react";
import type { BusinessProfile, Subscription } from "@/lib/supabase/types";
import type { QuotaStatus } from "@/lib/quota";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateBusinessProfile, setDevPlan, type SettingsActionState } from "@/lib/actions/settings";
import { ENTITLEMENTS, PLAN_ORDER, type Plan } from "@/lib/entitlements";

export function SettingsView({
  workspaceId,
  businessProfile,
  subscription,
  usage,
  isDev,
}: {
  workspaceId: string;
  businessProfile: BusinessProfile | null;
  subscription: Subscription | null;
  usage: { nova: QuotaStatus; prospects: QuotaStatus; searches: QuotaStatus };
  isDev: boolean;
}) {
  const boundAction = updateBusinessProfile.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(boundAction, {
    error: null,
  });

  const currentPlan: Plan = subscription?.plan ?? "free";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Paramètres</h1>
        <p className="mt-1 text-[13px] text-muted">Entreprise, abonnement et usage.</p>
      </div>

      <Card>
        <h2 className="font-display text-sm font-bold">Entreprise</h2>
        <form action={formAction} className="mt-3 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company_name">Nom de l&apos;entreprise</Label>
              <Input id="company_name" name="company_name" defaultValue={businessProfile?.company_name ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Site web</Label>
              <Input id="website" name="website" defaultValue={businessProfile?.website ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="offer_description">Votre offre</Label>
            <textarea
              id="offer_description"
              name="offer_description"
              rows={3}
              defaultValue={businessProfile?.offer_description ?? ""}
              className="rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
            />
          </div>
          {state.error && <p className="text-[12px] text-red-fg">{state.error}</p>}
          {state.ok && <p className="text-[12px] text-green-fg">Enregistré.</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold">Usage ce mois-ci</h2>
        <p className="mt-1 text-[12px] text-muted">Quotas réels, vérifiés côté serveur à chaque action.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <UsageBar label="Requêtes NOVA" status={usage.nova} />
          <UsageBar label="Prospects ajoutés" status={usage.prospects} />
          <UsageBar label="Recherches" status={usage.searches} />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold">Abonnement</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Paiement en ligne à connecter (Stripe) — aucune carte n&apos;est demandée pour l&apos;instant, votre
          workspace est sur le plan {ENTITLEMENTS[currentPlan].label} par défaut.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = ENTITLEMENTS[planId];
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-xl border p-4",
                  plan.id === currentPlan ? "border-ink bg-soft" : "border-line bg-panel",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[13px] font-extrabold">{plan.label}</span>
                  {plan.id === currentPlan && (
                    <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-bg">ACTUEL</span>
                  )}
                </div>
                <p className="mt-1 font-display text-lg font-extrabold">
                  {plan.priceMonthly === 0 ? "Gratuit" : `${plan.priceMonthly}€/mois`}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-[11.5px] text-muted">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {isDev && (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-soft p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Dev uniquement — désactivé en production
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Changer le plan sans Stripe, pour tester l&apos;application réelle des quotas et fonctionnalités.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLAN_ORDER.map((planId) => (
                <DevPlanButton
                  key={planId}
                  workspaceId={workspaceId}
                  plan={planId}
                  active={planId === currentPlan}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function UsageBar({ label, status }: { label: string; status: QuotaStatus }) {
  const pct = status.limit > 0 ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0;
  return (
    <div className="rounded-lg border border-line bg-soft p-3">
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
        <span>{label}</span>
        <span>
          {status.used} / {status.limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn("h-full rounded-full", status.exceeded ? "bg-red-fg" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DevPlanButton({ workspaceId, plan, active }: { workspaceId: string; plan: Plan; active: boolean }) {
  const boundAction = setDevPlan.bind(null, workspaceId, plan);
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(boundAction, { error: null });
  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" size="sm" disabled={pending || active}>
        {ENTITLEMENTS[plan].label}
      </Button>
      {state.error && <p className="mt-1 text-[10px] text-red-fg">{state.error}</p>}
    </form>
  );
}
