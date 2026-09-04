"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateBusinessProfile, type SettingsActionState } from "@/lib/actions/settings";

export function SettingsView({
  workspaceId,
  businessProfile,
}: {
  workspaceId: string;
  businessProfile: BusinessProfile | null;
}) {
  const boundAction = updateBusinessProfile.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(boundAction, {
    error: null,
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Paramètres</h1>
        <p className="mt-1 text-[13px] text-muted">Informations de votre entreprise.</p>
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

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold">Abonnement & usage</h2>
          <p className="mt-1 text-[12.5px] text-muted">Plan actuel, quotas du mois et mises à niveau.</p>
        </div>
        <Link
          href="/abonnement"
          className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-bg"
        >
          Voir mon abonnement →
        </Link>
      </Card>
    </div>
  );
}
