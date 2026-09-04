"use client";

import { useState } from "react";
import Link from "next/link";
import type { Activity, Prospect } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProspectActions } from "@/components/prospect-actions";
import { googleMapsUrl, googleSearchUrl } from "@/lib/prospect-links";
import { scoreBreakdown } from "@/lib/score-breakdown";
import { computeVerificationStatus, VERIFICATION_STATUS_LABEL } from "@/lib/verification-status";
import { opportunityLevel } from "@/lib/opportunity-level";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/lib/crm-status";
import { ACTIVITY_LABEL } from "@/lib/activity-labels";

const WEBSITE_QUALITY_LABEL: Record<string, string> = {
  none: "Aucun site confirmé",
  weak: "Site à améliorer",
  ok: "Site correct",
  unknown: "Non déterminé",
};

export function ProspectDetail({
  prospect: initialProspect,
  initialActivities,
}: {
  prospect: Prospect;
  initialActivities: Activity[];
}) {
  const supabase = createClient();
  const [prospect, setProspect] = useState(initialProspect);
  const [activities, setActivities] = useState(initialActivities);
  const [notes, setNotes] = useState(prospect.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);

  async function logActivity(type: Activity["type"], detail: string) {
    const { data } = await supabase
      .from("activities")
      .insert({ workspace_id: prospect.workspace_id, prospect_id: prospect.id, type, detail })
      .select("*")
      .single();
    if (data) setActivities((prev) => [data, ...prev]);
  }

  async function updateStatus(status: Prospect["status"]) {
    setSavingStatus(true);
    const { error } = await supabase.from("prospects").update({ status }).eq("id", prospect.id);
    setSavingStatus(false);
    if (!error) {
      const from = STATUS_OPTIONS.find(([v]) => v === prospect.status)?.[1];
      const to = STATUS_OPTIONS.find(([v]) => v === status)?.[1];
      setProspect((p) => ({ ...p, status }));
      await logActivity("status_change", `${from} → ${to}`);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    const { error } = await supabase.from("prospects").update({ notes }).eq("id", prospect.id);
    setSavingNotes(false);
    if (!error) setProspect((p) => ({ ...p, notes }));
  }

  async function addTimelineNote() {
    if (!noteDraft.trim()) return;
    await logActivity("note", noteDraft.trim());
    setNoteDraft("");
  }

  const rows = scoreBreakdown(prospect.verification_sources, prospect.distance_km);
  const total = rows.reduce((acc, r) => acc + r.points, 0);

  const verifStatus =
    VERIFICATION_STATUS_LABEL[
      computeVerificationStatus(
        prospect.place_id,
        prospect.website_uri,
        (prospect.website_quality as "none" | "weak" | "ok" | "unknown" | null) ?? "unknown",
      )
    ];
  const opportunity = opportunityLevel(prospect.quality_score);
  const address = [prospect.street, prospect.postal_code, prospect.city].filter(Boolean).join(" ");

  const verifiedFacts: string[] = [];
  const toVerifyFacts: string[] = [];
  (prospect.place_id ? verifiedFacts : toVerifyFacts).push("Fiche Google");
  (prospect.phone ? verifiedFacts : toVerifyFacts).push("Téléphone");
  (prospect.website_uri ? verifiedFacts : toVerifyFacts).push("Site web");
  (prospect.google_rating != null ? verifiedFacts : toVerifyFacts).push("Avis Google");
  verifiedFacts.push("SIREN/SIRET (registre officiel)");

  const novaPrompts = [
    { label: "Analyser ce prospect", prompt: `Analyse le prospect ${prospect.company_name} et donne-moi ton avis sur l'opportunité.` },
    { label: "Préparer un email", prompt: `Rédige un email de prospection pour ${prospect.company_name}.` },
    { label: "Préparer un appel", prompt: `Prépare-moi un script d'appel pour contacter ${prospect.company_name}.` },
    { label: "Message LinkedIn", prompt: `Rédige un message LinkedIn court pour ${prospect.company_name}.` },
  ];

  return (
    <div className="flex flex-col gap-5">
      {prospect.status === "do_not_contact" && (
        <div className="rounded-lg bg-red-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-red-fg">
          ⚠ Ne plus contacter — ce prospect ne doit recevoir aucun email ni relance.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <Link href="/crm" className="text-[12px] text-muted">
            ← CRM
          </Link>
          <h1 className="mt-1 font-display text-2xl font-extrabold">{prospect.company_name}</h1>
          <p className="text-[13px] text-muted">
            {[prospect.street, prospect.postal_code, prospect.city].filter(Boolean).join(" ")}
            {prospect.distance_km != null && ` — ${prospect.distance_km.toFixed(1)} km`}
          </p>
        </div>
        <select
          value={prospect.status}
          disabled={savingStatus}
          onChange={(e) => updateStatus(e.target.value as Prospect["status"])}
          className="rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-sm font-bold">Identité</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[12.5px]">
            <dt className="text-faint">SIREN</dt>
            <dd>{prospect.siren}</dd>
            <dt className="text-faint">SIRET</dt>
            <dd>{prospect.siret}</dd>
            <dt className="text-faint">Code NAF</dt>
            <dd>{prospect.naf_code ?? "—"}</dd>
            <dt className="text-faint">Statut registre</dt>
            <dd>{prospect.legal_status === "active" ? "Actif" : prospect.legal_status ?? "—"}</dd>
            <dt className="text-faint">Nature juridique</dt>
            <dd>{prospect.nature_juridique ?? "—"}</dd>
            <dt className="text-faint">Effectif</dt>
            <dd>{prospect.effectif_tranche ?? "—"}</dd>
            <dt className="text-faint">Distance</dt>
            <dd>{prospect.distance_km != null ? `${prospect.distance_km.toFixed(1)} km` : "—"}</dd>
          </dl>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Contact</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[12.5px]">
            <dt className="text-faint">Téléphone</dt>
            <dd>{prospect.phone ?? "Non disponible"}</dd>
            <dt className="text-faint">Email</dt>
            <dd>Non disponible</dd>
            <dt className="text-faint">Site</dt>
            <dd className="truncate">{prospect.website_uri ?? "Non détecté"}</dd>
            <dt className="text-faint">Adresse</dt>
            <dd>{address || "—"}</dd>
          </dl>
          <div className="mt-4">
            <ProspectActions
              websiteUri={prospect.website_uri}
              phone={prospect.phone}
              placeId={prospect.place_id}
              companyName={prospect.company_name}
              address={address}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Présence digitale</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[12.5px]">
            <dt className="text-faint">Statut du site</dt>
            <dd>{WEBSITE_QUALITY_LABEL[prospect.website_quality ?? "unknown"] ?? "Non déterminé"}</dd>
            <dt className="text-faint">Google Business</dt>
            <dd className={cn("font-semibold", verifStatus.cls.includes("green") ? "text-green-fg" : "")}>
              {verifStatus.text}
            </dd>
            <dt className="text-faint">Note Google</dt>
            <dd>{prospect.google_rating ? `${prospect.google_rating}/5` : "—"}</dd>
            <dt className="text-faint">Nombre d&apos;avis</dt>
            <dd>{prospect.google_rating_count ?? "—"}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {prospect.place_id ? (
              <a
                href={googleMapsUrl({ placeId: prospect.place_id, companyName: prospect.company_name, address })}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
              >
                Voir la fiche Google
              </a>
            ) : (
              <a
                href={googleSearchUrl(prospect.company_name, prospect.city)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold hover:bg-soft"
              >
                Rechercher sur Google
              </a>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">Analyse ProspectFlow</h2>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", opportunity.cls)}>
                Opportunité {opportunity.text}
              </span>
              <div className="flex h-9 w-12 items-center justify-center rounded-lg bg-soft font-display text-[16px] font-extrabold">
                {prospect.quality_score}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="mt-2 text-[12px] font-semibold text-accent"
          >
            {showBreakdown ? "Masquer le détail" : `Pourquoi ${prospect.quality_score} ?`}
          </button>
          {showBreakdown && (
            <ul className="mt-3 flex flex-col gap-1.5 text-[12px]">
              {rows.map((r) => (
                <li key={r.label} className="flex justify-between gap-2">
                  <span className="text-muted">{r.label}</span>
                  <span className={cn("font-semibold", r.points >= 0 ? "text-green-fg" : "text-red-fg")}>
                    {r.points > 0 ? `+${r.points}` : r.points}
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-line pt-1.5 font-bold">
                <span>Total (plafonné 0-100)</span>
                <span>{total}</span>
              </li>
            </ul>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[11.5px]">
            <div>
              <p className="font-semibold text-green-fg">Vérifié</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                {verifiedFacts.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-faint">À vérifier</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                {toVerifyFacts.length === 0 && <li>—</li>}
                {toVerifyFacts.map((f) => (
                  <li key={f}>? {f}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-sm font-bold">NOVA</h2>
        <p className="mt-1 text-[12px] text-muted">
          Prépare une action avec vos vraies données CRM — jamais un contenu générique envoyé automatiquement.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {novaPrompts.map((n) => (
            <Link
              key={n.label}
              href={`/agent?prompt=${encodeURIComponent(n.prompt)}`}
              className="rounded-lg border border-line bg-soft px-3 py-1.5 text-[12px] font-semibold hover:bg-panel"
            >
              {n.label}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes libres sur ce prospect…"
          className="mt-2 w-full rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
        />
        <Button size="sm" className="mt-2" onClick={saveNotes} disabled={savingNotes || notes === prospect.notes}>
          {savingNotes ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold">Historique</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Ajouter un événement (ex. appel passé, échange téléphonique…)"
            className="flex-1 rounded-lg border border-line bg-soft px-3 py-2 text-[13px]"
            onKeyDown={(e) => e.key === "Enter" && addTimelineNote()}
          />
          <Button size="sm" variant="outline" onClick={addTimelineNote}>
            Ajouter
          </Button>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {activities.length === 0 && <p className="text-[13px] text-muted">Aucun événement pour l&apos;instant.</p>}
          {activities.map((a) => (
            <li key={a.id} className="flex gap-3 text-[12.5px]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              <div>
                <span className="font-semibold">{ACTIVITY_LABEL[a.type]}</span>
                {a.detail && <span className="text-muted"> — {a.detail}</span>}
                <div className="text-[10.5px] text-faint">
                  {new Date(a.created_at).toLocaleString("fr-FR")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
