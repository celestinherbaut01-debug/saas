"use client";

import { useState } from "react";
import type { WasteLogEntry } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function WasteLogModule({ workspaceId, initial }: { workspaceId: string; initial: WasteLogEntry[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!itemName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("waste_log")
      .insert({
        workspace_id: workspaceId,
        item_name: itemName.trim(),
        quantity: Number(quantity) || 0,
        reason: reason.trim(),
        estimated_cost: cost ? Number(cost) : null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setItemName("");
      setQuantity("");
      setReason("");
      setCost("");
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("waste_log").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const weekTotal = rows
    .filter((r) => new Date().getTime() - new Date(r.logged_at).getTime() < 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold">Pertes</h2>
        <span className="text-[11.5px] text-muted">
          {weekTotal > 0 ? `${weekTotal.toFixed(2)} € cette semaine` : "Aucune perte chiffrée cette semaine"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Ingrédient / produit" value={itemName} onChange={(e) => setItemName(e.target.value)} className="flex-1 min-w-[140px]" />
        <Input placeholder="Quantité" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24" />
        <Input placeholder="Motif (péremption...)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-40" />
        <Input placeholder="Coût estimé €" type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-28" />
        <Button size="sm" onClick={add} disabled={saving || !itemName.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-[12.5px] text-muted">Aucune perte enregistrée.</p>}
        {rows.slice(0, 20).map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.item_name}</b> <span className="text-faint">— {r.quantity} {r.unit}</span>
              {r.reason && <span className="text-faint"> · {r.reason}</span>}
              {r.estimated_cost != null && <span className="text-faint"> · {r.estimated_cost} €</span>}
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
