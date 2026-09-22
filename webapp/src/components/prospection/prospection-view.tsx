"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addProspectsToCrm } from "@/lib/actions/prospects";
import { runProspectSearch, type ProspectionSearchResponse } from "@/lib/actions/search";
import { type ProspectionFilters } from "@/lib/prospecting-config";
import { ResultCard, type ProspectionResult } from "@/components/prospection/result-card";
import { ProspectingWizard, type WizardLaunchParams } from "@/components/prospection/prospecting-wizard";

type SearchResult = ProspectionResult;

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
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "ok" | "err"; text: string; devDetail?: string } | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [scoringProfileLabel, setScoringProfileLabel] = useState("Score d'opportunité");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [manuallyVerified, setManuallyVerified] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [phoneOnly, setPhoneOnly] = useState(initialFilters.phoneOnly);
  const [googleFicheOnly, setGoogleFicheOnly] = useState(initialFilters.googleFicheOnly);
  const router = useRouter();

  const nafToLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      for (const code of cat.naf_codes) {
        if (!map.has(code)) map.set(code, cat.name);
      }
    }
    return map;
  }, [categories]);

  const displayedResults = useMemo(
    () => results.map((r, i) => ({ r, i })).filter(({ r }) => (!phoneOnly || r.phone) && (!googleFicheOnly || r.placeId)),
    [results, phoneOnly, googleFicheOnly],
  );
  const primaryResults = displayedResults.filter(({ r }) => r.relevanceTier === "primary");
  const secondaryResults = displayedResults.filter(({ r }) => r.relevanceTier === "secondary");
  const [showSecondary, setShowSecondary] = useState(false);

  function nafCodesForSelection(targetIds: string[]): string[] {
    const set = new Set<string>();
    for (const id of targetIds) {
      const cat = categories.find((c) => c.id === id);
      cat?.naf_codes.forEach((code) => set.add(code));
    }
    return [...set];
  }

  async function runSearch(params: WizardLaunchParams) {
    setPhoneOnly(params.filters.phoneOnly);
    setGoogleFicheOnly(params.filters.googleFicheOnly);
    setSearching(true);
    setStatus({ kind: "info", text: "Recherche en cours — registre officiel, Google Places, analyse des sites…" });
    setChecked(new Set());

    const nafCodes = nafCodesForSelection(params.targetIds);

    const result = await runProspectSearch(workspaceId, {
      lat: params.address.lat,
      lng: params.address.lng,
      radiusKm: params.radiusKm,
      nafCodes,
      filters: {
        operationalOnly: params.filters.operationalOnly,
        excludeTempClosed: params.filters.excludeTempClosed,
        excludeChains: params.filters.excludeChains,
        excludeAssociations: params.filters.excludeAssociations,
        excludeLargeGroups: params.filters.excludeLargeGroups,
        needContact: params.filters.needContact,
        maxEstablishmentsPerSiren: params.filters.maxEstablishmentsPerSiren,
        webFilter: params.filters.webFilter,
      },
      ownCategorySlug: params.ownSlug,
      audience: params.audience,
      scoringProfileOverride: params.scoringProfileOverride,
    });

    setSearching(false);

    if (!result.ok) {
      setStatus({ kind: "err", text: `Erreur : ${result.error}`, devDetail: result.devDetail });
      return;
    }

    const data: ProspectionSearchResponse = result.data ?? {
      registryFound: 0,
      displayed: 0,
      googleVerified: 0,
      googlePlacesConfigured: false,
      scoringProfileLabel: "Score d'opportunité",
      results: [],
      warnings: [],
    };

    setResults(data.results);
    setScoringProfileLabel(data.scoringProfileLabel);
    setManuallyVerified(new Set());
    setHasSearched(true);

    const warningSuffix = data.warnings.length > 0 ? ` (${data.warnings.join(" ")})` : "";
    setStatus({
      kind: "ok",
      text: `${data.registryFound} établissement(s) trouvé(s) dans le registre, ${data.displayed} affiché(s), ${data.googleVerified} vérifié(s) par Google${
        data.googlePlacesConfigured ? "." : " — clé Google Places non configurée côté serveur : les entreprises restent affichées avec le statut « À vérifier »."
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
      <div>
        <h1 className="font-display text-2xl font-extrabold">Prospection</h1>
        <p className="mt-1 text-[13px] text-muted">
          ProspectFlow comprend ce que vous vendez avant de chercher qui que ce soit — décrivez votre objectif, nous
          nous occupons de la stratégie.
        </p>
      </div>

      <ProspectingWizard
        workspaceId={workspaceId}
        categories={categories}
        businessProfile={businessProfile}
        defaultTargetIds={defaultTargetIds}
        initialFilters={initialFilters}
        maxRadiusKm={maxRadiusKm}
        planLabel={planLabel}
        searching={searching}
        onLaunch={runSearch}
      />

      {status && (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-[12.5px]",
            status.kind === "err" && "bg-red-bg text-red-fg",
            status.kind === "ok" && "bg-green-bg text-green-fg",
            status.kind === "info" && "bg-soft text-muted",
          )}
        >
          {status.text}
          {status.kind === "err" && status.devDetail && (
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-red-fg/10 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-red-fg/80">
              {status.devDetail}
            </pre>
          )}
        </div>
      )}

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
              ? "Aucune cible pertinente trouvée dans le registre pour cet objectif et cette zone — essayez d'élargir le rayon ou d'explorer d'autres secteurs."
              : "Choisissez un objectif ci-dessus, vérifiez la stratégie recommandée, puis lancez la recherche."}
          </p>
        ) : displayedResults.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">
            Aucun résultat ne correspond aux filtres « Téléphone disponible » / « Fiche Google disponible ».
          </p>
        ) : primaryResults.length === 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-lg bg-amber-bg px-3 py-2.5 text-[13px] text-amber-fg">
              Aucune cible suffisamment pertinente trouvée pour cet objectif dans le registre — plutôt que d&apos;afficher
              des résultats hors-cible, ils sont regroupés ci-dessous en résultats secondaires.
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
        {open ? "▾" : "▸"} Résultats secondaires ({results.length}) — pertinence incertaine par rapport à votre objectif
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
