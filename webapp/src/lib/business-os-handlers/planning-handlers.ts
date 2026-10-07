"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PlanningEntry } from "@/lib/supabase/types";

export interface PlanningEntryInput {
  title: string;
  startsAt: string;
  endsAt: string;
  kind: PlanningEntry["kind"];
  customerId: string;
  projectId: string;
  teamMemberId: string;
  notes: string;
}

/** Mutations planning — partagées par toutes les verticales qui exposent un onglet Planning. */
export function makePlanningHandlers({
  supabase,
  workspaceId,
  setEntries,
  setMutationError,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  setEntries: (updater: (prev: PlanningEntry[]) => PlanningEntry[]) => void;
  setMutationError: (msg: string | null) => void;
}) {
  async function createPlanningEntry(input: PlanningEntryInput) {
    const { data, error } = await supabase
      .from("planning_entries")
      .insert({
        workspace_id: workspaceId,
        title: input.title.trim(),
        starts_at: new Date(input.startsAt).toISOString(),
        ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
        kind: input.kind,
        customer_id: input.customerId || null,
        project_id: input.projectId || null,
        team_member_id: input.teamMemberId || null,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if (error || !data) {
      setMutationError(error?.message ?? "Échec de la création de l'événement.");
      return;
    }
    setMutationError(null);
    setEntries((prev) => [...prev, data]);
  }

  async function updatePlanningEntry(id: string, patch: Partial<PlanningEntry>) {
    const { error } = await supabase.from("planning_entries").update(patch).eq("id", id);
    if (error) {
      setMutationError(error.message);
      return;
    }
    setMutationError(null);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function deletePlanningEntry(id: string) {
    const { error } = await supabase.from("planning_entries").delete().eq("id", id);
    if (error) {
      setMutationError(error.message);
      return;
    }
    setMutationError(null);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return { createPlanningEntry, updatePlanningEntry, deletePlanningEntry };
}
