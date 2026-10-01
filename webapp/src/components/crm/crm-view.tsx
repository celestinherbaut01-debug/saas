"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Prospect } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS, isFollowupOverdue, type ProspectStatus } from "@/lib/crm-status";

// Pipeline visuel = le même statut que la fiche prospect (lib/crm-status.ts),
// jamais une deuxième liste qui pourrait diverger. "do_not_contact" est une
// marque de conformité, pas une étape du pipeline — masqué par défaut,
// révélable via le filtre, jamais mélangé aux colonnes actives.
const KANBAN_STATUSES: ProspectStatus[] = [
  "new",
  "to_contact",
  "contacted",
  "replied",
  "interested",
  "rdv",
  "quote",
  "won",
  "lost",
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS) as Record<ProspectStatus, string>;

const COLUMN_TONE: Partial<Record<ProspectStatus, string>> = {
  new: "border-t-faint",
  to_contact: "border-t-accent",
  contacted: "border-t-accent",
  replied: "border-t-accent-2",
  interested: "border-t-accent-2",
  rdv: "border-t-[color:var(--amber-fg)]",
  quote: "border-t-[color:var(--amber-fg)]",
  won: "border-t-[color:var(--green-fg)]",
  lost: "border-t-[color:var(--red-fg)]",
};

function ProspectCard({
  prospect,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  prospect: Prospect;
  dragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const overdue = isFollowupOverdue(prospect.next_followup_at);
  return (
    <div
      draggable
      data-prospect-id={prospect.id}
      onDragStart={(e) => onDragStart(e, prospect.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex cursor-grab flex-col gap-1.5 rounded-xl border border-line bg-panel p-3 shadow-[var(--shadow-sm)] transition active:cursor-grabbing",
        dragging ? "opacity-40" : "hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[var(--shadow-md)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/crm/${prospect.id}`} className="min-w-0 flex-1 text-[12.5px] font-bold text-ink hover:text-accent">
          <span className="block truncate">{prospect.company_name}</span>
        </Link>
        <div className="flex h-5 w-7 shrink-0 items-center justify-center rounded-md bg-[image:var(--gradient-signature)] font-display text-[10px] font-extrabold text-accent-ink">
          {prospect.quality_score}
        </div>
      </div>
      <p className="truncate text-[11px] text-faint">
        {[prospect.city, prospect.distance_km != null ? `${prospect.distance_km.toFixed(1)} km` : null].filter(Boolean).join(" — ") || "—"}
      </p>
      {(prospect.next_followup_at || prospect.deal_value != null) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {prospect.next_followup_at && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", overdue ? "bg-red-bg text-red-fg" : "bg-soft text-muted")}>
              {overdue ? "⏰ Relance en retard" : `📅 ${new Date(prospect.next_followup_at).toLocaleDateString("fr-FR")}`}
            </span>
          )}
          {prospect.deal_value != null && (
            <span className="rounded-full bg-green-bg px-1.5 py-0.5 text-[9.5px] font-bold text-green-fg">
              {prospect.deal_value.toLocaleString("fr-FR")} €
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CrmView({ initialProspects }: { initialProspects: Prospect[] }) {
  const supabase = createClient();
  const [prospects, setProspects] = useState(initialProspects);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProspectStatus | null>(null);
  const [search, setSearch] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);

  async function moveToStatus(id: string, status: ProspectStatus) {
    const prospect = prospects.find((p) => p.id === id);
    if (!prospect || prospect.status === status) return;
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    const { error } = await supabase.from("prospects").update({ status }).eq("id", id);
    if (error) {
      setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status: prospect.status } : p)));
      return;
    }
    const from = STATUS_LABEL[prospect.status];
    const to = STATUS_LABEL[status];
    await supabase.from("activities").insert({
      workspace_id: prospect.workspace_id,
      prospect_id: id,
      type: "status_change",
      detail: `${from} → ${to}`,
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (!showExcluded && p.status === "do_not_contact") return false;
      if (q && !p.company_name.toLowerCase().includes(q) && !(p.city ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prospects, search, showExcluded]);

  const overdueCount = prospects.filter((p) => isFollowupOverdue(p.next_followup_at)).length;
  const excludedCount = prospects.filter((p) => p.status === "do_not_contact").length;
  const visibleStatuses = showExcluded ? [...KANBAN_STATUSES, "do_not_contact" as ProspectStatus] : KANBAN_STATUSES;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">CRM</h1>
          <p className="mt-1 text-[13px] text-muted">
            {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} — glissez une carte pour faire avancer son étape.
          </p>
        </div>
        {overdueCount > 0 && <Badge tone="danger">{overdueCount} relance{overdueCount > 1 ? "s" : ""} en retard</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une entreprise, une ville…"
          className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-2 text-[13px] shadow-[var(--shadow-sm)]"
        />
        {excludedCount > 0 && (
          <label className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-[12px] font-medium text-muted shadow-[var(--shadow-sm)]">
            <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
            Afficher &laquo; Ne plus contacter &raquo; ({excludedCount})
          </label>
        )}
      </div>

      {prospects.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-2xl">▦</span>
          <p className="text-[13px] text-muted">
            CRM vide — allez dans <Link href="/prospection" className="font-semibold text-accent">Prospection</Link> pour trouver et ajouter vos premiers prospects.
          </p>
        </Card>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {visibleStatuses.map((status) => {
            const columnProspects = filtered.filter((p) => p.status === status);
            const isOver = dragOverStatus === status;
            return (
              <div
                key={status}
                data-column-status={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(status);
                }}
                onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStatus(null);
                  const id = e.dataTransfer.getData("text/prospect-id");
                  if (id) void moveToStatus(id, status);
                }}
                className={cn(
                  "flex w-[260px] shrink-0 flex-col gap-2 rounded-xl border-t-[3px] bg-soft/60 p-2.5 transition-colors",
                  COLUMN_TONE[status] ?? "border-t-line",
                  isOver && "bg-accent/[0.06] ring-1 ring-accent/30",
                )}
              >
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink">{STATUS_LABEL[status]}</span>
                  <span className="rounded-full bg-panel px-1.5 py-0.5 text-[10px] font-bold text-faint shadow-[var(--shadow-sm)]">
                    {columnProspects.length}
                  </span>
                </div>
                <div className="flex min-h-[60px] flex-col gap-2">
                  {columnProspects.map((p) => (
                    <ProspectCard
                      key={p.id}
                      prospect={p}
                      dragging={draggingId === p.id}
                      onDragStart={(e, id) => {
                        e.dataTransfer.setData("text/prospect-id", id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))}
                  {columnProspects.length === 0 && (
                    <div className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-[10.5px] text-faint">
                      Aucun prospect
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
