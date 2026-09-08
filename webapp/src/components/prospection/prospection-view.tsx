"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import { AddressField, type AddressValue } from "@/components/onboarding/address-field";
import { cn } from "@/lib/utils";
import { addProspectsToCrm } from "@/lib/actions/prospects";
import { runProspectSearch, type ProspectionSearchResponse } from "@/lib/actions/search";
import { saveProspectingConfig } from "@/lib/actions/prospecting";
import { type ProspectionFilters } from "@/lib/prospecting-config";
import { recommendedSlugsForOffer, filterSlugsByAudience } from "@/lib/target-recommendations";
import { getProspectingFilterProfile } from "@/lib/prospecting-filter-profile";
import { ResultCard, type ProspectionResult } from "@/components/prospection/result-card";

type SearchResult = ProspectionResult;

const AUTOSAVE_DEBOUNCE_MS = 900;

export function ProspectionView({
  workspaceId,
  categories,
  businessProfile,
  defaultTargetIds,
  initialFilters,
  maxRadiusKm,
  planLabel,
}: {
  workspaceId: string;
  categories: BusinessCategory[];
  businessProfile: BusinessProfile | null;
  defaultTargetIds: string[];
  initialFilters: ProspectionFilters;
  maxRadiusKm: number;
  planLabel: string;
}) {
  const [targetIds, setTargetIds] = useState<string[]>(defaultTargetIds);
  const [address, setAddress] = useState<AddressValue | null>(
    businessProfile?.lat && businessProfile.lng
      ? {
          street: businessProfile.street,
          postalCode: businessProfile.postal_code,
          city: businessProfile.city,
          lat: businessProfile.lat,
          lng: businessProfile.lng,
          label: [businessProfile.street, businessProfile.postal_code, businessProfile.city]
            .filter(Boolean)
            .join(", "),
        }
      : null,
  );
  // Le rayon est borné au maximum du forfait actuel — y compris si une
  // valeur plus large avait été enregistrée sous un forfait supérieur
  // depuis rétrogradé.
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

  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "ok" | "err"; text: string; devDetail?: string } | null>(
    null,
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  // Distingue "jamais cherché" de "cherché, zéro résultat" — les deux
  // avaient le même message avant ("Aucun résultat pour l'instant — lancez
  // une recherche."), ce qui est trompeur après une recherche réellement
  // terminée sans résultat dans le registre.
  const [hasSearched, setHasSearched] = useState(false);
  const [scoringProfileLabel, setScoringProfileLabel] = useState("Score d'opportunité");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [manuallyVerified, setManuallyVerified] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const router = useRouter();

  const [offerDescription, setOfferDescription] = useState(businessProfile?.offer_description ?? "");
  const [audience, setAudience] = useState<"b2b" | "b2c" | "both">(businessProfile?.audience ?? "both");

  // Persistance automatique : TOUTE la configuration (offre, audience,
  // métiers ciblés, adresse, rayon, filtres) est sauvegardée en base après
  // une courte pause de saisie — jamais un simple useState qui disparaît en
  // changeant de page. Le premier rendu ne déclenche jamais de sauvegarde
  // (l'état initial vient déjà de la base).
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!address) return; // rien d'exploitable à sauvegarder sans adresse

    const timeout = setTimeout(() => {
      setSaveStatus("saving");
      void saveProspectingConfig(workspaceId, {
        offerDescription,
        audience,
        street: address.street,
        postalCode: address.postalCode,
        city: address.city,
        lat: address.lat,
        lng: address.lng,
        radiusKm,
        targetCategoryIds: targetIds,
        filters: {
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
        },
      }).then((result) => {
        setSaveStatus(result.ok ? "saved" : "error");
        setSaveError(result.ok ? null : (result.error ?? "Échec de l'enregistrement."));
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offerDescription,
    audience,
    targetIds,
    address,
    radiusKm,
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
  ]);

  const nafToLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      for (const code of cat.naf_codes) {
        if (!map.has(code)) map.set(code, cat.name);
      }
    }
    return map;
  }, [categories]);

  const ownSlug = businessProfile?.own_category_id
    ? categories.find((c) => c.id === businessProfile.own_category_id)?.slug ?? null
    : null;
  // "Besoin digital" (site web) n'est un critère pertinent que pour une
  // offre réellement liée au web/digital — décidé par l'OFFRE elle-même
  // (getProspectingFilterProfile), pas par le profil de scoring commercial :
  // ce dernier dépend aussi de l'audience B2B/B2C, qui n'a rien à voir avec
  // la pertinence du statut du site d'un prospect (un vendeur de matériel
  // industriel B2B ne doit jamais voir ce filtre, même si son audience
  // déclarée le ferait tomber sur le profil "generic").
  const webCriteriaRelevant = getProspectingFilterProfile(offerDescription, ownSlug).showWebCriteria;

  const offerRecommendation = useMemo(
    () => recommendedSlugsForOffer(offerDescription, ownSlug, categories),
    [offerDescription, ownSlug, categories],
  );
  const recommendedSlugs = filterSlugsByAudience(offerRecommendation.slugs, categories, audience);

  const displayedResults = useMemo(
    () =>
      results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => (!phoneOnly || r.phone) && (!googleFicheOnly || r.placeId)),
    [results, phoneOnly, googleFicheOnly],
  );
  const primaryResults = displayedResults.filter(({ r }) => r.relevanceTier === "primary");
  const secondaryResults = displayedResults.filter(({ r }) => r.relevanceTier === "secondary");
  const [showSecondary, setShowSecondary] = useState(false);

  function nafCodesForSelection(): string[] {
    const set = new Set<string>();
    for (const id of targetIds) {
      const cat = categories.find((c) => c.id === id);
      cat?.naf_codes.forEach((code) => set.add(code));
    }
    return [...set];
  }

  async function runSearch() {
    if (!address) return setStatus({ kind: "err", text: "Validez d'abord une adresse de départ." });
    if (targetIds.length === 0) return setStatus({ kind: "err", text: "Sélectionnez au moins un métier à démarcher." });

    setSearching(true);
    setStatus({ kind: "info", text: "Recherche en cours — registre officiel, Google Places, analyse des sites…" });
    setChecked(new Set());

    const nafCodes = nafCodesForSelection();

    // Log temporaire de diagnostic (stage "recherche lancée depuis l'UI") —
    // uniquement en dev (visible dans la console du navigateur). À retirer
    // une fois le pipeline confirmé stable en conditions réelles.
    if (process.env.NODE_ENV !== "production") {
      console.log("[prospection][ui] recherche lancée :", {
        address: `${address.lat},${address.lng}`,
        radiusKm,
        targetIds,
        nafCodesCount: nafCodes.length,
        nafCodes,
        audience,
      });
    }

    const result = await runProspectSearch(workspaceId, {
      lat: address.lat,
      lng: address.lng,
      radiusKm,
      nafCodes,
      filters: {
        operationalOnly,
        excludeTempClosed,
        excludeChains,
        excludeAssociations,
        excludeLargeGroups,
        needContact,
        maxEstablishmentsPerSiren,
        webFilter,
      },
      ownCategorySlug: ownSlug,
      audience,
    });

    setSearching(false);

    if (!result.ok) {
      setStatus({ kind: "err", text: `Erreur : ${result.error}`, devDetail: result.devDetail });
      return;
    }

    // result.data est déjà une structure stable et entièrement défautée
    // (normalizeSearchResponse côté serveur, lib/actions/search.ts) — aucun
    // champ ne peut être undefined ici, même si l'Edge Function déployée est
    // en retard sur ce code (voir les commentaires de cette fonction).
    const data: ProspectionSearchResponse = result.data ?? {
      registryFound: 0,
      displayed: 0,
      googleVerified: 0,
      googlePlacesConfigured: false,
      scoringProfileLabel: "Score d'opportunité",
      results: [],
      warnings: [],
    };

    // Log temporaire de diagnostic (stage "résultats affichés dans l'UI") —
    // uniquement en dev.
    if (process.env.NODE_ENV !== "production") {
      console.log("[prospection][ui] résultats reçus :", {
        registryFound: data.registryFound,
        displayed: data.displayed,
        googleVerified: data.googleVerified,
        resultsCount: data.results.length,
        warnings: data.warnings,
      });
    }

    setResults(data.results);
    setScoringProfileLabel(data.scoringProfileLabel);
    setManuallyVerified(new Set());
    setHasSearched(true);

    const warningSuffix = data.warnings.length > 0 ? ` (${data.warnings.join(" ")})` : "";
    setStatus({
      kind: "ok",
      text: `${data.registryFound} établissement(s) trouvé(s) dans le registre, ${data.displayed} affiché(s), ${data.googleVerified} vérifié(s) par Google${
        data.googlePlacesConfigured
          ? "."
          : " — clé Google Places non configurée côté serveur : les entreprises restent affichées avec le statut « À vérifier »."
      }${warningSuffix}`,
    });
  }

  function toggleChecked(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function markVerified(i: number) {
    setManuallyVerified((prev) => new Set(prev).add(i));
  }

  function toProspectInsert(r: SearchResult) {
    return {
      workspace_id: workspaceId,
      siren: r.siren,
      siret: r.siret,
      company_name: r.companyName,
      naf_code: r.nafCode,
      street: r.street,
      postal_code: r.postalCode,
      city: r.city,
      lat: r.lat,
      lng: r.lng,
      distance_km: r.distanceKm,
      legal_status: r.etatAdministratif === "A" ? "active" : "closed",
      nature_juridique: r.natureJuridique,
      effectif_tranche: r.effectifTranche,
      is_association: r.isAssociation,
      is_large_group: r.isLargeGroup,
      is_chain: r.isChain,
      place_id: r.placeId,
      business_status: r.businessStatus,
      website_uri: r.websiteUri,
      website_quality: r.websiteQuality,
      phone: r.phone,
      google_rating: r.googleRating,
      google_rating_count: r.googleRatingCount,
      places_checked_at: r.placesCheckedAt,
      quality_score: r.qualityScore,
      verification_sources: r.verificationSources,
    };
  }

  async function addSelectedToCrm() {
    const rows = [...checked].map((i) => results[i]);
    if (rows.length === 0) return;
    setAdding(true);

    const result = await addProspectsToCrm(workspaceId, rows.map(toProspectInsert));

    setAdding(false);
    if (!result.ok) {
      setStatus({ kind: "err", text: result.error ?? "Erreur à l'ajout au CRM." });
    } else {
      setStatus({ kind: "ok", text: `${result.addedCount} prospect(s) ajouté(s) au CRM.` });
      setChecked(new Set());
    }
  }

  async function viewDetail(i: number) {
    setViewingIndex(i);
    const result = await addProspectsToCrm(workspaceId, [toProspectInsert(results[i])]);
    setViewingIndex(null);
    if (!result.ok || !result.ids?.[0]) {
      setStatus({ kind: "err", text: result.error ?? "Impossible d'ouvrir la fiche pour l'instant." });
      return;
    }
    router.push(`/crm/${result.ids[0]}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Prospection</h1>
          <p className="mt-1 text-[13px] text-muted">
            Adresse GPS précise → rayon exact → registre officiel → Google Places → filtres
            d&apos;indépendance. Rien n&apos;est présenté comme vérifié s&apos;il ne l&apos;est pas.
          </p>
        </div>
        {/* Toute la configuration (offre, audience, métiers, adresse, rayon,
            filtres) se sauvegarde seule — jamais de bouton "Enregistrer" par
            section à retenir de cliquer avant de changer de page. */}
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            saveStatus === "saving" && "bg-soft text-muted",
            saveStatus === "saved" && "bg-green-bg text-green-fg",
            saveStatus === "error" && "bg-red-bg text-red-fg",
            saveStatus === "idle" && "bg-soft text-faint",
          )}
          title={saveStatus === "error" ? (saveError ?? undefined) : undefined}
        >
          {saveStatus === "saving" && "Enregistrement…"}
          {saveStatus === "saved" && "✓ Configuration enregistrée"}
          {saveStatus === "error" && "⚠ Échec de l'enregistrement"}
          {saveStatus === "idle" && "Configuration sauvegardée automatiquement"}
        </span>
      </div>

      <Card>
        <h2 className="font-display text-sm font-bold">1. Votre offre</h2>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-muted">Que vendez-vous ?</label>
            <textarea
              value={offerDescription}
              onChange={(e) => setOfferDescription(e.target.value)}
              rows={2}
              placeholder="Ex. Création de sites internet pour commerçants et artisans."
              className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted">Vous vendez principalement à :</label>
            <div className="mt-1 flex gap-2">
              {(["b2b", "b2c", "both"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[13px]",
                    audience === a ? "border-ink bg-ink text-bg" : "border-line bg-panel text-ink",
                  )}
                >
                  {a === "b2b" ? "Entreprises (B2B)" : a === "b2c" ? "Particuliers (B2C)" : "Les deux"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold">2. Qui voulez-vous démarcher ?</h2>
        {recommendedSlugs && recommendedSlugs.length > 0 && (
          <p className="mt-1 text-[11.5px] text-muted">
            {offerRecommendation.basedOnOffer ? (
              <>
                Recommandations basées sur votre offre
                {offerRecommendation.matchedRules.length > 0 && (
                  <> — <span className="font-semibold text-ink">{offerRecommendation.matchedRules.join(", ")}</span></>
                )}
                .
              </>
            ) : (
              "Recommandations basées sur votre métier — décrivez votre offre ci-dessus pour des cibles plus précises."
            )}
          </p>
        )}
        <div className="mt-3">
          <TargetCategoryPicker
            categories={categories}
            value={targetIds}
            onChange={setTargetIds}
            recommendedSlugs={recommendedSlugs}
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-sm font-bold">3. Adresse de départ</h2>
          <div className="mt-3 flex flex-col gap-3">
            <AddressField value={address} onChange={setAddress} />
            <div>
              <label className="text-[11px] font-semibold text-muted">Rayon : {radiusKm} km</label>
              <input
                type="range"
                min={0.5}
                max={maxRadiusKm}
                step={0.5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Math.min(Number(e.target.value), maxRadiusKm))}
                className="w-full"
              />
              <p className="mt-1 text-[11px] text-faint">
                Votre forfait {planLabel} permet jusqu&apos;à {maxRadiusKm} km.
                {maxRadiusKm < 250 && (
                  <>
                    {" "}
                    <Link href="/abonnement" className="font-semibold text-accent">
                      Passer à un forfait supérieur
                    </Link>{" "}
                    pour élargir la zone.
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">4. Qualité des prospects</h2>
          <div className="mt-3 flex flex-col gap-3">
            {webCriteriaRelevant && (
              <div>
                <label className="text-[11px] font-semibold text-muted">Besoin digital</label>
                <select
                  value={webFilter}
                  onChange={(e) => setWebFilter(e.target.value as typeof webFilter)}
                  className="mt-1 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
                >
                  <option value="all">Tous les statuts web</option>
                  <option value="no_or_weak">Sans site confirmé + site faible</option>
                  <option value="none">Sans site confirmé uniquement</option>
                  <option value="weak">Site à améliorer uniquement</option>
                  <option value="unknown">À vérifier uniquement</option>
                </select>
                <p className="mt-1 text-[10.5px] text-faint">
                  Sans Google Places configuré, tout reste « à vérifier » — laissez sur « Tous » pour ne rien masquer.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <Filter label="Écarter fermés" checked={operationalOnly} onChange={setOperationalOnly} />
              <Filter label="Écarter fermés temp." checked={excludeTempClosed} onChange={setExcludeTempClosed} />
              <Filter label="Écarter chaînes" checked={excludeChains} onChange={setExcludeChains} />
              <Filter label="Écarter associations" checked={excludeAssociations} onChange={setExcludeAssociations} />
              <Filter label="Écarter gros groupes" checked={excludeLargeGroups} onChange={setExcludeLargeGroups} />
              <Filter label="Contact en priorité" checked={needContact} onChange={setNeedContact} />
              <Filter label="Téléphone disponible" checked={phoneOnly} onChange={setPhoneOnly} />
              <Filter label="Fiche Google disponible" checked={googleFicheOnly} onChange={setGoogleFicheOnly} />
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
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold">Pipeline de vérification</h2>
            <p className="text-[11px] text-faint">Registre → distance exacte → indépendance → Google Places → site → score.</p>
          </div>
          <Button onClick={runSearch} disabled={searching}>
            {searching ? "Recherche…" : "Rechercher de vraies entreprises"}
          </Button>
        </div>
        {status && (
          <div
            className={cn(
              "mt-3 rounded-lg px-3 py-2 text-[12.5px]",
              status.kind === "err" && "bg-red-bg text-red-fg",
              status.kind === "ok" && "bg-green-bg text-green-fg",
              status.kind === "info" && "bg-soft text-muted",
            )}
          >
            {status.text}
            {status.kind === "err" && status.text.includes("supérieur") && (
              <>
                {" "}
                <Link href="/abonnement" className="font-semibold underline">
                  Voir les plans
                </Link>
              </>
            )}
            {status.kind === "err" && status.devDetail && (
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-red-fg/10 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-red-fg/80">
                {status.devDetail}
              </pre>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">
            Résultats{" "}
            {results.length > 0 && (
              <span className="font-sans font-normal text-faint">
                ({displayedResults.length}
                {displayedResults.length !== results.length ? ` sur ${results.length}` : ""})
              </span>
            )}
          </h2>
          {results.length > 0 && (
            <Button size="sm" onClick={addSelectedToCrm} disabled={checked.size === 0 || adding}>
              {adding ? "Ajout…" : `Ajouter la sélection au CRM (${checked.size})`}
            </Button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">
            {hasSearched
              ? "Aucune cible pertinente trouvée dans le registre pour cette offre, cette audience et cette zone — essayez d'élargir le rayon, de revoir les métiers ciblés, ou de reformuler votre offre."
              : "Aucun résultat pour l'instant — lancez une recherche."}
          </p>
        ) : displayedResults.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">
            Aucun résultat ne correspond aux filtres « Téléphone disponible » / « Fiche Google disponible ».
          </p>
        ) : primaryResults.length === 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-lg bg-amber-bg px-3 py-2.5 text-[13px] text-amber-fg">
              Aucune cible suffisamment pertinente trouvée pour cette offre et cette audience dans le registre — plutôt
              que d&apos;afficher des résultats hors-cible, ils sont regroupés ci-dessous en résultats secondaires.
            </p>
            <SecondaryResultsSection
              results={secondaryResults}
              open
              onToggle={() => setShowSecondary((v) => !v)}
              nafToLabel={nafToLabel}
              scoringProfileLabel={scoringProfileLabel}
              checked={checked}
              toggleChecked={toggleChecked}
              manuallyVerified={manuallyVerified}
              markVerified={markVerified}
              viewingIndex={viewingIndex}
              viewDetail={viewDetail}
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {primaryResults.map(({ r, i }) => (
                <ResultCard
                  key={r.siret}
                  result={r}
                  activityLabel={r.nafCode ? nafToLabel.get(r.nafCode) ?? `Code NAF ${r.nafCode}` : "Activité inconnue"}
                  scoreLabel={scoringProfileLabel}
                  checked={checked.has(i)}
                  onToggleCheck={() => toggleChecked(i)}
                  manuallyVerified={manuallyVerified.has(i)}
                  onMarkVerified={() => markVerified(i)}
                  onViewDetail={() => viewDetail(i)}
                  viewingDetail={viewingIndex === i}
                />
              ))}
            </div>
            {secondaryResults.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <SecondaryResultsSection
                  results={secondaryResults}
                  open={showSecondary}
                  onToggle={() => setShowSecondary((v) => !v)}
                  nafToLabel={nafToLabel}
                  scoringProfileLabel={scoringProfileLabel}
                  checked={checked}
                  toggleChecked={toggleChecked}
                  manuallyVerified={manuallyVerified}
                  markVerified={markVerified}
                  viewingIndex={viewingIndex}
                  viewDetail={viewDetail}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function SecondaryResultsSection({
  results,
  open,
  onToggle,
  nafToLabel,
  scoringProfileLabel,
  checked,
  toggleChecked,
  manuallyVerified,
  markVerified,
  viewingIndex,
  viewDetail,
}: {
  results: { r: SearchResult; i: number }[];
  open: boolean;
  onToggle: () => void;
  nafToLabel: Map<string, string>;
  scoringProfileLabel: string;
  checked: Set<number>;
  toggleChecked: (i: number) => void;
  manuallyVerified: Set<number>;
  markVerified: (i: number) => void;
  viewingIndex: number | null;
  viewDetail: (i: number) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div>
      <button type="button" onClick={onToggle} className="text-[12.5px] font-semibold text-muted hover:text-ink">
        {open ? "▾" : "▸"} Résultats secondaires ({results.length}) — pertinence incertaine par rapport à votre audience
      </button>
      {open && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ r, i }) => (
            <ResultCard
              key={r.siret}
              result={r}
              activityLabel={r.nafCode ? nafToLabel.get(r.nafCode) ?? `Code NAF ${r.nafCode}` : "Activité inconnue"}
              scoreLabel={scoringProfileLabel}
              checked={checked.has(i)}
              onToggleCheck={() => toggleChecked(i)}
              manuallyVerified={manuallyVerified.has(i)}
              onMarkVerified={() => markVerified(i)}
              onViewDetail={() => viewDetail(i)}
              viewingDetail={viewingIndex === i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Filter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-line bg-soft px-2.5 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
