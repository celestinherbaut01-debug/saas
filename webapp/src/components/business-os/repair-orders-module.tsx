"use client";

import { useState } from "react";
import type { RepairOrder, Vehicle } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RepairOrder["status"], { text: string; cls: string }> = {
  diagnostic: { text: "Diagnostic", cls: "bg-soft text-muted" },
  waiting_parts: { text: "Attente pièces", cls: "bg-amber-bg text-amber-fg" },
  in_progress: { text: "En cours", cls: "bg-accent/15 text-accent" },
  done: { text: "Terminé", cls: "bg-green-bg text-green-fg" },
  invoiced: { text: "Facturé", cls: "bg-ink text-bg" },
};
const STATUS_ORDER: RepairOrder["status"][] = ["diagnostic", "waiting_parts", "in_progress", "done", "invoiced"];

export function RepairOrdersModule({
  workspaceId,
  initial,
  vehicles,
}: {
  workspaceId: string;
  initial: RepairOrder[];
  vehicles: Vehicle[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [title, setTitle] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("repair_orders")
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        vehicle_id: vehicleId || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setTitle("");
      setVehicleId("");
    }
  }

  async function setStatus(id: string, status: RepairOrder["status"]) {
    const completed_at = status === "done" || status === "invoiced" ? new Date().toISOString() : null;
    const { error } = await supabase.from("repair_orders").update({ status, completed_at }).eq("id", id);
    if (!error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, completed_at } : r)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("repair_orders").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function vehicleLabel(id: string | null) {
    const v = id ? vehicles.find((v) => v.id === id) : null;
    return v ? `${v.registration} (${v.make} ${v.model})` : "—";
  }

  const active = rows.filter((r) => r.status !== "invoiced");

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Ordres de réparation</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Ex. Vidange + freins" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 min-w-[160px]" />
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="rounded-lg border border-line bg-soft px-2.5 py-2 text-[13px]"
        >
          <option value="">Véhicule (optionnel)</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registration} — {v.make} {v.model}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={add} disabled={saving || !title.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {active.length === 0 && <p className="text-[12.5px] text-muted">Aucun ordre de réparation en cours.</p>}
        {active.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.title}</b> <span className="text-faint">— {vehicleLabel(r.vehicle_id)}</span>
            </span>
            <span className="flex items-center gap-2">
              <select
                value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value as RepairOrder["status"])}
                className={cn("rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold", STATUS_LABEL[r.status].cls)}
              >
                {STATUS_ORDER.map((s) => (
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
