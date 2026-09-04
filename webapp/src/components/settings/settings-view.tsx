"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { BusinessProfile, Subscription } from "@/lib/supabase/types";
import type { QuotaStatus } from "@/lib/quota";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateBusinessProfile, type SettingsActionState } from "@/lib/actions/settings";
import { DevPlanSwitcher } from "@/components/settings/dev-plan-switcher";
import { ENTITLEMENTS, type Plan } from "@/lib/entitlements";

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
  const [showManage, setShowManage] = useState(false);

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Plan actuel</p>
            <p className="mt-1 font-display text-xl font-extrabold">{ENTITLEMENTS[currentPlan].label}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              {ENTITLEMENTS[currentPlan].priceMonthly === 0
                ? "Gratuit"
                : `${ENTITLEMENTS[currentPlan].priceMonthly} €/mois`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => isDev && setShowManage((v) => !v)}
            disabled={!isDev}
            title={isDev ? undefined : "Paiement Stripe pas encore branché — bientôt disponible."}
          >
            Gérer mon abonnement
          </Button>
        </div>

        {!isDev && (
          <p className="mt-2 text-[11.5px] text-faint">
            Le paiement en ligne (Stripe) n&apos;est pas encore branché — aucune carte n&apos;est demandée pour
            l&apos;instant.
          </p>
        )}
        {isDev && showManage && (
          <div className="mt-3">
            <DevPlanSwitcher workspaceId={workspaceId} currentPlan={currentPlan} />
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <h2 className="text-[12px] font-bold text-ink">Usage du mois</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <UsageBar label="Prospects" status={usage.prospects} />
            <UsageBar label="Recherches" status={usage.searches} />
            <UsageBar label="NOVA" status={usage.nova} />
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <Link href="/tarifs" className="text-[13px] font-semibold text-accent">
            Voir tous les forfaits →
          </Link>
        </div>
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
