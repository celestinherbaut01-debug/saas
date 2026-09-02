"use client";

import { useState } from "react";
import Link from "next/link";
import type { Prospect } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProspectActions } from "@/components/prospect-actions";

const STATUS_OPTIONS: [Prospect["status"], string][] = [
  ["new", "Nouveau"],
  ["to_contact", "À contacter"],
  ["contacted", "Contacté"],
  ["replied", "A répondu"],
  ["won", "Gagné"],
  ["lost", "Perdu"],
];

const businessStatusLabel: Record<string, { text: string; cls: string }> = {
  OPERATIONAL: { text: "Opérationnel", cls: "bg-green-bg text-green-fg" },
  CLOSED_TEMPORARILY: { text: "Fermé temp.", cls: "bg-amber-bg text-amber-fg" },
  CLOSED_PERMANENTLY: { text: "Fermé définitivement", cls: "bg-red-bg text-red-fg" },
};
const websiteQualityLabel: Record<string, { text: string; cls: string }> = {
  none: { text: "Sans site confirmé", cls: "bg-green-bg text-green-fg" },
  weak: { text: "Site à améliorer", cls: "bg-amber-bg text-amber-fg" },
  ok: { text: "Site correct", cls: "bg-soft text-muted" },
};
function Tag({ text, cls }: { text: string; cls: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", cls)}>{text}</span>;
}

export function CrmView({ initialProspects }: { initialProspects: Prospect[] }) {
  const supabase = createClient();
  const [prospects, setProspects] = useState(initialProspects);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateStatus(id: string, status: Prospect["status"]) {
    const prospect = prospects.find((p) => p.id === id);
    setSavingId(id);
    const { error } = await supabase.from("prospects").update({ status }).eq("id", id);
    setSavingId(null);
    if (!error) {
      setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      if (prospect) {
        const from = STATUS_OPTIONS.find(([v]) => v === prospect.status)?.[1];
        const to = STATUS_OPTIONS.find(([v]) => v === status)?.[1];
        await supabase.from("activities").insert({
          workspace_id: prospect.workspace_id,
          prospect_id: id,
          type: "status_change",
          detail: `${from} → ${to}`,
        });
      }
    }
  }

  const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, [key]) => {
    acc[key] = prospects.filter((p) => p.status === key).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">CRM</h1>
        <p className="mt-1 text-[13px] text-muted">
          {prospects.length} prospect(s) — ajoutés depuis la Prospection. Faites avancer le statut au fil de vos contacts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">À contacter</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{(counts.new ?? 0) + (counts.to_contact ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">Contactés</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{counts.contacted ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">Ont répondu</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{counts.replied ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">Gagnés</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{counts.won ?? 0}</p>
        </Card>
      </div>

      <Card>
        {prospects.length === 0 ? (
          <p className="text-[13px] text-muted">
            CRM vide — allez dans <b className="text-ink">Prospection</b> pour trouver et ajouter vos premiers prospects.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="bg-soft text-left text-[9.5px] uppercase tracking-wide text-faint">
                  <th className="p-2.5">Entreprise</th>
                  <th className="p-2.5">Distance</th>
                  <th className="p-2.5">Statut Google</th>
                  <th className="p-2.5">Site</th>
                  <th className="p-2.5">Score</th>
                  <th className="p-2.5">Actions</th>
                  <th className="p-2.5">Étape CRM</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-t border-line text-[12.5px]">
                    <td className="p-2.5">
                      <Link href={`/crm/${p.id}`} className="font-semibold text-ink hover:text-accent">
                        {p.company_name}
                      </Link>
                      <div className="text-[10.5px] text-faint">
                        {[p.street, p.postal_code, p.city].filter(Boolean).join(" ")}
                      </div>
                    </td>
                    <td className="p-2.5">{p.distance_km != null ? `${p.distance_km.toFixed(1)} km` : "—"}</td>
                    <td className="p-2.5">
                      {p.business_status && businessStatusLabel[p.business_status] ? (
                        <Tag {...businessStatusLabel[p.business_status]} />
                      ) : (
                        <Tag text="À vérifier" cls="bg-soft text-muted" />
                      )}
                    </td>
                    <td className="p-2.5">
                      {p.website_quality && websiteQualityLabel[p.website_quality] ? (
                        <Tag {...websiteQualityLabel[p.website_quality]} />
                      ) : (
                        <Tag text="À vérifier" cls="bg-soft text-muted" />
                      )}
                    </td>
                    <td className="p-2.5">
                      <div className="flex h-6 w-9 items-center justify-center rounded-md bg-soft font-display text-[11px] font-bold">
                        {p.quality_score}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <ProspectActions
                        websiteUri={p.website_uri}
                        phone={p.phone}
                        placeId={p.place_id}
                        companyName={p.company_name}
                        address={[p.street, p.postal_code, p.city].filter(Boolean).join(" ")}
                      />
                    </td>
                    <td className="p-2.5">
                      <select
                        value={p.status}
                        disabled={savingId === p.id}
                        onChange={(e) => updateStatus(p.id, e.target.value as Prospect["status"])}
                        className="rounded-lg border border-line bg-soft px-2 py-1.5 text-[12px]"
                      >
                        {STATUS_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
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
