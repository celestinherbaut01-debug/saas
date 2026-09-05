"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import { AddressField, type AddressValue } from "@/components/onboarding/address-field";
import { cn } from "@/lib/utils";
import { addProspectsToCrm } from "@/lib/actions/prospects";
import { runProspectSearch } from "@/lib/actions/search";
import { updateOfferAudience } from "@/lib/actions/settings";
import { recommendedSlugsForOffer, filterSlugsByAudience } from "@/lib/target-recommendations";
import { resolveScoringProfile } from "@/lib/scoring-profile";
import { ResultCard, type ProspectionResult } from "@/components/prospection/result-card";

type SearchResult = ProspectionResult;

export function ProspectionView({
  workspaceId,
  categories,
  businessProfile,
  defaultTargetIds,
  maxRadiusKm,
  planLabel,
}: {
  workspaceId: string;
  categories: BusinessCategory[];
  businessProfile: BusinessProfile | null;
  defaultTargetIds: string[];
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

  const [operationalOnly, setOperationalOnly] = useState(true);
  const [excludeTempClosed, setExcludeTempClosed] = useState(true);
  const [excludeChains, setExcludeChains] = useState(true);
  const [excludeAssociations, setExcludeAssociations] = useState(true);
  const [excludeLargeGroups, setExcludeLargeGroups] = useState(true);
  const [needContact, setNeedContact] = useState(false);
  const [maxEstablishmentsPerSiren, setMaxEstablishmentsPerSiren] = useState(8);
  // "all" par défaut : le registre suffit à afficher un prospect, Google
  // Places ne fait qu'enrichir — un filtre par défaut plus restrictif
  // masquait TOUS les résultats tant que Google Places n'était pas
  // configuré (websiteQuality reste "unknown" sans Google, exclu par
  // l'ancien filtre "no_or_weak").
  const [webFilter, setWebFilter] = useState<"all" | "no_or_weak" | "none" | "weak" | "unknown">("all");

  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "ok" | "err"; text: string; devDetail?: string } | null>(
    null,
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [scoringProfileLabel, setScoringProfileLabel] = useState("Score d'opportunité");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [manuallyVerified, setManuallyVerified] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const router = useRouter();

  const [offerDescription, setOfferDescription] = useState(businessProfile?.offer_description ?? "");
  const [audience, setAudience] = useState<"b2b" | "b2c" | "both">(businessProfile?.audience ?? "both");
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerSaved, setOfferSaved] = useState(false);
  const offerChanged =
    offerDescription !== (businessProfile?.offer_description ?? "") || audience !== (businessProfile?.audience ?? "both");

  const [phoneOnly, setPhoneOnly] = useState(false);
  const [googleFicheOnly, setGoogleFicheOnly] = useState(false);

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
  const scoringProfile = resolveScoringProfile(ownSlug, audience);
  // "Besoin digital" (site web) n'est un critère pertinent que pour les
  // profils où la présence web du prospect EST le signal d'opportunité —
  // l'afficher pour un profil "potentiel contrat" (nettoyage) ou "B2B" est
  // trompeur : ce qui compte là, c'est la taille/structure, pas le site.
  const webCriteriaRelevant = scoringProfile === "digital_opportunity" || scoringProfile === "marketing_potential" || scoringProfile === "generic";

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

  async function saveOffer() {
    setSavingOffer(true);
    setOfferSaved(false);
    const result = await updateOfferAudience(workspaceId, offerDescription, audience);
    setSavingOffer(false);
    if (!result.ok) {
      setStatus({ kind: "err", text: result.error ?? "Impossible d'enregistrer votre offre." });
    } else {
      setOfferSaved(true);
    }
  }

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

    const result = await runProspectSearch(workspaceId, {
      lat: address.lat,
      lng: address.lng,
      radiusKm,
      nafCodes: nafCodesForSelection(),
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

    const data = result.data as {
      results: SearchResult[];
      totalMatchedInRegistry: number;
      totalReturned: number;
      googleVerifiedCount: number;
      googlePlacesConfigured: boolean;
      scoringProfileLabel: string;
    };

    setResults(data.results ?? []);
    setScoringProfileLabel(data.scoringProfileLabel ?? "Score d'opportunité");
    setManuallyVerified(new Set());
    setStatus({
      kind: "ok",
      text: `${data.totalMatchedInRegistry} établissement(s) trouvé(s) dans le registre, ${data.totalReturned} affiché(s), ${data.googleVerifiedCount} vérifié(s) par Google${
        data.googlePlacesConfigured
          ? "."
          : " — clé Google Places non configurée côté serveur : les entreprises restent affichées avec le statut « À vérifier »."
      }`,
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
          Adresse GPS précise → rayon exact → registre officiel → Google Places → filtres
          d&apos;indépendance. Rien n&apos;est présenté comme vérifié s&apos;il ne l&apos;est pas.
        </p>
      </div>

      <Card>
        <h2 className="font-display text-sm font-bold">1. Votre offre</h2>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-muted">Que vendez-vous ?</label>
            <textarea
              value={offerDescription}
              onChange={(e) => {
                setOfferDescription(e.target.value);
                setOfferSaved(false);
              }}
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
                  onClick={() => {
                    setAudience(a);
                    setOfferSaved(false);
                  }}
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
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveOffer} disabled={savingOffer || !offerChanged}>
              {savingOffer ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {offerSaved && !offerChanged && <span className="text-[11.5px] text-green-fg">✓ Enregistré</span>}
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
          <p className="mt-4 text-[13px] text-muted">Aucun résultat pour l&apos;instant — lancez une recherche.</p>
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
