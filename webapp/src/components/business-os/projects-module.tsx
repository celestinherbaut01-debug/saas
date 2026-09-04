"use client";

import { useState } from "react";
import type { Project, Customer } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Project["status"], { text: string; cls: string }> = {
  in_progress: { text: "En cours", cls: "bg-accent/15 text-accent" },
  maintenance: { text: "Maintenance", cls: "bg-amber-bg text-amber-fg" },
  done: { text: "Livré", cls: "bg-green-bg text-green-fg" },
};

export function ProjectsModule({
  workspaceId,
  initial,
  customers,
}: {
  workspaceId: string;
  initial: Project[];
  customers: Customer[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<Project["project_type"]>("site");
  const [customerId, setCustomerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        project_type: projectType,
        customer_id: customerId || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setName("");
      setCustomerId("");
    }
  }

  async function setStatus(id: string, status: Project["status"]) {
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (!error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Projets</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[140px]" />
        <select
          value={projectType}
          onChange={(e) => setProjectType(e.target.value as Project["project_type"])}
          className="rounded-lg border border-line bg-soft px-2.5 py-2 text-[13px]"
        >
          <option value="site">Site web</option>
          <option value="maintenance">Maintenance</option>
          <option value="other">Autre</option>
        </select>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-lg border border-line bg-soft px-2.5 py-2 text-[13px]"
        >
          <option value="">Client (optionnel)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={add} disabled={saving || !name.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-[12.5px] text-muted">Aucun projet pour l&apos;instant.</p>}
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.name}</b> <span className="text-faint">— {customerName(r.customer_id)}</span>
            </span>
            <span className="flex items-center gap-2">
              <select
                value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value as Project["status"])}
                className={cn("rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold", STATUS_LABEL[r.status].cls)}
              >
                {(Object.keys(STATUS_LABEL) as Project["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s].text}
                  </option>
                ))}
              </select>
              <button onClick={() => remove(r.id)} className="text-[11px] text-faint hover:text-red-fg">
                Supprimer
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
