"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import { AddressField, type AddressValue } from "@/components/onboarding/address-field";
import { cn } from "@/lib/utils";
import { saveProspectingConfig } from "@/lib/actions/prospecting";
import { type ProspectionFilters } from "@/lib/prospecting-config";
import { recommendedSlugsForOffer, filterSlugsByAudience } from "@/lib/target-recommendations";
import { getProspectingFilterProfile } from "@/lib/prospecting-filter-profile";
import { ChannelStrategyBanner } from "@/components/prospection/channel-strategy-banner";
import { RETENTION_ALTERNATIVES } from "@/lib/prospecting/channel-strategy";
import { SectionLabel } from "@/components/ui/section-label";
import {
  resolveProspectingObjectives,
  resolveObjectiveTargetSlugs,
  scoringProfileForObjective,
  type SignalConfidence,
} from "@/lib/prospecting/offer-catalog";

const AUTOSAVE_DEBOUNCE_MS = 900;

const CONFIDENCE_ICON: Record<SignalConfidence, string> = { confirmed: "✓", probable: "~", unknown: "?" };
const CONFIDENCE_TITLE: Record<SignalConfidence, string> = {
  confirmed: "Donnée confirmée",
  probable: "Signal probable, jamais garanti",
  unknown: "Donnée inconnue tant que non vérifiée",
};

export interface WizardLaunchParams {
  targetIds: string[];
  address: AddressValue;
  radiusKm: number;
  filters: ProspectionFilters;
  ownSlug: string | null;
  audience: "b2b" | "b2c" | "both";
  scoringProfileOverride: string | null;
}

export function ProspectingWizard({
  workspaceId,
  categories,
  businessProfile,
  defaultTargetIds,
  initialFilters,
  maxRadiusKm,
  planLabel,
  searching,
  onLaunch,
}: {
  workspaceId: string;
  categories: BusinessCategory[];
  businessProfile: BusinessProfile | null;
  defaultTargetIds: string[];
  initialFilters: ProspectionFilters;
  maxRadiusKm: number;
  planLabel: string;
  searching: boolean;
  onLaunch: (params: WizardLaunchParams) => void;
}) {
  const ownCategory = businessProfile?.own_category_id ? categories.find((c) => c.id === businessProfile.own_category_id) : null;
  const parentSlug = ownCategory?.parent_id ? categories.find((c) => c.id === ownCategory.parent_id)?.slug ?? null : null;
  const ownSlug = ownCategory?.slug ?? null;
  const ownLabel = ownCategory?.name ?? businessProfile?.own_category_label ?? null;

  const objectives = useMemo(() => resolveProspectingObjectives(ownSlug, parentSlug), [ownSlug, parentSlug]);

  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  const objective = objectives.find((o) => o.id === objectiveId) ?? null;

  const [freeTextOffer, setFreeTextOffer] = useState(businessProfile?.offer_description ?? "");
  // targetIds dérivées de l'objectif choisi par défaut (jamais une
  // pré-sélection large du catalogue) — un ajustement manuel via "Explorer
  // d'autres secteurs" prend le dessus tant que l'objectif ne change pas.
  const [manualTargetIds, setManualTargetIds] = useState<string[] | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [showAdvancedB2bSearch, setShowAdvancedB2bSearch] = useState(false);

  const [address, setAddress] = useState<AddressValue | null>(
    businessProfile?.lat && businessProfile.lng
      ? {
          street: businessProfile.street,
          postalCode: businessProfile.postal_code,
          city: businessProfile.city,
          lat: businessProfile.lat,
          lng: businessProfile.lng,
          label: [businessProfile.street, businessProfile.postal_code, businessProfile.city].filter(Boolean).join(", "),
        }
      : null,
  );
  const [radiusKm, setRadiusKm] = useState(Math.min(businessProfile?.default_radius_km ?? 20, maxRadiusKm));

  const [operationalOnly, setOperationalOnly] = useState(initialFilters.operationalOnly);
  const [excludeTempClosed, setExcludeTempClosed] = useState(initialFilters.excludeTempClosed);
  const [excludeChains, setExcludeChains] = useState(initialFilters.excludeChains);
  const [excludeAssociations, setExcludeAssociations] = useState(initialFilters.excludeAssociations);
  const [excludeLargeGroups, setExcludeLargeGroups] = useState(initialFilters.excludeLargeGroups);
  const [needContact, setNeedContact] = useState(initialFilters.needContact);
  const [maxEstablishmentsPerSiren, setMaxEstablishmentsPerSiren] = useState(initialFilters.maxEstablishmentsPerSiren);
  const [webFilter, setWebFilter] = useState<ProspectionFilters["webFilter"]>(initialFilters.webFilter);
  const [phoneOnly, setPhoneOnly] = useState(initialFilters.phoneOnly);
  const [googleFicheOnly, setGoogleFicheOnly] = useState(initialFilters.googleFicheOnly);

  const filters: ProspectionFilters = {
    operationalOnly,
    excludeTempClosed,
    excludeChains,
    excludeAssociations,
    excludeLargeGroups,
    needContact,
    maxEstablishmentsPerSiren,
    webFilter,
    phoneOnly,
    googleFicheOnly,
  };

  // Repli générique honnête (objectif "Développer ma clientèle B2B" sans
  // cibles pré-catalogées) : réutilise le moteur existant offre-en-texte-
  // libre plutôt que d'en dupliquer un second, moins précis mais jamais un
  // blocage pour un métier hors catalogue.
  const genericRecommendation = useMemo(
    () => (objective && objective.recommendedFamilySlugs.length === 0 && objective.recommendedLeafSlugs.length === 0 ? recommendedSlugsForOffer(freeTextOffer, ownSlug, categories) : null),
    [objective, freeTextOffer, ownSlug, categories],
  );

  // Cibles recommandées de l'objectif choisi — valeur DÉRIVÉE, jamais une
  // pré-sélection large du catalogue stockée en state : soit les cibles
  // spécifiques de l'objectif, soit (repli générique) celles du moteur
  // offre-en-texte-libre existant, filtrées par audience. Un ajustement
  // manuel (Explorer d'autres secteurs) prend le dessus via manualTargetIds
  // tant que l'objectif ne change pas (voir le bouton objectif ci-dessous).
  const resolvedTargetIds = useMemo(() => {
    if (!objective || objective.audience !== "b2b") return [];
    if (objective.recommendedFamilySlugs.length > 0 || objective.recommendedLeafSlugs.length > 0) {
      const slugs = resolveObjectiveTargetSlugs(objective, categories);
      return categories.filter((c) => slugs.includes(c.slug)).map((c) => c.id);
    }
    if (genericRecommendation) {
      const filteredSlugs = filterSlugsByAudience(genericRecommendation.slugs, categories, "b2b") ?? genericRecommendation.slugs;
      return categories.filter((c) => filteredSlugs.includes(c.slug)).map((c) => c.id);
    }
    return [];
  }, [objective, genericRecommendation, categories]);
  const targetIds = manualTargetIds ?? resolvedTargetIds;

  const webCriteriaRelevant = objective?.showWebSignal ?? getProspectingFilterProfile(freeTextOffer, ownSlug).showWebCriteria;

  // Sauvegarde automatique — même principe que l'ancienne page (jamais de
  // bouton "Enregistrer" à retenir de cliquer), déclenchée par tout
  // changement de la configuration finale (objectif -> offre/audience
  // dérivées, cibles, zone, filtres).
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!address || !objective) return;
    const timeout = setTimeout(() => {
      setSaveStatus("saving");
      void saveProspectingConfig(workspaceId, {
        offerDescription: objective.label || freeTextOffer,
        audience: objective.audience,
        street: address.street,
        postalCode: address.postalCode,
        city: address.city,
        lat: address.lat,
        lng: address.lng,
        radiusKm,
        targetCategoryIds: targetIds,
        filters,
      }).then((result) => setSaveStatus(result.ok ? "saved" : "error"));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective?.id, freeTextOffer, targetIds, address, radiusKm, JSON.stringify(filters)]);

  const targetNames = useMemo(() => categories.filter((c) => targetIds.includes(c.id)).map((c) => c.name), [categories, targetIds]);

  const searchFlowVisible = !objective || objective.audience === "b2b" || showAdvancedB2bSearch;
  const canLaunch = Boolean(objective && address && targetIds.length > 0);

  function launch() {
    if (!objective || !address) return;
    onLaunch({
      targetIds,
      address,
      radiusKm,
      filters,
      ownSlug,
      audience: objective.audience,
      scoringProfileOverride: scoringProfileForObjective(objective),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionLabel>Votre entreprise</SectionLabel>
        <p className="mt-2 text-[14px] font-semibold text-ink">
          {ownLabel ?? "Métier non renseigné"}
          {!ownLabel && (
            <Link href="/parametres" className="ml-2 text-[12px] font-semibold text-accent">
              Renseigner mon métier →
            </Link>
          )}
        </p>
      </Card>

      <Card>
        <SectionLabel>Que souhaitez-vous développer ?</SectionLabel>
        {defaultTargetIds.length > 0 && !objectiveId && (
          <p className="mt-2 rounded-lg bg-soft px-2.5 py-1.5 text-[11px] text-faint">
            Une configuration précédente incluait {defaultTargetIds.length} métier(s) sélectionné(s) — non appliquée
            automatiquement. Choisissez un objectif ci-dessous, ou{" "}
            <button type="button" className="font-semibold text-accent underline" onClick={() => setManualTargetIds(defaultTargetIds)}>
              reprendre cette sélection
            </button>
            .
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {objectives.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setObjectiveId(o.id);
                setManualTargetIds(null);
                setShowAdvancedB2bSearch(false);
              }}
              className={cn(
                "rounded-full border px-3.5 py-2 text-[13px] font-medium transition",
                objectiveId === o.id ? "border-ink bg-ink text-bg shadow-sm" : "border-line bg-panel text-ink hover:border-ink/30 hover:bg-soft",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Card>

      {objective && objective.audience === "b2c" && (
        <>
          <ChannelStrategyBanner
            strategy={{
              channel: "b2c_not_registry",
              headline: "Cette offre s'adresse principalement aux particuliers",
              explanation: "Une recherche d'entreprises dans le registre officiel n'est probablement pas votre meilleur canal pour ce type de clientèle.",
              alternatives: RETENTION_ALTERNATIVES,
            }}
          />
          {!showAdvancedB2bSearch && (
            <button
              type="button"
              onClick={() => setShowAdvancedB2bSearch(true)}
              className="self-start text-[12px] font-semibold text-muted underline decoration-dotted hover:text-ink"
            >
              Cas particulier : utiliser quand même la recherche dans le registre d&apos;entreprises →
            </button>
          )}
        </>
      )}

      {objective && searchFlowVisible && (
        <Card className="border-accent/30 bg-accent/[0.04]">
          <SectionLabel>Stratégie recommandée</SectionLabel>
          <p className="mt-2 font-display text-[15px] font-extrabold text-ink">{objective.label}</p>
          {objective.strategyExplanation && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{objective.strategyExplanation}</p>}

          {genericRecommendation && !genericRecommendation.basedOnOffer && (
            <div className="mt-3">
              <label className="text-[11px] font-semibold text-muted">Précisez votre offre pour affiner les cibles</label>
              <textarea
                value={freeTextOffer}
                onChange={(e) => setFreeTextOffer(e.target.value)}
                rows={2}
                placeholder="Ex. Fourniture de matériel électrique pour professionnels du bâtiment."
                className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
              />
            </div>
          )}

          {targetNames.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Cibles prioritaires</p>
              <p className="mt-1 text-[13px] text-ink">{targetNames.join(" · ")}</p>
            </div>
          )}

          <div className="mt-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Zone</p>
            <p className="mt-1 text-[13px] text-ink">
              {radiusKm} km {address?.city ? `autour de ${address.city}` : "— adresse à renseigner"}
            </p>
          </div>

          {objective.signals.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Signaux</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {objective.signals.map((s) => (
                  <li key={s.id} className="flex items-start gap-1.5 text-[12.5px] text-ink">
                    <span className="mt-0.5 text-faint" title={CONFIDENCE_TITLE[s.confidence]}>
                      {CONFIDENCE_ICON[s.confidence]}
                    </span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {webCriteriaRelevant && (
            <div className="mt-3">
              <label className="text-[11px] font-semibold text-muted">Signal à privilégier</label>
              <select
                value={webFilter}
                onChange={(e) => setWebFilter(e.target.value as typeof webFilter)}
                className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
              >
                <option value="all">Tous les statuts web</option>
                <option value="no_or_weak">Aucun site détecté + site faible</option>
                <option value="none">Aucun site détecté uniquement</option>
                <option value="weak">Site existant à analyser uniquement</option>
                <option value="unknown">À vérifier uniquement</option>
              </select>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={launch} disabled={!canLaunch || searching}>
              {searching ? "Recherche…" : "Lancer la recherche"}
            </Button>
            <Button variant="ghost" onClick={() => setObjectiveId(null)}>
              Modifier l&apos;objectif
            </Button>
            <Button variant="ghost" onClick={() => setRefineOpen((v) => !v)}>
              {refineOpen ? "Masquer affiner" : "Affiner"}
            </Button>
          </div>

          {refineOpen && (
            <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
              <div>
                <label className="text-[11px] font-semibold text-muted">Adresse de départ</label>
                <div className="mt-1.5">
                  <AddressField value={address} onChange={setAddress} />
                </div>
                <label className="mt-3 block text-[11px] font-semibold text-muted">Rayon : {radiusKm} km</label>
                <input
                  type="range"
                  min={0.5}
                  max={maxRadiusKm}
                  step={0.5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Math.min(Number(e.target.value), maxRadiusKm))}
                  className="w-full"
                />
                <p className="mt-1 text-[11px] text-faint">Votre forfait {planLabel} permet jusqu&apos;à {maxRadiusKm} km.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <FilterCheck label="Écarter fermés" checked={operationalOnly} onChange={setOperationalOnly} />
                <FilterCheck label="Écarter fermés temp." checked={excludeTempClosed} onChange={setExcludeTempClosed} />
                <FilterCheck label="Écarter chaînes" checked={excludeChains} onChange={setExcludeChains} />
                <FilterCheck label="Écarter associations" checked={excludeAssociations} onChange={setExcludeAssociations} />
                <FilterCheck label="Écarter gros groupes" checked={excludeLargeGroups} onChange={setExcludeLargeGroups} />
                <FilterCheck label="Contact en priorité" checked={needContact} onChange={setNeedContact} />
                <FilterCheck label="Téléphone disponible" checked={phoneOnly} onChange={setPhoneOnly} />
                <FilterCheck label="Fiche Google disponible" checked={googleFicheOnly} onChange={setGoogleFicheOnly} />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted">Max établissements / SIREN</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxEstablishmentsPerSiren}
                  onChange={(e) => setMaxEstablishmentsPerSiren(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
                />
              </div>

              <div>
                <button type="button" onClick={() => setExploreOpen((v) => !v)} className="text-[12.5px] font-semibold text-accent hover:underline">
                  {exploreOpen ? "▾" : "▸"} Explorer d&apos;autres secteurs
                </button>
                {exploreOpen && (
                  <div className="mt-3">
                    <TargetCategoryPicker categories={categories} value={targetIds} onChange={setManualTargetIds} />
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="mt-3 text-[10.5px] text-faint">
            {saveStatus === "saving" && "Enregistrement…"}
            {saveStatus === "saved" && "✓ Configuration enregistrée"}
            {saveStatus === "error" && "⚠ Échec de l'enregistrement"}
          </p>
        </Card>
      )}
    </div>
  );
}

function FilterCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-line bg-soft px-2.5 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
