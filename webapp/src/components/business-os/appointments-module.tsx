"use client";

import { useState } from "react";
import type { Appointment } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AppointmentsModule({
  workspaceId,
  initial,
  label,
}: {
  workspaceId: string;
  initial: Appointment[];
  label: string;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim() || !startsAt) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("appointments")
      .insert({ workspace_id: workspaceId, title: title.trim(), starts_at: new Date(startsAt).toISOString() })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [...prev, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setTitle("");
      setStartsAt("");
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const upcoming = rows.filter((r) => new Date(r.starts_at) >= new Date());

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">{label}</h2>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Intitulé" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-52" />
        <Button size="sm" onClick={add} disabled={saving || !title.trim() || !startsAt}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {upcoming.length === 0 && <p className="text-[12.5px] text-muted">Aucun élément à venir.</p>}
        {upcoming.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.title}</b>{" "}
              <span className="text-faint">
                — {new Date(r.starts_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </span>
            <button onClick={() => remove(r.id)} className="text-[11px] text-faint hover:text-red-fg">
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
