"use client";

import type { Task, Project } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function PlanningModule({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  type Item = { date: string; label: string; kind: "Tâche" | "Échéance projet" };
  const items: Item[] = [
    ...tasks.filter((t) => !t.done && t.due_date).map((t) => ({ date: t.due_date!, label: t.title, kind: "Tâche" as const })),
    ...projects.filter((p) => p.deadline && p.status !== "done").map((p) => ({ date: p.deadline!, label: p.name, kind: "Échéance projet" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const byDay = new Map<string, Item[]>();
  for (const it of items) {
    const day = new Date(it.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    byDay.set(day, [...(byDay.get(day) ?? []), it]);
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Planning</h2>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📅" title="Rien de planifié" description="Ajoutez une échéance à une tâche ou un projet." />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {[...byDay.entries()].map(([day, dayItems]) => (
            <div key={day}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">{day}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {dayItems.map((it, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                    <span>{it.label}</span>
                    <span className="text-faint">{it.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
