// Planning — fonctions PURES pour le filtrage par période et le
// regroupement par jour des événements réels (planning_entries), séparées
// de la liste dérivée (échéances de tâches/projets/ordres de réparation,
// déjà réelle et inchangée) pour ne jamais les confondre dans l'affichage.
import type { PlanningEntry } from "@/lib/supabase/types";

export type PlanningRange = "today" | "week" | "month";

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function rangeBounds(range: PlanningRange, now: Date = new Date()): { start: Date; end: Date } {
  const start = startOfDay(now);
  const end = new Date(start);
  if (range === "today") end.setDate(end.getDate() + 1);
  else if (range === "week") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export function filterEntriesByRange(entries: PlanningEntry[], range: PlanningRange, now: Date = new Date()): PlanningEntry[] {
  const { start, end } = rangeBounds(range, now);
  return entries.filter((e) => {
    const t = new Date(e.starts_at).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

export function groupEntriesByDay(entries: PlanningEntry[]): { day: string; entries: PlanningEntry[] }[] {
  const sorted = [...entries].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const map = new Map<string, PlanningEntry[]>();
  for (const e of sorted) {
    const day = new Date(e.starts_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    map.set(day, [...(map.get(day) ?? []), e]);
  }
  return [...map.entries()].map(([day, dayEntries]) => ({ day, entries: dayEntries }));
}

export const PLANNING_KIND_LABEL: Record<PlanningEntry["kind"], string> = {
  appointment: "Rendez-vous",
  deadline: "Échéance",
  intervention: "Intervention",
  visit: "Visite",
  maintenance: "Maintenance",
  other: "Événement",
};
