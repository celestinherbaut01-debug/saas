"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import { AddressField, type AddressValue } from "@/components/onboarding/address-field";
import { OwnActivityEditor } from "@/components/prospection/own-activity-editor";
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

// Icône par famille d'objectif — dérivée du préfixe de l'id (garage_, web_,
// cleaning_...), pas du catalogue lui-même : évite de retoucher les ~38
// définitions d'objectifs pour un simple habillage visuel des chips.
const OBJECTIVE_ICON_PREFIXES: [string, string][] = [
  ["garage_", "🔧"],
  ["web_", "🌐"],
  ["marketing_", "📣"],
  ["cleaning_", "🧹"],
  ["restaurant_", "🍽"],
  ["salon_", "💇"],
  ["artisan_", "🛠"],
  ["realestate_", "🏠"],
  ["supplier_", "📦"],
  ["generic_", "✨"],
];
function objectiveIcon(id: string): string {
  return OBJECTIVE_ICON_PREFIXES.find(([prefix]) => id.startsWith(prefix))?.[1] ?? "🎯";
}

const WEB_SIGNAL_CARDS: { id: string; icon: string; title: string; description: string; webFilter: ProspectionFilters["webFilter"] }[] = [
  { id: "no_website", icon: "🌐", title: "Aucun site détecté", description: "Entreprises pour lesquelles aucun site n'a été identifié.", webFilter: "none" },
  { id: "weak_website", icon: "⚠️", title: "Site à analyser", description: "Entreprises possédant un site pouvant nécessiter une refonte.", webFilter: "weak" },
  { id: "gmb_no_site", icon: "📍", title: "Fiche Google active", description: "Présence locale existante mais présence web à compléter.", webFilter: "unknown" },
  { id: "all", icon: "✨", title: "Tous les statuts", description: "Ne filtrer sur aucun statut de site en particulier.", webFilter: "all" },
];

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
  // Métier modifiable EN PLACE (voir OwnActivityEditor) — état local, jamais
  // figé depuis le rendu serveur initial : changer d'activité doit
  // recalculer objectifs/cibles/signaux IMMÉDIATEMENT, sans recharger la
  // page ni refaire l'onboarding.
  const [ownCategoryId, setOwnCategoryId] = useState<string | null>(businessProfile?.own_category_id ?? null);
  const [ownCategoryLabel, setOwnCategoryLabel] = useState<string | null>(businessProfile?.own_category_label ?? null);
  const ownCategory = ownCategoryId ? categories.find((c) => c.id === ownCategoryId) : null;
  const parentSlug = ownCategory?.parent_id ? categories.find((c) => c.id === ownCategory.parent_id)?.slug ?? null : null;
  const ownSlug = ownCategory?.slug ?? null;

  const objectives = useMemo(() => resolveProspectingObjectives(ownSlug, parentSlug), [ownSlug, parentSlug]);

  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  const objective = objectives.find((o) => o.id === objectiveId) ?? null;

  const [freeTextOffer, setFreeTextOffer] = useState(businessProfile?.offer_description ?? "");
  // Chips recommandés SÉLECTIONNÉS pour l'objectif courant — tous cochés
  // par défaut (voir offer-catalog.ts), désélectionnables individuellement.
  // `null` = "tous" (évite de devoir lister tous les ids au choix de
  // l'objectif).
  const [selectedChipIds, setSelectedChipIds] = useState<Set<string> | null>(null);
  const [manualTargetIds, setManualTargetIds] = useState<string[] | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [showAdvancedB2bSearch, setShowAdvancedB2bSearch] = useState(false);

  /** Change d'activité : repart de zéro sur objectif/cibles/offre libre — aucun résidu de l'ancien métier ne doit survivre (test bloquant). */
  function changeActivity(categoryId: string | null, label: string | null) {
    setOwnCategoryId(categoryId);
    setOwnCategoryLabel(label);
    setObjectiveId(null);
    setSelectedChipIds(null);
    setManualTargetIds(null);
    setFreeTextOffer("");
    setShowAdvancedB2bSearch(false);
  }

  function selectObjective(id: string) {
    setObjectiveId(id);
    setSelectedChipIds(null);
    setManualTargetIds(null);
    setShowAdvancedB2bSearch(false);
  }

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

  // Repli générique honnête (objectif sans chips pré-catalogués) : réutilise
  // le moteur existant offre-en-texte-libre plutôt que d'en dupliquer un
  // second, moins précis mais jamais un blocage pour un métier hors catalogue.
  const genericRecommendation = useMemo(
    () => (objective && objective.recommendations.length === 0 ? recommendedSlugsForOffer(freeTextOffer, ownSlug, categories) : null),
    [objective, freeTextOffer, ownSlug, categories],
  );

  const effectiveChipIds = useMemo(() => selectedChipIds ?? new Set(objective?.recommendations.map((c) => c.id) ?? []), [selectedChipIds, objective]);

  // Cibles recommandées — valeur DÉRIVÉE, jamais une pré-sélection large du
  // catalogue stockée en state. Un ajustement manuel (Explorer d'autres
  // secteurs) prend le dessus tant que l'objectif ne change pas.
  const resolvedTargetIds = useMemo(() => {
    if (!objective || objective.audience !== "b2b") return [];
    if (objective.recommendations.length > 0) {
      const slugs = resolveObjectiveTargetSlugs(objective, effectiveChipIds);
      return categories.filter((c) => slugs.includes(c.slug)).map((c) => c.id);
    }
    if (genericRecommendation) {
      const filteredSlugs = filterSlugsByAudience(genericRecommendation.slugs, categories, "b2b") ?? genericRecommendation.slugs;
      return categories.filter((c) => filteredSlugs.includes(c.slug)).map((c) => c.id);
    }
    return [];
  }, [objective, effectiveChipIds, genericRecommendation, categories]);
  const targetIds = manualTargetIds ?? resolvedTargetIds;

  function toggleChip(chipId: string) {
    setSelectedChipIds(new Set([...effectiveChipIds].includes(chipId) ? [...effectiveChipIds].filter((id) => id !== chipId) : [...effectiveChipIds, chipId]));
    setManualTargetIds(null);
  }

  // Sauvegarde automatique — même principe que l'ancienne page (jamais de
  // bouton "Enregistrer" à retenir de cliquer), déclenchée par tout
  // changement de la configuration finale (activité, objectif -> offre/
  // audience dérivées, cibles, zone, filtres).
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
  }, [ownCategoryId, objective?.id, freeTextOffer, targetIds, address, radiusKm, JSON.stringify(filters)]);

  // Repli honnête pour un métier hors catalogue (objectifs génériques) :
  // le signal web reste pertinent si l'offre en texte libre en parle,
  // même sans showWebSignal explicite (réservé aux objectifs catalogués).
  const showWebSignal = objective?.showWebSignal || Boolean(genericRecommendation && getProspectingFilterProfile(freeTextOffer, ownSlug).showWebCriteria);

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
    <div className="flex flex-col gap-4">
      <Card className="bg-gradient-to-br from-panel to-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-[17px] font-extrabold text-ink">Prospection intelligente</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Trouvez les entreprises qui ont réellement besoin de ce que vous vendez.</p>
          </div>
          <OwnActivityEditor
            workspaceId={workspaceId}
            categories={categories}
            ownCategoryId={ownCategoryId}
            ownCategoryLabel={ownCategoryLabel}
            onChange={changeActivity}
          />
        </div>
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
          {objectives.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => selectObjective(o.id)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={cn(
                "animate-fade-up flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition hover:-translate-y-0.5",
                objectiveId === o.id
                  ? "border-transparent bg-[image:var(--gradient-signature)] text-accent-ink shadow-[var(--shadow-sm),var(--glow-accent)]"
                  : "border-line bg-panel text-ink hover:border-accent/30 hover:bg-soft",
              )}
            >
              <span aria-hidden>{objectiveIcon(o.id)}</span>
              {o.label}
            </button>
          ))}
        </div>
      </Card>

      {objective && objective.audience === "b2c" && (
        <div className="animate-fade-up flex flex-col gap-2">
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
        </div>
      )}

      {objective && searchFlowVisible && (
        <Card className="animate-fade-up border-accent/30 bg-gradient-to-br from-accent/[0.05] to-transparent">
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

          {showWebSignal && <WebSignalCards value={webFilter} onChange={setWebFilter} />}

          {objective.recommendations.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">
                ProspectFlow recommande — {objective.recommendations.length} secteur{objective.recommendations.length > 1 ? "s" : ""} pertinent
                {objective.recommendations.length > 1 ? "s" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {objective.recommendations.map((chip) => {
                  const isSelected = effectiveChipIds.has(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => toggleChip(chip.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition hover:-translate-y-0.5",
                        isSelected
                          ? "border-accent/40 bg-accent/10 text-ink shadow-[var(--shadow-sm)]"
                          : "border-line bg-panel text-faint line-through opacity-60 hover:opacity-100",
                      )}
                    >
                      <span>{chip.icon}</span>
                      <span>{chip.label}</span>
                      {isSelected && <span className="text-accent">✓</span>}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setExploreOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-[12.5px] font-semibold text-accent hover:border-accent/40 hover:bg-accent/5"
                >
                  {exploreOpen ? "▾" : "＋"} Explorer d&apos;autres secteurs
                </button>
              </div>
              {exploreOpen && (
                <div className="animate-fade-up mt-3 rounded-xl border border-line bg-soft p-3">
                  <TargetCategoryPicker categories={categories} value={targetIds} onChange={setManualTargetIds} />
                </div>
              )}
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={launch} disabled={!canLaunch || searching}>
              {searching ? "Recherche…" : "Trouver mes prospects →"}
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

              {objective.recommendations.length === 0 && (
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
              )}
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

function WebSignalCards({ value, onChange }: { value: ProspectionFilters["webFilter"]; onChange: (v: ProspectionFilters["webFilter"]) => void }) {
  return (
    <div className="mt-3">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Quel type d&apos;opportunité recherchez-vous ?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {WEB_SIGNAL_CARDS.map((card) => {
          const isSelected = value === card.webFilter;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onChange(card.webFilter)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                isSelected ? "border-accent/50 bg-accent/[0.06] shadow-[var(--shadow-sm)]" : "border-line bg-panel hover:border-accent/25 hover:bg-soft",
              )}
            >
              <span className="text-[18px]">{card.icon}</span>
              <span>
                <span className="block text-[12.5px] font-bold text-ink">{card.title}</span>
                <span className="block text-[11px] text-muted">{card.description}</span>
              </span>
            </button>
          );
        })}
      </div>
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
