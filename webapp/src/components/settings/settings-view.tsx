"use client";

import { useActionState } from "react";
import type { BusinessProfile, Subscription } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateBusinessProfile, type SettingsActionState } from "@/lib/actions/settings";

const PLANS: { id: "starter" | "pro" | "max"; name: string; price: string; features: string[] }[] = [
  {
    id: "starter",
    name: "Starter",
    price: "59€/mois",
    features: [
      "Recherche + vérification de prospects",
      "CRM manuel",
      "500 prospects/mois",
      "IA pour rédiger un email (validation manuelle)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "129€/mois",
    features: [
      "Tout Starter",
      "Envoi Gmail automatique + relances",
      "Lecture et classification des réponses",
      "CRM mis à jour automatiquement",
      "2 000 prospects/mois",
    ],
  },
  {
    id: "max",
    name: "Max",
    price: "249€/mois",
    features: [
      "Tout Pro",
      "Business OS adapté à votre métier",
      "Équipe (plusieurs utilisateurs)",
      "Agent IA Autopilot",
      "5 000+ prospects/mois",
    ],
  },
];

export function SettingsView({
  workspaceId,
  businessProfile,
  subscription,
}: {
  workspaceId: string;
  businessProfile: BusinessProfile | null;
  subscription: Subscription | null;
}) {
  const boundAction = updateBusinessProfile.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(boundAction, {
    error: null,
  });

  const currentPlan = subscription?.plan ?? "starter";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Paramètres</h1>
        <p className="mt-1 text-[13px] text-muted">Entreprise et abonnement.</p>
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
        <h2 className="font-display text-sm font-bold">Abonnement</h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Paiement en ligne à connecter (Stripe) — aucune carte n&apos;est demandée pour l&apos;instant, votre
          workspace est sur le plan {PLANS.find((p) => p.id === currentPlan)?.name} par défaut.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "rounded-xl border p-4",
                plan.id === currentPlan ? "border-ink bg-soft" : "border-line bg-panel",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[13px] font-extrabold">{plan.name}</span>
                {plan.id === currentPlan && (
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-bg">ACTUEL</span>
                )}
              </div>
              <p className="mt-1 font-display text-lg font-extrabold">{plan.price}</p>
              <ul className="mt-2 flex flex-col gap-1 text-[11.5px] text-muted">
                {plan.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
