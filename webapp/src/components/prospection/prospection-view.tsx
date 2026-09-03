"use client";

import { useState } from "react";
import Link from "next/link";
import type { BusinessCategory, BusinessProfile } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TargetCategoryPicker } from "@/components/onboarding/target-category-picker";
import { AddressField, type AddressValue } from "@/components/onboarding/address-field";
import { cn } from "@/lib/utils";
import { ProspectActions } from "@/components/prospect-actions";
import { addProspectsToCrm } from "@/lib/actions/prospects";
import { runProspectSearch } from "@/lib/actions/search";

// Reflète supabase/functions/_shared/types.ts (EnrichedProspect) côté serveur.
interface SearchResult {
  siren: string;
  siret: string;
  companyName: string;
  nafCode: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  etatAdministratif: string | null;
  natureJuridique: string | null;
  effectifTranche: string | null;
  distanceKm: number;
  isAssociation: boolean;
  isLargeGroup: boolean;
  isChain: boolean;
  placeId: string | null;
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "unverified";
  websiteUri: string | null;
  websiteQuality: "none" | "weak" | "ok" | "unknown";
  phone: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  placesCheckedAt: string | null;
  qualityScore: number;
  verificationSources: Record<string, boolean>;
}

const businessStatusLabel: Record<string, { text: string; cls: string }> = {
  OPERATIONAL: { text: "Opérationnel", cls: "bg-green-bg text-green-fg" },
  CLOSED_TEMPORARILY: { text: "Fermé temp.", cls: "bg-amber-bg text-amber-fg" },
  CLOSED_PERMANENTLY: { text: "Fermé définitivement", cls: "bg-red-bg text-red-fg" },
  unverified: { text: "À vérifier", cls: "bg-soft text-muted" },
};
const websiteQualityLabel: Record<string, { text: string; cls: string }> = {
  none: { text: "Sans site confirmé", cls: "bg-green-bg text-green-fg" },
  weak: { text: "Site à améliorer", cls: "bg-amber-bg text-amber-fg" },
  ok: { text: "Site correct", cls: "bg-soft text-muted" },
  unknown: { text: "À vérifier", cls: "bg-soft text-muted" },
};
function Tag({ text, cls }: { text: string; cls: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", cls)}>{text}</span>;
}

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
  const [webFilter, setWebFilter] = useState<"all" | "no_or_weak" | "none" | "weak" | "unknown">("no_or_weak");

  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<{ kind: "info" | "ok" | "err"; text: string } | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

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
    });

    setSearching(false);

    if (!result.ok) {
      setStatus({ kind: "err", text: `Erreur : ${result.error}` });
      return;
    }

    const data = result.data as {
      results: SearchResult[];
      totalMatchedInRegistry: number;
      verifiedCount: number;
      googlePlacesConfigured: boolean;
    };

    setResults(data.results ?? []);
    setStatus({
      kind: "ok",
      text: `${data.totalMatchedInRegistry} établissement(s) trouvé(s) dans le registre, ${data.verifiedCount} vérifié(s)${
        data.googlePlacesConfigured ? "." : " — clé Google Places non configurée côté serveur : statuts \"à vérifier\"."
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

  async function addSelectedToCrm() {
    const rows = [...checked].map((i) => results[i]);
    if (rows.length === 0) return;
    setAdding(true);

    const result = await addProspectsToCrm(
      workspaceId,
      rows.map((r) => ({
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
      })),
    );

    setAdding(false);
    if (!result.ok) {
      setStatus({ kind: "err", text: result.error ?? "Erreur à l'ajout au CRM." });
    } else {
      setStatus({ kind: "ok", text: `${result.addedCount} prospect(s) ajouté(s) au CRM.` });
      setChecked(new Set());
    }
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
        <h2 className="font-display text-sm font-bold">1. Qui voulez-vous démarcher ?</h2>
        <div className="mt-3">
          <TargetCategoryPicker categories={categories} value={targetIds} onChange={setTargetIds} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-sm font-bold">2. Adresse de départ</h2>
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
                    <Link href="/parametres" className="font-semibold text-accent">
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
          <h2 className="font-display text-sm font-bold">3. Qualité des prospects</h2>
          <div className="mt-3 flex flex-col gap-3">
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
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <Filter label="Écarter fermés" checked={operationalOnly} onChange={setOperationalOnly} />
              <Filter label="Écarter fermés temp." checked={excludeTempClosed} onChange={setExcludeTempClosed} />
              <Filter label="Écarter chaînes" checked={excludeChains} onChange={setExcludeChains} />
              <Filter label="Écarter associations" checked={excludeAssociations} onChange={setExcludeAssociations} />
              <Filter label="Écarter gros groupes" checked={excludeLargeGroups} onChange={setExcludeLargeGroups} />
              <Filter label="Contact en priorité" checked={needContact} onChange={setNeedContact} />
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
          <p
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
                <Link href="/parametres" className="font-semibold underline">
                  Voir les plans
                </Link>
              </>
            )}
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">
            Résultats {results.length > 0 && <span className="font-sans font-normal text-faint">({results.length})</span>}
          </h2>
          {results.length > 0 && (
            <Button size="sm" onClick={addSelectedToCrm} disabled={checked.size === 0 || adding}>
              {adding ? "Ajout…" : `Ajouter la sélection au CRM (${checked.size})`}
            </Button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">Aucun résultat pour l&apos;instant — lancez une recherche.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-soft text-left text-[9.5px] uppercase tracking-wide text-faint">
                  <th className="p-2.5"></th>
                  <th className="p-2.5">Entreprise</th>
                  <th className="p-2.5">Distance</th>
                  <th className="p-2.5">Statut</th>
                  <th className="p-2.5">Site</th>
                  <th className="p-2.5">Score</th>
                  <th className="p-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.siret} className="border-t border-line text-[12.5px]">
                    <td className="p-2.5">
                      <input type="checkbox" checked={checked.has(i)} onChange={() => toggleChecked(i)} />
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold">{r.companyName}</div>
                      <div className="text-[10.5px] text-faint">
                        {[r.street, r.postalCode, r.city].filter(Boolean).join(" ")}
                      </div>
                    </td>
                    <td className="p-2.5">{r.distanceKm.toFixed(1)} km</td>
                    <td className="p-2.5">
                      <Tag {...(businessStatusLabel[r.businessStatus] ?? businessStatusLabel.unverified)} />
                    </td>
                    <td className="p-2.5">
                      <Tag {...(websiteQualityLabel[r.websiteQuality] ?? websiteQualityLabel.unknown)} />
                    </td>
                    <td className="p-2.5">
                      <div className="flex h-6 w-9 items-center justify-center rounded-md bg-soft font-display text-[11px] font-bold">
                        {r.qualityScore}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <ProspectActions
                        websiteUri={r.websiteUri}
                        phone={r.phone}
                        placeId={r.placeId}
                        companyName={r.companyName}
                        address={[r.street, r.postalCode, r.city].filter(Boolean).join(" ")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
