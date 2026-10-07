"use client";

import { useState } from "react";
import type { Customer, PlanningEntry, Project, TeamMember } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { cn } from "@/lib/utils";
import { filterEntriesByRange, groupEntriesByDay, PLANNING_KIND_LABEL, type PlanningRange } from "@/lib/planning";
import type { PlanningEntryInput } from "@/lib/business-os-handlers/planning-handlers";

const RANGE_LABEL: Record<PlanningRange, string> = { today: "Aujourd'hui", week: "Semaine", month: "Mois" };
const KIND_OPTIONS = Object.entries(PLANNING_KIND_LABEL) as [PlanningEntry["kind"], string][];

/**
 * Événements de planning RÉELS (table planning_entries) — section partagée
 * par toutes les verticales qui exposent un onglet Planning. Rendue à côté
 * de la liste dérivée existante (échéances de tâches/projets/ordres de
 * réparation, inchangée) pour ne jamais les confondre : ceci est la seule
 * section où l'utilisateur peut réellement ajouter un événement.
 */
export function PlanningEntriesSection({
  entries,
  customers,
  teamMembers,
  projects,
  onCreate,
  onUpdateStatus,
  onDelete,
}: {
  entries: PlanningEntry[];
  customers: Customer[];
  teamMembers?: TeamMember[];
  projects?: Project[];
  onCreate: (input: PlanningEntryInput) => Promise<void> | void;
  onUpdateStatus: (id: string, status: PlanningEntry["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const [range, setRange] = useState<PlanningRange>("week");
  const [createOpen, setCreateOpen] = useState(false);

  const visible = filterEntriesByRange(entries, range).filter((e) => e.status !== "canceled");
  const grouped = groupEntriesByDay(visible);

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : null;
  }
  function projectName(id: string | null) {
    return id ? projects?.find((p) => p.id === id)?.name ?? "—" : null;
  }
  function teamMemberName(id: string | null) {
    return id ? teamMembers?.find((t) => t.id === id)?.name ?? "—" : null;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Événements</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-soft p-0.5">
            {(Object.keys(RANGE_LABEL) as PlanningRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition",
                  range === r ? "bg-panel text-ink shadow-[var(--shadow-sm)]" : "text-muted hover:text-ink",
                )}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + Ajouter
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="📅"
            title="Rien de planifié sur cette période"
            description="Ajoutez un événement (rendez-vous, intervention, visite...)."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Ajouter
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {grouped.map(({ day, entries: dayEntries }) => (
            <div key={day}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">{day}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {dayEntries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink">
                        {new Date(e.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — {e.title}
                      </span>
                      <span className="text-faint">
                        {PLANNING_KIND_LABEL[e.kind]}
                        {customerName(e.customer_id) && ` · ${customerName(e.customer_id)}`}
                        {projectName(e.project_id) && ` · ${projectName(e.project_id)}`}
                        {teamMemberName(e.team_member_id) && ` · ${teamMemberName(e.team_member_id)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(e.id, e.status === "done" ? "planned" : "done")}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10.5px] font-bold",
                          e.status === "done" ? "bg-green-bg text-green-fg" : "border border-line bg-panel text-muted hover:bg-soft",
                        )}
                      >
                        {e.status === "done" ? "✓ Fait" : "Marquer fait"}
                      </button>
                      <ConfirmDeleteButton itemLabel={`l'événement « ${e.title} »`} onConfirm={() => onDelete(e.id)} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <PlanningCreateDrawer
        open={createOpen}
        customers={customers}
        teamMembers={teamMembers}
        projects={projects}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await onCreate(input);
          setCreateOpen(false);
        }}
      />
    </Card>
  );
}

function PlanningCreateDrawer({
  open,
  customers,
  teamMembers,
  projects,
  onClose,
  onSubmit,
}: {
  open: boolean;
  customers: Customer[];
  teamMembers?: TeamMember[];
  projects?: Project[];
  onClose: () => void;
  onSubmit: (input: PlanningEntryInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PlanningEntry["kind"]>("appointment");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [teamMemberId, setTeamMemberId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const canSubmit = !pending && title.trim().length > 0 && startsAt.length > 0;

  function reset() {
    setTitle("");
    setKind("appointment");
    setStartsAt("");
    setEndsAt("");
    setCustomerId("");
    setProjectId("");
    setTeamMemberId("");
    setNotes("");
  }

  async function submit() {
    if (!canSubmit) return;
    setPending(true);
    try {
      await onSubmit({ title, startsAt, endsAt, kind, customerId, projectId, teamMemberId, notes });
      reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ajouter un événement">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Titre
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Rendez-vous client" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Type
            <Select value={kind} onChange={(e) => setKind(e.target.value as PlanningEntry["kind"])}>
              {KIND_OPTIONS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
          <span />
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Début
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Fin (optionnel)
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Client (optionnel)
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          {projects && (
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              Projet (optionnel)
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {teamMembers && (
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              Membre d&apos;équipe (optionnel)
              <Select value={teamMemberId} onChange={(e) => setTeamMemberId(e.target.value)}>
                <option value="">—</option>
                {teamMembers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={submit} disabled={!canSubmit} className="w-full">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Drawer>
  );
}
