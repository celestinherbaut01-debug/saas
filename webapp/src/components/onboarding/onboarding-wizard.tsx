"use client";

import { useMemo, useState, useTransition } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryCombobox } from "@/components/onboarding/category-combobox";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import { AddressField, type AddressValue } from "@/components/onboarding/address-field";
import { completeOnboarding } from "@/lib/actions/onboarding";

const STEPS = ["Entreprise", "Votre métier", "Vos cibles", "Zone de prospection", "Vérification"] as const;

/**
 * Recommandations heuristiques métier -> cibles, par slug de business_categories.
 * Volontairement simple pour la Phase 1 (pas d'IA) — affiné plus tard avec un
 * vrai moteur de recommandation basé sur l'offre décrite en texte libre.
 */
const RECOMMENDATIONS: Record<string, string[]> = {
  web: ["restaurants", "garages", "hair", "realestate", "dentists"],
  it: ["restaurants", "garages", "hair", "realestate"],
  marketing: ["restaurants", "hair", "beauty", "realestate"],
  design: ["restaurants", "hair", "beauty"],
  photo: ["hair", "beauty", "realestate"],
  cleaning: ["hotels", "gyms", "realestate", "dentists"],
  security: ["realestate", "supermarkets"],
  accounting: ["restaurants", "garages", "hair", "realestate"],
  law: ["realestate", "dealers"],
  consulting: ["realestate", "accounting"],
  insurance: ["realestate", "garages"],
};

export function OnboardingWizard({ categories }: { categories: BusinessCategory[] }) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [devDetail, setDevDetail] = useState<string | undefined>(undefined);

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState<"b2b" | "b2c" | "both">("both");

  const [ownCategoryId, setOwnCategoryId] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);

  const [address, setAddress] = useState<AddressValue | null>(null);
  const [radiusKm, setRadiusKm] = useState(20);

  const ownSlug = categories.find((c) => c.id === ownCategoryId)?.slug ?? null;
  const recommendedSlugs = ownSlug ? RECOMMENDATIONS[ownSlug] : undefined;

  const canNext = useMemo(() => {
    if (step === 0) return companyName.trim().length > 0 && offer.trim().length > 0;
    if (step === 1) return true; // optionnel
    if (step === 2) return targetIds.length > 0;
    if (step === 3) return address !== null;
    return true;
  }, [step, companyName, offer, targetIds, address]);

  function submit() {
    setError(null);
    setDevDetail(undefined);
    startTransition(async () => {
      const result = await completeOnboarding({
        companyName,
        website,
        offerDescription: offer,
        audience,
        ownCategoryId,
        address: address
          ? { street: address.street, postalCode: address.postalCode, city: address.city, lat: address.lat, lng: address.lng }
          : null,
        radiusKm,
        targetCategoryIds: targetIds,
      });
      // En cas d'erreur : on reste sur cette même étape (pas de retour à
      // l'étape 1), rien n'est réinitialisé — toutes les données saisies
      // (entreprise, offre, métier, cibles, zone, rayon) restent dans le
      // state du composant, prêtes pour un nouvel essai.
      if (result?.error) {
        setError(result.error);
        setDevDetail(result.devDetail);
        return;
      }
      // Navigation complète (pas router.push) : garantit que proxy.ts
      // s'exécute contre une requête neuve, sans dépendre d'un éventuel
      // cache de routage côté client qui renverrait sur /onboarding.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/dashboard";
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                i <= step ? "bg-ink text-bg" : "bg-soft text-faint"
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-ink" : "bg-line"}`} />}
          </div>
        ))}
      </div>

      <Card className="shadow-sm">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h1 className="mt-1 font-display text-[21px] font-extrabold tracking-tight text-ink">{STEPS[step]}</h1>

        {step === 0 && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="The North Company" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Site web (optionnel)</Label>
              <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer">Que vendez-vous ?</Label>
              <textarea
                id="offer"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                rows={3}
                placeholder="Ex. Création de sites vitrines premium pour les entreprises locales."
                className="rounded-lg border border-line bg-soft px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Vous vendez à…</Label>
              <div className="flex gap-2">
                {(["b2b", "b2c", "both"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] ${
                      audience === a ? "border-ink bg-ink text-bg" : "border-line bg-panel text-ink"
                    }`}
                  >
                    {a === "b2b" ? "Entreprises (B2B)" : a === "b2c" ? "Particuliers (B2C)" : "Les deux"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Votre métier — distinct des métiers que vous allez démarcher à l&apos;étape suivante.
            </p>
            <CategoryCombobox categories={categories} value={ownCategoryId} onChange={setOwnCategoryId} />
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <TargetCategoryPicker
              categories={categories}
              value={targetIds}
              onChange={setTargetIds}
              recommendedSlugs={recommendedSlugs}
            />
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Adresse de départ exacte</Label>
              <AddressField value={address} onChange={setAddress} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Rayon de prospection : {radiusKm} km</Label>
              <input
                type="range"
                min={0.5}
                max={250}
                step={0.5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-4 flex flex-col gap-3 text-[13px]">
            <Row label="Entreprise" value={companyName} />
            <Row label="Offre" value={offer} />
            <Row label="Votre métier" value={categories.find((c) => c.id === ownCategoryId)?.name ?? "Non précisé"} />
            <Row
              label="Cibles"
              value={targetIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(", ")}
            />
            <Row label="Zone" value={address ? `${address.label} — ${radiusKm} km` : "—"} />
            {error && (
              <div className="rounded-lg bg-red-bg px-3 py-2.5">
                <p className="text-[12.5px] text-red-fg">{error}</p>
                {devDetail && (
                  <p className="mt-1.5 font-mono text-[10.5px] text-red-fg/70">Détail technique (dev) : {devDetail}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Retour
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continuer
            </Button>
          ) : (
            <Button type="button" disabled={pending} onClick={submit} className="flex items-center gap-2">
              {pending && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg/40 border-t-bg" />
              )}
              {pending
                ? "Configuration de votre espace…"
                : error
                  ? "Réessayer"
                  : "Trouver mes premiers prospects"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2">
      <span className="text-faint">{label}</span>
      <span className="text-right font-medium text-ink">{value || "—"}</span>
    </div>
  );
}
