import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { googleMapsUrl, googleSearchUrl, telHref } from "@/lib/prospect-links";
import { VERIFICATION_STATUS_LABEL, type VerificationStatus } from "@/lib/verification-status";

export interface ProspectionResult {
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
  verificationStatus: VerificationStatus;
  phone: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  placesCheckedAt: string | null;
  qualityScore: number;
  verificationSources: Record<string, boolean>;
}

const BUSINESS_STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  OPERATIONAL: { text: "Opérationnel", cls: "bg-green-bg text-green-fg" },
  CLOSED_TEMPORARILY: { text: "Fermé temp.", cls: "bg-amber-bg text-amber-fg" },
  CLOSED_PERMANENTLY: { text: "Fermé définitivement", cls: "bg-red-bg text-red-fg" },
  unverified: { text: "Statut à vérifier", cls: "bg-soft text-muted" },
};

function registryStatus(etatAdministratif: string | null): { text: string; cls: string } {
  if (etatAdministratif === "A") return { text: "Actif (registre)", cls: "bg-green-bg text-green-fg" };
  if (etatAdministratif === "F") return { text: "Fermé (registre)", cls: "bg-red-bg text-red-fg" };
  return { text: "Registre : inconnu", cls: "bg-soft text-faint" };
}

function independenceLabel(r: ProspectionResult): { text: string; cls: string } | null {
  if (r.isChain) return { text: "Chaîne / franchise", cls: "bg-amber-bg text-amber-fg" };
  if (r.isAssociation) return { text: "Association / public", cls: "bg-amber-bg text-amber-fg" };
  if (r.isLargeGroup) return { text: "Grand groupe", cls: "bg-amber-bg text-amber-fg" };
  return { text: "Indépendant", cls: "bg-green-bg text-green-fg" };
}

function buildReasons(r: ProspectionResult): string[] {
  const reasons: string[] = [];
  if (r.verificationSources.no_website) reasons.push("Aucun site confirmé");
  else if (r.verificationSources.weak_website) reasons.push("Site à améliorer");
  if (r.verificationSources.google_operational) reasons.push("Fiche Google active");
  if (r.verificationSources.large_structure_opportunity) reasons.push("Structure de taille significative");
  if (r.verificationSources.multi_site_opportunity) reasons.push("Enseigne multi-sites");
  if (r.googleRatingCount) reasons.push(`${r.googleRatingCount} avis Google${r.googleRating ? ` (${r.googleRating}/5)` : ""}`);
  reasons.push(`À ${r.distanceKm.toFixed(1)} km de votre zone`);
  return reasons;
}

export function ResultCard({
  result: r,
  activityLabel,
  scoreLabel = "Score d'opportunité",
  checked,
  onToggleCheck,
  manuallyVerified,
  onMarkVerified,
  onViewDetail,
  viewingDetail,
}: {
  result: ProspectionResult;
  activityLabel: string;
  scoreLabel?: string;
  checked: boolean;
  onToggleCheck: () => void;
  manuallyVerified: boolean;
  onMarkVerified: () => void;
  onViewDetail: () => void;
  viewingDetail: boolean;
}) {
  const verifStatus = VERIFICATION_STATUS_LABEL[r.verificationStatus] ?? VERIFICATION_STATUS_LABEL.UNKNOWN;
  const bizStatus = BUSINESS_STATUS_LABEL[r.businessStatus] ?? BUSINESS_STATUS_LABEL.unverified;
  const regStatus = registryStatus(r.etatAdministratif);
  const indepStatus = independenceLabel(r);
  const reasons = buildReasons(r);
  const address = [r.street, r.postalCode, r.city].filter(Boolean).join(" ");

  return (
    <Card className={cn("flex flex-col gap-3", checked && "border-accent/50 ring-2 ring-accent/15")}>
      <div className="flex items-start justify-between gap-2">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" checked={checked} onChange={onToggleCheck} className="mt-1" />
          <div>
            <p className="font-display text-[14.5px] font-extrabold leading-tight">{r.companyName}</p>
            <p className="text-[11.5px] text-muted">{activityLabel}</p>
          </div>
        </label>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">{scoreLabel}</span>
          <span className="rounded-full bg-soft px-2.5 py-1 font-display text-[13px] font-extrabold">
            {r.qualityScore}
            <span className="text-[9.5px] font-medium text-faint">/100</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded-full border border-line px-2 py-0.5 font-semibold text-muted">
          {r.distanceKm.toFixed(1)} km {r.city && `— ${r.city}`}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 font-bold", regStatus.cls)}>{regStatus.text}</span>
        <span className={cn("rounded-full px-2 py-0.5 font-bold", bizStatus.cls)}>{bizStatus.text}</span>
        <span className={cn("rounded-full px-2 py-0.5 font-bold", verifStatus.cls)}>{verifStatus.text}</span>
        {indepStatus && (
          <span className={cn("rounded-full px-2 py-0.5 font-bold", indepStatus.cls)}>{indepStatus.text}</span>
        )}
        {manuallyVerified && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-bold text-accent">✓ Vérifié par vous</span>
        )}
      </div>

      {address && <p className="text-[11px] text-faint">{address}</p>}

      {reasons.length > 0 && (
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Pourquoi ce prospect ?</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5">
                <span className="mt-0.5 text-accent">✓</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-faint">
        SIREN {r.siren} — SIRET {r.siret}
        {r.nafCode && ` — NAF ${r.nafCode}`}
      </p>

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={onViewDetail} disabled={viewingDetail} className="flex-1">
            {viewingDetail ? "Ouverture…" : "Voir la fiche"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.websiteUri && (
            <a
              href={r.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
            >
              Site
            </a>
          )}
          {r.placeId ? (
            <a
              href={googleMapsUrl({ placeId: r.placeId, companyName: r.companyName, address })}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
            >
              Fiche Google
            </a>
          ) : (
            <>
              <a
                href={googleSearchUrl(r.companyName, r.city)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
              >
                Rechercher sur Google
              </a>
              <a
                href={googleMapsUrl({ placeId: r.placeId, companyName: r.companyName, address })}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
              >
                Google Maps
              </a>
            </>
          )}
          {r.phone && (
            <a
              href={telHref(r.phone)}
              className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
            >
              Appeler
            </a>
          )}
          {!manuallyVerified && (
            <button
              type="button"
              onClick={onMarkVerified}
              className="rounded-md border border-dashed border-line px-2 py-1 text-[10.5px] font-semibold text-muted hover:border-accent hover:text-accent"
            >
              Marquer comme vérifié
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
