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
import { recommendedSlugsFor, filterSlugsByAudience } from "@/lib/target-recommendations";
import { PRODUCT_MODE_OPTIONS, type ProductMode } from "@/lib/product-mode";
import { cn } from "@/lib/utils";

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
  const [productMode, setProductMode] = useState<ProductMode>("both");
  const [targetIds, setTargetIds] = useState<string[]>([]);

  const [address, setAddress] = useState<AddressValue | null>(null);
  const [showAllTargets, setShowAllTargets] = useState(false);

  // "Gérer mon entreprise" uniquement : pas la peine de choisir des cibles
  // de prospection qu'on ne va pas utiliser — voir spec produit §12.
  const needsTargets = productMode !== "business_os";
  const STEPS = needsTargets
    ? (["Entreprise", "Votre métier", "Votre objectif", "Vos cibles", "Localisation"] as const)
    : (["Entreprise", "Votre métier", "Votre objectif", "Localisation"] as const);
  const stepName = STEPS[step];

  const ownSlug = categories.find((c) => c.id === ownCategoryId)?.slug ?? null;
  const recommendedSlugs = filterSlugsByAudience(recommendedSlugsFor(ownSlug), categories, audience);

  const targetNames = useMemo(
    () => targetIds.map((id) => categories.find((c) => c.id === id)?.name).filter((n): n is string => Boolean(n)),
    [targetIds, categories],
  );
  const visibleTargetNames = showAllTargets ? targetNames : targetNames.slice(0, 6);
  const hiddenTargetCount = targetNames.length - visibleTargetNames.length;

  const canNext = useMemo(() => {
    if (stepName === "Entreprise") return companyName.trim().length > 0 && offer.trim().length > 0;
    if (stepName === "Votre métier") return true; // optionnel
    if (stepName === "Votre objectif") return true; // "both" présélectionné
    if (stepName === "Vos cibles") return targetIds.length > 0;
    return true;
  }, [stepName, companyName, offer, targetIds]);

  const canSubmit = address !== null;

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
        targetCategoryIds: targetIds,
        productMode,
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
        <h1 className="mt-1 font-display text-[21px] font-extrabold tracking-tight text-ink">{stepName}</h1>

        {stepName === "Entreprise" && (
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

        {stepName === "Votre métier" && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Votre métier — distinct des métiers que vous allez démarcher à l&apos;étape suivante.
            </p>
            <CategoryCombobox categories={categories} value={ownCategoryId} onChange={setOwnCategoryId} />
          </div>
        )}

        {stepName === "Votre objectif" && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] text-muted">Que souhaitez-vous faire avec ProspectFlow ?</p>
            <div className="grid gap-2 sm:grid-cols-1">
              {PRODUCT_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProductMode(opt.value)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition-colors",
                    productMode === opt.value ? "border-ink bg-ink text-bg" : "border-line bg-panel hover:bg-soft",
                  )}
                >
                  <p className="text-[14px] font-bold">{opt.label}</p>
                  <p className={cn("mt-0.5 text-[12px]", productMode === opt.value ? "text-bg/70" : "text-muted")}>{opt.desc}</p>
                </button>
              ))}
            </div>
            {!needsTargets && (
              <p className="text-[11.5px] text-faint">
                Pas de souci — la prospection reste disponible en option à tout moment (Paramètres, ou directement
                depuis Business OS).
              </p>
            )}
          </div>
        )}

        {stepName === "Vos cibles" && (
          <div className="mt-4">
            <TargetCategoryPicker
              categories={categories}
              value={targetIds}
              onChange={setTargetIds}
              recommendedSlugs={recommendedSlugs}
            />
          </div>
        )}

        {stepName === "Localisation" && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Adresse de départ exacte</Label>
              <AddressField value={address} onChange={setAddress} />
              <p className="text-[11.5px] text-faint">
                Le rayon de prospection se règle directement dans Prospection, selon votre forfait.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-soft px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                Récapitulatif — {companyName || "Entreprise sans nom"}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                {categories.find((c) => c.id === ownCategoryId)?.name ?? "Métier non précisé"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {!needsTargets && <span className="text-[11.5px] text-faint">Prospection non activée pour l&apos;instant.</span>}
                {visibleTargetNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] text-ink"
                  >
                    {name}
                  </span>
                ))}
                {hiddenTargetCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTargets(true)}
                    className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-accent"
                  >
                    +{hiddenTargetCount} autres — voir toutes les cibles
                  </button>
                )}
                {showAllTargets && targetNames.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTargets(false)}
                    className="text-[11px] font-medium text-faint underline"
                  >
                    Réduire
                  </button>
                )}
              </div>
            </div>

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
            <Button type="button" disabled={pending || !canSubmit} onClick={submit} className="flex items-center gap-2">
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
