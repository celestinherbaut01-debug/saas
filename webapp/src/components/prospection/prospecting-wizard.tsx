"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import {
  AddressField,
  type AddressValue,
} from "@/components/onboarding/address-field";
import { OwnActivityEditor } from "@/components/prospection/own-activity-editor";
import { cn } from "@/lib/utils";
import { saveProspectingConfig } from "@/lib/actions/prospecting";
import { type ProspectionFilters } from "@/lib/prospecting-config";
import { recommendedSlugsForOffer } from "@/lib/target-recommendations";
import {
  defaultWebFilter,
  filtersForObjective,
} from "@/lib/prospecting/search-policy";
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

const CONFIDENCE_ICON: Record<SignalConfidence, string> = {
  confirmed: "✓",
  probable: "~",
  unknown: "?",
};
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
  return (
    OBJECTIVE_ICON_PREFIXES.find(([prefix]) => id.startsWith(prefix))?.[1] ??
    "🎯"
  );
}

const WEB_SIGNAL_CARDS: {
  id: string;
  icon: string;
  title: string;
  description: string;
  webFilter: ProspectionFilters["webFilter"];
}[] = [
  {
    id: "no_website",
    icon: "🌐",
    title: "Sans site renseigné sur Google",
    description:
      "Fiche Google trouvée, sans site renseigné. À confirmer avant contact.",
    webFilter: "none",
  },
  {
    id: "weak_website",
    icon: "⚠️",
    title: "Site à analyser",
    description:
      "Entreprises possédant un site pouvant nécessiter une refonte.",
    webFilter: "weak",
  },
  {
    id: "existing",
    icon: "↗",
    title: "Site existant",
    description: "Pour la maintenance, le référencement ou l’acquisition.",
    webFilter: "existing",
  },
  {
    id: "unknown",
    icon: "?",
    title: "Statut à vérifier",
    description: "Données insuffisantes : aucune absence de site présumée.",
    webFilter: "unknown",
  },
  {
    id: "all",
    icon: "✨",
    title: "Tous les statuts",
    description: "Ne filtrer sur aucun statut de site en particulier.",
    webFilter: "all",
  },
];

export interface WizardLaunchParams {
  objectiveId: string;
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
  onContextChange,
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
  onContextChange: () => void;
}) {
  // Métier modifiable EN PLACE (voir OwnActivityEditor) — état local, jamais
  // figé depuis le rendu serveur initial : changer d'activité doit
  // recalculer objectifs/cibles/signaux IMMÉDIATEMENT, sans recharger la
  // page ni refaire l'onboarding.
  const [ownCategoryId, setOwnCategoryId] = useState<string | null>(
    businessProfile?.own_category_id ?? null,
  );
  const [ownCategoryLabel, setOwnCategoryLabel] = useState<string | null>(
    businessProfile?.own_category_label ?? null,
  );
  const ownCategory = ownCategoryId
    ? categories.find((c) => c.id === ownCategoryId)
    : null;
  const parentSlug = ownCategory?.parent_id
    ? (categories.find((c) => c.id === ownCategory.parent_id)?.slug ?? null)
    : null;
  const ownSlug = ownCategory?.slug ?? null;

  const objectives = useMemo(
    () => resolveProspectingObjectives(ownSlug, parentSlug),
    [ownSlug, parentSlug],
  );

  const activityKey = ownCategoryId ?? ownCategoryLabel ?? null;
  const savedObjective =
    initialFilters.activityKey === activityKey
      ? (objectives.find((o) => o.id === initialFilters.objectiveId) ?? null)
      : null;
  const [objectiveId, setObjectiveId] = useState<string | null>(
    savedObjective?.id ?? null,
  );
  const objective = objectives.find((o) => o.id === objectiveId) ?? null;

  const [freeTextOffer, setFreeTextOffer] = useState(
    businessProfile?.offer_description ?? "",
  );
  // Chips recommandés SÉLECTIONNÉS pour l'objectif courant — tous cochés
  // par défaut (voir offer-catalog.ts), désélectionnables individuellement.
  // `null` = "tous" (évite de devoir lister tous les ids au choix de
  // l'objectif).
  const [selectedChipIds, setSelectedChipIds] = useState<Set<string> | null>(
    null,
  );
  const [manualTargetIds, setManualTargetIds] = useState<string[] | null>(
    savedObjective ? defaultTargetIds : null,
  );
  const [exploreOpen, setExploreOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);

  /** Change d'activité : repart de zéro sur objectif/cibles/offre libre — aucun résidu de l'ancien métier ne doit survivre (test bloquant). */
  function changeActivity(categoryId: string | null, label: string | null) {
    setOwnCategoryId(categoryId);
    setOwnCategoryLabel(label);
    setObjectiveId(null);
    setSelectedChipIds(null);
    setManualTargetIds(null);
    setFreeTextOffer("");
    setWebFilter("all");
    onContextChange();
  }

  function selectObjective(id: string) {
    setObjectiveId(id);
    setSelectedChipIds(null);
    setManualTargetIds(null);
    const next = objectives.find((o) => o.id === id);
    setWebFilter(next ? defaultWebFilter(next) : "all");
    onContextChange();
  }

  const [address, setAddress] = useState<AddressValue | null>(
    businessProfile?.lat != null && businessProfile.lng != null
      ? {
          street: businessProfile.street,
          postalCode: businessProfile.postal_code,
          city: businessProfile.city,
          lat: businessProfile.lat,
          lng: businessProfile.lng,
          label: [
            businessProfile.street,
            businessProfile.postal_code,
            businessProfile.city,
          ]
            .filter(Boolean)
            .join(", "),
        }
      : null,
  );
  const [radiusKm, setRadiusKm] = useState(
    Math.min(businessProfile?.default_radius_km ?? 20, maxRadiusKm),
  );

  const [operationalOnly, setOperationalOnly] = useState(
    initialFilters.operationalOnly,
  );
  const [excludeTempClosed, setExcludeTempClosed] = useState(
    initialFilters.excludeTempClosed,
  );
  const [excludeChains, setExcludeChains] = useState(
    initialFilters.excludeChains,
  );
  const [excludeAssociations, setExcludeAssociations] = useState(
    initialFilters.excludeAssociations,
  );
  const [excludeLargeGroups, setExcludeLargeGroups] = useState(
    initialFilters.excludeLargeGroups,
  );
  const [needContact, setNeedContact] = useState(initialFilters.needContact);
  const [maxEstablishmentsPerSiren, setMaxEstablishmentsPerSiren] = useState(
    initialFilters.maxEstablishmentsPerSiren,
  );
  const [webFilter, setWebFilter] = useState<ProspectionFilters["webFilter"]>(
    initialFilters.webFilter,
  );
  const [phoneOnly, setPhoneOnly] = useState(initialFilters.phoneOnly);
  const [googleFicheOnly, setGoogleFicheOnly] = useState(
    initialFilters.googleFicheOnly,
  );

  const filters: ProspectionFilters = {
    operationalOnly,
    excludeTempClosed,
    excludeChains,
    excludeAssociations,
    excludeLargeGroups,
    needContact,
    maxEstablishmentsPerSiren,
    webFilter: objective?.showWebSignal ? webFilter : "all",
    objectiveId,
    activityKey,
    phoneOnly,
    googleFicheOnly,
  };

  // Repli générique honnête (objectif sans chips pré-catalogués) : réutilise
  // le moteur existant offre-en-texte-libre plutôt que d'en dupliquer un
  // second, moins précis mais jamais un blocage pour un métier hors catalogue.
  const genericRecommendation = useMemo(
    () =>
      objective && objective.recommendations.length === 0
        ? recommendedSlugsForOffer(freeTextOffer, ownSlug, categories)
        : null,
    [objective, freeTextOffer, ownSlug, categories],
  );

  const effectiveChipIds = useMemo(
    () =>
      selectedChipIds ??
      new Set(
        objective?.recommendations
          .filter(
            (chip) =>
              !manualTargetIds ||
              categories.some(
                (c) =>
                  manualTargetIds.includes(c.id) &&
                  chip.leafSlugs.includes(c.slug),
              ),
          )
          .map((c) => c.id) ?? [],
      ),
    [selectedChipIds, objective, manualTargetIds, categories],
  );

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
      const filteredSlugs = genericRecommendation.slugs;
      return categories
        .filter((c) => filteredSlugs.includes(c.slug))
        .map((c) => c.id);
    }
    return [];
  }, [objective, effectiveChipIds, genericRecommendation, categories]);
  const targetIds = manualTargetIds ?? resolvedTargetIds;

  function toggleChip(chipId: string) {
    setSelectedChipIds(
      new Set(
        [...effectiveChipIds].includes(chipId)
          ? [...effectiveChipIds].filter((id) => id !== chipId)
          : [...effectiveChipIds, chipId],
      ),
    );
    setManualTargetIds(null);
  }

  // Sauvegarde automatique — même principe que l'ancienne page (jamais de
  // bouton "Enregistrer" à retenir de cliquer), déclenchée par tout
  // changement de la configuration finale (activité, objectif -> offre/
  // audience dérivées, cibles, zone, filtres).
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const isFirstRender = useRef(true);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const serializedFilters = JSON.stringify(filters);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!address || !objective) return;
    const timeout = setTimeout(() => {
      setSaveStatus("saving");
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() =>
          saveProspectingConfig(workspaceId, {
            offerDescription: objective.id.startsWith("generic_")
              ? freeTextOffer
              : objective.label,
            audience: objective.audience,
            street: address.street,
            postalCode: address.postalCode,
            city: address.city,
            lat: address.lat,
            lng: address.lng,
            radiusKm,
            targetCategoryIds: targetIds,
            filters,
          }),
        )
        .then((result) => setSaveStatus(result.ok ? "saved" : "error"))
        .catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ownCategoryId,
    objective?.id,
    freeTextOffer,
    targetIds,
    address,
    radiusKm,
    serializedFilters,
  ]);

  // Les filtres web sont réservés aux offres qui exploitent ce signal.
  const showWebSignal = objective?.showWebSignal;

  const searchFlowVisible = !objective || objective.audience === "b2b";
  const canLaunch = Boolean(
    objective?.audience === "b2b" && address && targetIds.length > 0,
  );

  function launch() {
    if (
      !objective ||
      objective.audience !== "b2b" ||
      !address ||
      !targetIds.length
    )
      return;
    onLaunch({
      objectiveId: objective.id,
      targetIds,
      address,
      radiusKm,
      filters: filtersForObjective(objective, filters),
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
            <p className="font-display text-[17px] font-extrabold text-ink">
              Prospection intelligente
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Une offre précise. Des secteurs adaptés. Un besoin à qualifier.
            </p>
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

      {ownSlug &&
        ["garages", "bodyshop", "tyres"].includes(ownSlug) &&
        !objective && (
          <Card className="border-accent/25 bg-accent/5">
            <p className="font-display text-lg font-bold">
              Votre atelier, avant tout.
            </p>
            <p className="mt-2 text-sm text-muted">
              Clients, véhicules, rendez-vous et interventions : retrouvez votre
              activité dans la gestion métier. La prospection sert ici à
              développer une offre pour les entreprises, par exemple l’entretien
              de flottes.
            </p>
            <Link
              href="/business-os"
              className="mt-3 inline-block font-semibold text-accent"
            >
              Gérer mon atelier →
            </Link>
          </Card>
        )}
      <Card>
        <SectionLabel>01 — Votre offre</SectionLabel>
        <h2 className="mt-2 font-display text-xl font-bold">
          Que voulez-vous vendre ?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Le choix change les secteurs recherchés, les critères et le
          classement.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {objectives.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => selectObjective(o.id)}
              aria-pressed={objectiveId === o.id}
              disabled={searching}
              style={{ animationDelay: `${i * 40}ms` }}
              className={cn(
                "animate-fade-up flex items-center gap-3 rounded-xl border p-4 text-left text-[13px] font-semibold transition hover:-translate-y-0.5",
                objectiveId === o.id
                  ? "border-transparent bg-[image:var(--gradient-signature)] text-accent-ink shadow-[var(--shadow-sm),var(--glow-accent)]"
                  : "border-line bg-panel text-ink hover:border-accent/30 hover:bg-soft",
              )}
            >
              <span aria-hidden>{objectiveIcon(o.id)}</span>
              <span>
                {o.label}
                <span className="mt-1 block text-[11px] font-normal opacity-75">
                  {o.audience === "b2b"
                    ? "Rechercher des entreprises"
                    : "Gérer et fidéliser mes clients"}
                </span>
              </span>
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
              explanation:
                "Une recherche d'entreprises dans le registre officiel n'est probablement pas votre meilleur canal pour ce type de clientèle.",
              alternatives: RETENTION_ALTERNATIVES,
            }}
          />
          <Link
            href="/business-os"
            className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            Ouvrir ma gestion métier →
          </Link>
        </div>
      )}

      {objective && searchFlowVisible && (
        <Card className="animate-fade-up border-accent/30 bg-gradient-to-br from-accent/[0.05] to-transparent">
          <SectionLabel>02 — Vos clients potentiels</SectionLabel>
          <p className="mt-2 font-display text-[15px] font-extrabold text-ink">
            {objective.label}
          </p>
          {objective.strategyExplanation && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {objective.strategyExplanation}
            </p>
          )}

          {genericRecommendation && (
            <div className="mt-3">
              <label className="text-[11px] font-semibold text-muted">
                Précisez votre offre pour affiner les cibles
              </label>
              <textarea
                value={freeTextOffer}
                onChange={(e) => setFreeTextOffer(e.target.value)}
                rows={2}
                placeholder="Ex. Fourniture de matériel électrique pour professionnels du bâtiment."
                className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
              />
            </div>
          )}

          {showWebSignal && (
            <WebSignalCards value={webFilter} onChange={setWebFilter} />
          )}

          {objective.recommendations.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">
                ProspectFlow recommande — {objective.recommendations.length}{" "}
                secteur{objective.recommendations.length > 1 ? "s" : ""}{" "}
                pertinent
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
                      aria-pressed={isSelected}
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
                  <TargetCategoryPicker
                    categories={categories}
                    value={targetIds}
                    onChange={setManualTargetIds}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-line bg-panel p-4">
            <SectionLabel>03 — Votre zone</SectionLabel>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold">
                  Adresse de départ
                </label>
                <AddressField value={address} onChange={setAddress} />
              </div>
              <div>
                <label
                  htmlFor="search-radius"
                  className="mb-2 flex justify-between text-xs font-semibold"
                >
                  Rayon de recherche{" "}
                  <strong className="text-accent">{radiusKm} km</strong>
                </label>
                <input
                  id="search-radius"
                  type="range"
                  min={0.5}
                  max={maxRadiusKm}
                  step={0.5}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
                <p className="mt-2 text-xs text-muted">
                  Autour de {address?.city || "votre adresse"} · Maximum{" "}
                  {maxRadiusKm} km avec {planLabel}.
                </p>
              </div>
            </div>
          </div>

          {objective.signals.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">
                Critères à qualifier selon les données disponibles
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {objective.signals.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-1.5 text-[12.5px] text-ink"
                  >
                    <span
                      className="mt-0.5 text-faint"
                      title={CONFIDENCE_TITLE[s.confidence]}
                    >
                      {CONFIDENCE_ICON[s.confidence]}
                    </span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!targetIds.length && (
            <p className="mt-3 text-sm text-amber-fg">
              Choisissez au moins un secteur via « Explorer d’autres secteurs »
              pour lancer une recherche.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={launch} disabled={!canLaunch || searching}>
              {searching ? "Recherche…" : "Trouver mes prospects →"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setObjectiveId(null);
                onContextChange();
              }}
            >
              Modifier l&apos;objectif
            </Button>
            <Button variant="ghost" onClick={() => setRefineOpen((v) => !v)}>
              {refineOpen ? "Masquer affiner" : "Affiner"}
            </Button>
          </div>

          {refineOpen && (
            <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <FilterCheck
                  label="Écarter fermés"
                  checked={operationalOnly}
                  onChange={setOperationalOnly}
                />
                <FilterCheck
                  label="Écarter fermés temp."
                  checked={excludeTempClosed}
                  onChange={setExcludeTempClosed}
                />
                <FilterCheck
                  label="Écarter chaînes"
                  checked={excludeChains}
                  onChange={setExcludeChains}
                />
                <FilterCheck
                  label="Écarter associations"
                  checked={excludeAssociations}
                  onChange={setExcludeAssociations}
                />
                <FilterCheck
                  label="Écarter gros groupes"
                  checked={excludeLargeGroups}
                  onChange={setExcludeLargeGroups}
                />
                <FilterCheck
                  label="Contact en priorité"
                  checked={needContact}
                  onChange={setNeedContact}
                />
                <FilterCheck
                  label="Téléphone disponible"
                  checked={phoneOnly}
                  onChange={setPhoneOnly}
                />
                <FilterCheck
                  label="Fiche Google disponible"
                  checked={googleFicheOnly}
                  onChange={setGoogleFicheOnly}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted">
                  Max établissements / SIREN
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxEstablishmentsPerSiren}
                  onChange={(e) =>
                    setMaxEstablishmentsPerSiren(Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
                />
              </div>

              {objective.recommendations.length === 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setExploreOpen((v) => !v)}
                    className="text-[12.5px] font-semibold text-accent hover:underline"
                  >
                    {exploreOpen ? "▾" : "▸"} Explorer d&apos;autres secteurs
                  </button>
                  {exploreOpen && (
                    <div className="mt-3">
                      <TargetCategoryPicker
                        categories={categories}
                        value={targetIds}
                        onChange={setManualTargetIds}
                      />
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

function WebSignalCards({
  value,
  onChange,
}: {
  value: ProspectionFilters["webFilter"];
  onChange: (v: ProspectionFilters["webFilter"]) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">
        Quel type d&apos;opportunité recherchez-vous ?
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {WEB_SIGNAL_CARDS.map((card) => {
          const isSelected = value === card.webFilter;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onChange(card.webFilter)}
              aria-pressed={isSelected}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                isSelected
                  ? "border-accent/50 bg-accent/[0.06] shadow-[var(--shadow-sm)]"
                  : "border-line bg-panel hover:border-accent/25 hover:bg-soft",
              )}
            >
              <span className="text-[18px]">{card.icon}</span>
              <span>
                <span className="block text-[12.5px] font-bold text-ink">
                  {card.title}
                </span>
                <span className="block text-[11px] text-muted">
                  {card.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-line bg-soft px-2.5 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
