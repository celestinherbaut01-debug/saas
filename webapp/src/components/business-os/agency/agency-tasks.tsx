"use client";

import { useState } from "react";
import type { Task, Project } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function TasksModule({
  rows,
  projects,
  onCreate,
  onToggle,
  onRemove,
}: {
  rows: Task[];
  projects: Project[];
  onCreate: (input: { title: string; projectId: string; dueDate: string }) => void;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");

  function projectName(id: string | null) {
    return id ? projects.find((p) => p.id === id)?.name ?? "—" : "—";
  }

  function submit() {
    if (!title.trim()) return;
    onCreate({ title, projectId, dueDate });
    setTitle("");
    setProjectId("");
    setDueDate("");
  }

  const now = new Date().getTime();
  const todo = rows.filter((t) => !t.done).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const done = rows.filter((t) => t.done);

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Tâches</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Nouvelle tâche…" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-[160px] flex-1" />
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Projet (optionnel)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
        <Button size="sm" onClick={submit} disabled={!title.trim()}>
          Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="✓" title="Aucune tâche" description="Ajoutez une tâche liée à un projet." />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-1.5">
          {todo.map((t) => {
            const overdue = t.due_date && new Date(t.due_date).getTime() < now;
            return (
              <label key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={t.done} onChange={(e) => onToggle(t.id, e.target.checked)} />
                  <span>
                    {t.title} {t.project_id && <span className="text-faint">— {projectName(t.project_id)}</span>}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {t.due_date && <span className={cn("text-[11px]", overdue ? "font-bold text-red-fg" : "text-faint")}>{new Date(t.due_date).toLocaleDateString("fr-FR")}</span>}
                  <button onClick={() => onRemove(t.id)} className="text-[11px] text-faint hover:text-red-fg">
                    Supprimer
                  </button>
                </span>
              </label>
            );
          })}
          {done.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11.5px] font-semibold text-faint">{done.length} tâche(s) terminée(s)</summary>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {done.map((t) => (
                  <label key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px] text-faint line-through">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={t.done} onChange={(e) => onToggle(t.id, e.target.checked)} />
                      {t.title}
                    </span>
                    <button onClick={() => onRemove(t.id)} className="text-[11px] no-underline hover:text-red-fg">
                      Supprimer
                    </button>
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
