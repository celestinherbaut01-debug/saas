"use client";

import { useState } from "react";
import type { InventoryItem } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InventoryModule({ workspaceId, initial, label }: { workspaceId: string; initial: InventoryItem[]; label: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({ workspace_id: workspaceId, name: name.trim(), quantity: Number(quantity) || 0 })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setName("");
      setQuantity("");
    }
  }

  async function adjust(id: string, delta: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const quantity = Math.max(0, row.quantity + delta);
    const { error } = await supabase.from("inventory_items").update({ quantity }).eq("id", id);
    if (!error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, quantity } : r)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">{label}</h2>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Nom de l'article" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Quantité" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-28" />
        <Button size="sm" onClick={add} disabled={saving || !name.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-[12.5px] text-muted">Aucun article pour l&apos;instant.</p>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span className="font-medium">{r.name}</span>
            <span className="flex items-center gap-2">
              <button onClick={() => adjust(r.id, -1)} className="h-6 w-6 rounded-md border border-line bg-panel">
                −
              </button>
              <span
                className={cn(
                  "w-8 text-center font-display font-bold",
                  r.low_stock_threshold != null && r.quantity <= r.low_stock_threshold && "text-red-fg",
                )}
              >
                {r.quantity}
              </span>
              <button onClick={() => adjust(r.id, 1)} className="h-6 w-6 rounded-md border border-line bg-panel">
                +
              </button>
              <button onClick={() => remove(r.id)} className="ml-2 text-[11px] text-faint hover:text-red-fg">
                Supprimer
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
